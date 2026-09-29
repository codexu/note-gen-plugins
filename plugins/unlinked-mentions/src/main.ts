import { type PluginActivate, type PluginUiBlock } from '@notegen/plugin-api'
import { record, workbench } from '../../../shared/workbench'

interface Candidate {
  path: string
  preview: string
  kind: 'mention' | 'related'
}

interface SearchSession {
  sourcePath: string
  editorId: string
  documentId: string
  editorRevision: number
  selectionText: string
  term: string
  candidates: Candidate[]
  truncated: boolean
  relatedLoading: boolean
  relatedUnavailable: boolean
  generation: string
  contextId: string
}

const VIEW_ID = 'top.notegen.unlinked-mentions.view'
const MAX_TERM_LENGTH = 80
const MAX_SEARCH_MATCHES = 100
const MAX_RELATED_MATCHES = 20

function numberSetting(value: unknown, fallback: number, min: number, max: number, integer = false): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    && (!integer || Number.isInteger(value)) ? value : fallback
}

function mentionPreview(content: string, lineNumber: number, term: string): string | null {
  const lines = content.split('\n')
  if (lineNumber < 1 || lineNumber > lines.length) return null
  let frontMatter = lines[0]?.trim() === '---'
  let fence: { character: string; length: number } | null = null
  for (let index = 0; index < lineNumber; index++) {
    const line = lines[index]
    if (frontMatter) {
      if (index > 0 && /^(?:---|\.\.\.)\s*$/.test(line)) frontMatter = false
      continue
    }
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/)
    if (marker) {
      const character = marker[1][0]
      if (!fence) fence = { character, length: marker[1].length }
      else if (fence.character === character && marker[1].length >= fence.length) fence = null
      continue
    }
    if (index === lineNumber - 1) {
      // Ignore code, existing links and markup when finding a prose mention.
      if (fence || /^(?: {4}|\t| {0,3}#| {0,3}\[[^\]]+\]:)/.test(line) || /[\[\]`<>\\]|!\[[^\]]*\]/.test(line)) return null
      const expression = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu')
      let match: RegExpExecArray | null = null
      for (const occurrence of line.matchAll(expression)) {
        const before = line[occurrence.index - 1] ?? ''
        const after = line[occurrence.index + occurrence[0].length] ?? ''
        if ((/^[A-Za-z0-9_]$/.test(term[0]) && /^[A-Za-z0-9_]$/.test(before))
          || (/^[A-Za-z0-9_]$/.test(term.at(-1) ?? '') && /^[A-Za-z0-9_]$/.test(after))) continue
        match = occurrence
        break
      }
      if (!match) return null
      const start = Math.max(0, match.index - Math.max(0, Math.min(18, 80 - match[0].length)))
      const end = Math.min(line.length, match.index + match[0].length + 110)
      const preview = `${start ? '…' : ''}${line.slice(start, end).trim()}${end < line.length ? '…' : ''}`
      return preview
    }
  }
  return null
}

function relativeHref(from: string, to: string): string {
  const directory = from.split('/').slice(0, -1)
  const target = to.split('/')
  while (directory.length && target.length && directory[0] === target[0]) { directory.shift(); target.shift() }
  return [...directory.map(() => '..'), ...target].map(part => part === '..' ? part : encodeURIComponent(part).replace(/[()]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)).join('/')
}

function markdownLinkLabel(text: string): string {
  return text.replace(/[\\\[\]]/g, character => `\\${character}`)
}

function resolvesToTarget(href: string, contentPath: string, targetPath: string): boolean {
  let target = href.trim().replace(/^<|>$/g, '').split(/[?#]/, 1)[0]
  if (!target || /^[a-z][a-z\d+.-]*:/i.test(target)) return false
  try { target = decodeURIComponent(target) } catch { return false }
  const parts = target.startsWith('/') ? [] : contentPath.split('/').slice(0, -1)
  for (const part of target.replace(/\\/g, '/').split('/')) {
    if (part === '..') parts.pop()
    else if (part && part !== '.') parts.push(part)
  }
  return parts.join('/') === targetPath
}

function alreadyLinked(content: string, contentPath: string, targetPath: string): boolean {
  for (const match of content.matchAll(/!?(?:\[[^\]\n]*\])\((<[^>]+>|[^\s)]+)(?:\s+[^)]*)?\)/g)) {
    if (!match[0].startsWith('!') && resolvesToTarget(match[1], contentPath, targetPath)) return true
  }
  const targetName = targetPath.split('/').at(-1)?.replace(/\.md$/i, '') ?? ''
  for (const match of content.matchAll(/\[\[([^\]|\n]+)(?:\|[^\]\n]+)?\]\]/g)) {
    const target = match[1].replace(/\.md$/i, '')
    if (target === targetPath.replace(/\.md$/i, '') || target === targetName) return true
  }
  return false
}

export const activate: PluginActivate = async ctx => {
  const w = workbench(ctx)
  const t = w.t
  let session: SearchSession | null = null
  w.onReset(() => { session = null })
  ctx.ui.views.onDidChange(state => {
    if (state.id === VIEW_ID && session && (!state.visible || state.contextId !== session.contextId)) session = null
  })

  async function currentSession(argument: unknown): Promise<{ state: SearchSession; candidate: Candidate }> {
    const input = record(argument)
    const state = session
    const index = typeof input.itemId === 'string' ? state?.candidates.findIndex(candidate => candidate.path === input.itemId) : input.index
    if (!state || input.generation !== state.generation || !Number.isSafeInteger(index)
      || typeof index !== 'number' || index < 0 || index >= state.candidates.length) {
      throw new Error(t('搜索结果已过期，请重新查找。', 'Search results expired. Search again.'))
    }
    const view = await ctx.ui.views.getState(VIEW_ID)
    if (!view.visible || view.contextId !== state.contextId) {
      session = null
      throw new Error(t('选区已变化，请重新查找。', 'The selection changed. Search again.'))
    }
    return { state, candidate: state.candidates[index] }
  }

  function viewBlocks(state: SearchSession): PluginUiBlock[] {
    const caveat = state.truncated
      ? t('搜索只覆盖部分已保存笔记，结果可能不完整。', 'Only part of the saved workspace was scanned; results may be incomplete.')
      : null
    const relatedCaveat = state.relatedUnavailable
      ? t('RAG 关联暂不可用，仅显示文字匹配结果。', 'RAG suggestions are unavailable; only text matches are shown.')
      : null
    if (!state.candidates.length && !state.relatedLoading) return [
      { type: 'layout', id: 'empty-results', gap: 'small', blocks: [
        { type: 'text', text: t('没有找到可链接的笔记。', 'No linkable notes found.') },
        ...(caveat ? [{ type: 'text' as const, text: caveat, tone: 'muted' as const }] : []),
        ...(relatedCaveat ? [{ type: 'text' as const, text: relatedCaveat, tone: 'muted' as const }] : []),
      ] },
    ]
    return [
      ...(['mention', 'related'] as const).flatMap(kind => {
        const candidates = state.candidates.filter(candidate => candidate.kind === kind)
        const label = kind === 'mention' ? t('匹配', 'Matches') : t('相关', 'Related')
        return candidates.length ? [...(kind === 'related' ? [{ type: 'text' as const, text: label, tone: 'muted' as const }] : []),
          { type: 'item-list' as const, id: kind, generation: state.generation, label,
            emptyText: t('没有找到可链接的笔记。', 'No linkable notes found.'),
            compact: true, descriptionLines: 3 as const, inlineActions: true,
            items: candidates.map(candidate => ({ id: candidate.path, label: candidate.path,
              description: candidate.preview, descriptionHighlight: state.term })),
            openCommand: w.command('open'),
            actions: [{ id: 'link', label: t('建立链接', 'Create link'), command: w.command('link'), variant: 'secondary' as const }],
          }] : []
      }),
      ...(state.relatedLoading ? [
        { type: 'text' as const, text: t('相关', 'Related'), tone: 'muted' as const },
        { type: 'loading' as const, label: t('正在查找相关笔记…', 'Finding related notes…') },
      ] : []),
      ...(caveat ? [{ type: 'text' as const, text: caveat, tone: 'muted' as const }] : []),
      ...(relatedCaveat ? [{ type: 'text' as const, text: relatedCaveat, tone: 'muted' as const }] : []),
    ]
  }

  w.register('find', async (_, guard) => {
    const view = await ctx.ui.views.getState(VIEW_ID)
    if (!view.visible || !view.contextId || view.target?.kind !== 'editor-selection') {
      throw new Error(t('请在编辑器选区的浮动菜单中使用此功能。', 'Use this command from the editor selection bubble menu.'))
    }
    const editor = await ctx.editor.getActiveEditor()
    const selection = await ctx.editor.getSelection()
    if (!editor?.path || !selection || selection.editorId !== editor.editorId || selection.revision !== editor.revision || selection.empty) {
      throw new Error(t('请先在已保存的 Markdown 笔记中选中文字。', 'Select text in a saved Markdown note first.'))
    }
    const term = selection.text.trim().replace(/\s+/g, ' ')
    if (term.length < 2 || term.length > MAX_TERM_LENGTH || selection.text.includes('\n')) {
      throw new Error(t('请选择 2–80 个字符的单行词语或短语。', 'Select a single-line term or phrase of 2–80 characters.'))
    }
    const sourcePath = editor.path
    const source = await ctx.editor.getTextSnapshot({ editorId: editor.editorId, expectedRevision: editor.revision, format: 'markdown' })
    const textResultCount = numberSetting(ctx.settings.get(`${ctx.plugin.id}.textResultCount`), 10, 1, 15, true)
    const ragEnabled = ctx.settings.get(`${ctx.plugin.id}.ragEnabled`) !== false
    const ragMinScore = numberSetting(ctx.settings.get(`${ctx.plugin.id}.ragMinScore`), 0.35, 0, 1)
    const ragResultCount = numberSetting(ctx.settings.get(`${ctx.plugin.id}.ragResultCount`), 5, 1, 10, true)
    session = null
    await ctx.ui.views.update(VIEW_ID, { expectedContextId: view.contextId,
      blocks: [{ type: 'layout', id: 'loading-results', blocks: [{ type: 'loading', label: t('正在查找笔记…', 'Finding notes…') }] }] })
    await ctx.ui.views.focus(VIEW_ID)
    try {
      const result = await ctx.notes.search({ query: term, folder: '.', limit: MAX_SEARCH_MATCHES })
      await guard()
      const mentions: Candidate[] = []
      const ignored = new Set<string>()
      const cached = new Map<string, Awaited<ReturnType<typeof ctx.notes.read>>>()
      const relatedEnabled = ragEnabled && (ctx.plugin.capabilities?.includes('related-notes-search') ?? false)
      for (const match of result.matches) {
        if (match.path === sourcePath || ignored.has(match.path)) continue
        if (alreadyLinked(source.text, sourcePath, match.path)) { ignored.add(match.path); continue }
        let note = cached.get(match.path)
        if (!note) {
          note = await ctx.notes.read({ path: match.path })
          cached.set(match.path, note)
        }
        await guard()
        const preview = mentionPreview(note.content, match.line, term)
        if (!preview) continue
        mentions.push({ path: note.path, preview, kind: 'mention' })
        ignored.add(match.path)
        if (mentions.length >= textResultCount) break
      }
      const state: SearchSession = { sourcePath, editorId: editor.editorId, documentId: editor.documentId,
        editorRevision: editor.revision, selectionText: selection.text, term, candidates: mentions,
        truncated: result.truncated, relatedLoading: relatedEnabled,
        relatedUnavailable: false, generation: w.token(), contextId: view.contextId }
      await guard()
      const current = await ctx.ui.views.getState(VIEW_ID)
      if (!current.visible || current.contextId !== view.contextId) return
      await ctx.ui.views.update(VIEW_ID, { expectedContextId: view.contextId, blocks: viewBlocks(state) })
      session = state
      if (relatedEnabled) {
        void (async () => {
          const related: Candidate[] = []
          try {
            const relatedResult = await ctx.notes.searchRelated({ query: term, folder: '.', limit: MAX_RELATED_MATCHES,
              excludePaths: [...new Set([sourcePath, ...result.matches.map(match => match.path)])] })
            await guard()
            for (const match of relatedResult.matches) {
              if (session !== state) return
              if (match.score < ragMinScore) continue
              if (match.path === sourcePath || ignored.has(match.path)) continue
              if (alreadyLinked(source.text, sourcePath, match.path)) continue
              related.push({ path: match.path, preview: match.preview.trim().replace(/\s+/g, ' '), kind: 'related' })
              ignored.add(match.path)
              if (related.length >= ragResultCount) break
            }
          } catch (error) {
            if (session !== state) return
            try { await guard() } catch { return }
            state.relatedUnavailable = true
            ctx.log.warning(error instanceof Error ? error.message : String(error))
          }
          if (session !== state) return
          try {
            await guard()
            const latest = await ctx.ui.views.getState(VIEW_ID)
            if (!latest.visible || latest.contextId !== state.contextId || session !== state) return
            state.candidates.push(...related)
            state.relatedLoading = false
            await ctx.ui.views.update(VIEW_ID, { expectedContextId: state.contextId, blocks: viewBlocks(state) })
          } catch (error) {
            ctx.log.warning(error instanceof Error ? error.message : String(error))
          }
        })()
      }
    } catch (error) {
      const current = await ctx.ui.views.getState(VIEW_ID).catch(() => null)
      if (current?.visible && current.contextId === view.contextId) {
        await ctx.ui.views.update(VIEW_ID, { expectedContextId: view.contextId,
          blocks: [{ type: 'callout', title: t('查找失败', 'Search failed'), text: error instanceof Error ? error.message : String(error), tone: 'destructive' }] }).catch(() => {})
      }
      throw error
    }
  })

  w.register('open', async (argument, guard) => {
    const { candidate } = await currentSession(argument)
    await w.open(candidate.path, guard)
  })

  w.register('link', async (argument, guard) => {
    const { state, candidate } = await currentSession(argument)
    const editor = await ctx.editor.getActiveEditor()
    const selection = await ctx.editor.getSelection()
    await guard()
    if (!editor || editor.editorId !== state.editorId || editor.documentId !== state.documentId
      || editor.path !== state.sourcePath || editor.revision !== state.editorRevision
      || !selection || selection.editorId !== state.editorId || selection.revision !== state.editorRevision
      || selection.empty || selection.text !== state.selectionText) {
      throw new Error(t('选区或当前笔记已变化，请重新查找。', 'The selection or current note changed. Search again.'))
    }
    const link = `[${markdownLinkLabel(state.selectionText)}](${relativeHref(state.sourcePath, candidate.path)})`
    await ctx.editor.applyEdit({ editorId: state.editorId, expectedRevision: state.editorRevision, target: 'selection', text: link })
    session = null
    await ctx.ui.showNotice(t('已将选中文字链接到：', 'Linked selected text to: ') + candidate.path)
  })
}
