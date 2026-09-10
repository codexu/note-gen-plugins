import {
  PluginError,
  type ActiveEditorContext,
  type EditorContentChangeEvent,
  type PluginActivate,
  type PluginContext,
  type PluginDisposable,
  type PluginStatusBarUpdate,
} from '@notegen/plugin-api'
import { getEditorStatistics, type MarkdownEditorStatistics } from './statistics.js'

const AUTOMATIC_DOCUMENT_LIMIT_BYTES = 1_024 * 1_024

type DisplayMetric = 'characters-reading-time' | 'characters' | 'words' | 'reading-time'
type CharacterMode = 'with-whitespace' | 'without-whitespace'

type StatisticsResult = {
  editor: ActiveEditorContext
  statistics: MarkdownEditorStatistics
}

function settingKey(context: PluginContext, name: string): string {
  return `${context.plugin.id}.${name}`
}

function readBooleanSetting(context: PluginContext, name: string, fallback: boolean): boolean {
  const value = context.settings.get(settingKey(context, name))
  return typeof value === 'boolean' ? value : fallback
}

function readDisplayMetric(
  context: PluginContext,
  name: 'primaryMetric' | 'compactMetric',
  fallback: DisplayMetric,
): DisplayMetric {
  const value = context.settings.get(settingKey(context, name))
  return value === 'characters-reading-time'
    || value === 'characters'
    || value === 'words'
    || value === 'reading-time'
    ? value
    : fallback
}

function readCharacterMode(context: PluginContext): CharacterMode {
  return context.settings.get(settingKey(context, 'characterMode')) === 'with-whitespace'
    ? 'with-whitespace'
    : 'without-whitespace'
}

function selectedCharacterCount(
  context: PluginContext,
  statistics: MarkdownEditorStatistics,
): number {
  return readCharacterMode(context) === 'with-whitespace'
    ? statistics.charactersWithWhitespace
    : statistics.charactersWithoutWhitespace
}

function formatNumber(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/gu, ',')
}

function formatReadingTime(
  context: PluginContext,
  statistics: MarkdownEditorStatistics,
): string {
  if (statistics.readingMinutes > 0) {
    return `${formatNumber(statistics.readingMinutes)} ${context.i18n.t('unit.minute')}`
  }
  return statistics.charactersWithWhitespace > 0 || statistics.codeBlocks > 0 ? '—' : '0'
}

function formatMetric(
  context: PluginContext,
  statistics: MarkdownEditorStatistics,
  metric: DisplayMetric,
): string {
  const characters = `${formatNumber(selectedCharacterCount(context, statistics))} ${context.i18n.t('setting.metric.characters')}`
  const words = `${formatNumber(statistics.nonCjkWords)} ${context.i18n.t('setting.metric.words')}`
  const readingTime = formatReadingTime(context, statistics)

  if (metric === 'characters') return characters
  if (metric === 'words') return words
  if (metric === 'reading-time') return readingTime
  return `${characters} · ${readingTime}`
}

function formatDetails(context: PluginContext, statistics: MarkdownEditorStatistics): string {
  const detailsTitle = context.i18n.t('command.showDetails.title')
  const withWhitespace = context.i18n.t('setting.characterMode.withWhitespace')
  const withoutWhitespace = context.i18n.t('setting.characterMode.withoutWhitespace')
  const words = context.i18n.t('setting.metric.words')
  const readingTime = context.i18n.t('setting.metric.readingTime')
  const code = context.i18n.t('setting.includeCodeBlocks.title')
  return [
    detailsTitle,
    `${withWhitespace}: ${formatNumber(statistics.charactersWithWhitespace)}`,
    `${withoutWhitespace}: ${formatNumber(statistics.charactersWithoutWhitespace)}`,
    `${words}: ${formatNumber(statistics.nonCjkWords)}`,
    `CJK: ${formatNumber(statistics.cjkCharacters)}`,
    `${readingTime}: ${formatReadingTime(context, statistics)}`,
    `${code}: ${formatNumber(statistics.codeBlocks)} / ${formatNumber(statistics.codeLines)}`,
  ].join('\n')
}

function sameEditor(left: ActiveEditorContext | null, right: ActiveEditorContext | null): boolean {
  return Boolean(
    left
    && right
    && left.windowId === right.windowId
    && left.editorId === right.editorId
    && left.documentId === right.documentId,
  )
}

function sameEditorRevision(left: ActiveEditorContext | null, right: ActiveEditorContext | null): boolean {
  return sameEditor(left, right) && left?.revision === right?.revision
}

function eventMatchesEditor(
  event: EditorContentChangeEvent,
  editor: ActiveEditorContext | null,
): boolean {
  return Boolean(
    editor
    && event.editorId === editor.editorId
    && event.documentId === editor.documentId,
  )
}

function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('code' in error)) return undefined
  const code = error.code
  return typeof code === 'string' ? code : undefined
}

export const activate: PluginActivate = async (context) => {
  const statusId = `${context.plugin.id}.summary`
  const refreshCommandId = `${context.plugin.id}.refresh`
  const detailsCommandId = `${context.plugin.id}.show-details`
  const disposables: PluginDisposable[] = []
  let disposed = false
  let activeEditor: ActiveEditorContext | null = null
  let latestResult: StatisticsResult | null = null
  let requestGeneration = 0
  let stale = false

  const showStatusBar = () => readBooleanSetting(context, 'showStatusBar', true)

  const updateStatus = (state: PluginStatusBarUpdate) => {
    if (disposed || context.signal.aborted) return
    void context.ui.statusBar.update(statusId, state).catch(() => undefined)
  }

  const renderStatus = () => {
    if (disposed || context.signal.aborted) return
    if (!showStatusBar() || !activeEditor) {
      updateStatus({ visible: false, busy: false })
      return
    }

    const currentResult = latestResult && sameEditor(latestResult.editor, activeEditor)
      ? latestResult
      : null
    const staleLabel = context.i18n.t('status.stale')
    const text = currentResult
      ? formatMetric(
          context,
          currentResult.statistics,
          readDisplayMetric(context, 'primaryMetric', 'characters-reading-time'),
        )
      : ''
    const compactText = currentResult
      ? formatMetric(
          context,
          currentResult.statistics,
          readDisplayMetric(context, 'compactMetric', 'characters'),
        )
      : ''
    const tooltip = currentResult
      ? formatDetails(context, currentResult.statistics)
      : context.i18n.t('command.refresh.description')
    const visibleText = stale ? [text, staleLabel].filter(Boolean).join(' · ') : text
    const visibleCompactText = stale
      ? [compactText, staleLabel].filter(Boolean).join(' · ')
      : compactText
    const visibleTooltip = stale ? `${tooltip}\n${staleLabel}` : tooltip

    updateStatus({
      visible: true,
      text: visibleText,
      compactText: visibleCompactText,
      tooltip: visibleTooltip,
      accessibleLabel: visibleText || context.i18n.t('command.refresh.description'),
      busy: false,
    })
  }

  const hideForMissingEditor = () => {
    activeEditor = null
    latestResult = null
    requestGeneration += 1
    renderStatus()
  }

  let schedule: (editor: ActiveEditorContext) => void

  const calculate = async (
    generation: number,
    target: ActiveEditorContext,
    manual: boolean,
  ): Promise<MarkdownEditorStatistics | null> => {
    try {
      const beforeSnapshot = await context.editor.getActiveEditor()
      if (disposed || context.signal.aborted || generation !== requestGeneration) return null
      if (!beforeSnapshot) {
        hideForMissingEditor()
        return null
      }
      if (!sameEditorRevision(beforeSnapshot, target)) {
        activeEditor = beforeSnapshot
        schedule(beforeSnapshot)
        return null
      }
      if (beforeSnapshot.composing) {
        activeEditor = beforeSnapshot
        stale = true
        renderStatus()
        if (manual) {
          throw new PluginError('EditorBusy', 'Editor statistics are waiting for text composition to finish')
        }
        return null
      }

      const snapshot = await context.editor.getTextSnapshot({
        editorId: beforeSnapshot.editorId,
        expectedRevision: beforeSnapshot.revision,
        format: 'markdown',
      })
      if (
        disposed
        || context.signal.aborted
        || generation !== requestGeneration
        || snapshot.editorId !== target.editorId
        || snapshot.documentId !== target.documentId
        || snapshot.revision !== target.revision
      ) {
        return null
      }

      const statistics = getEditorStatistics(snapshot.text, {
        includeCodeBlocks: readBooleanSetting(context, 'includeCodeBlocks', false),
      })
      const afterSnapshot = await context.editor.getActiveEditor()
      if (disposed || context.signal.aborted || generation !== requestGeneration) return null
      if (!afterSnapshot || !sameEditorRevision(afterSnapshot, target)) {
        if (afterSnapshot) {
          activeEditor = afterSnapshot
          schedule(afterSnapshot)
        } else {
          hideForMissingEditor()
        }
        return null
      }

      activeEditor = afterSnapshot
      latestResult = { editor: afterSnapshot, statistics }
      stale = false
      renderStatus()
      return statistics
    } catch (error) {
      if (disposed || context.signal.aborted || generation !== requestGeneration) return null
      if (errorCode(error) === 'StaleRevision') {
        const current = await context.editor.getActiveEditor().catch(() => null)
        if (disposed || context.signal.aborted || generation !== requestGeneration) return null
        if (current) {
          activeEditor = current
          schedule(current)
        } else {
          hideForMissingEditor()
        }
        return null
      }
      renderStatus()
      if (manual) throw error
      return null
    }
  }

  schedule = (editor) => {
    if (disposed || context.signal.aborted) return
    activeEditor = editor
    const generation = ++requestGeneration
    // Marketplace plugins have no timer globals. Editor events are already
    // coalesced by the host, and the host also rate-limits status updates.
    if (editor.size.bytes >= AUTOMATIC_DOCUMENT_LIMIT_BYTES) {
      stale = true
      renderStatus()
      return
    }
    void calculate(generation, editor, false)
  }

  const refreshNow = async (): Promise<MarkdownEditorStatistics | null> => {
    const editor = await context.editor.getActiveEditor()
    if (disposed || context.signal.aborted) return null
    if (!editor) {
      hideForMissingEditor()
      return null
    }
    activeEditor = editor
    const generation = ++requestGeneration
    stale = false
    return calculate(generation, editor, true)
  }

  disposables.push(context.commands.handle(refreshCommandId, async () => {
    const statistics = await refreshNow()
    if (statistics && !context.signal.aborted) {
      await context.ui.showNotice(
        `${context.i18n.t('command.refresh.title')}: ${formatMetric(context, statistics, 'characters-reading-time')}`,
      )
    }
    return statistics
  }))

  disposables.push(context.commands.handle(detailsCommandId, async () => {
    const current = await context.editor.getActiveEditor()
    if (!current) {
      hideForMissingEditor()
      await context.ui.showNotice(context.i18n.t('command.showDetails.description'))
      return null
    }

    activeEditor = current
    const statistics = latestResult && sameEditorRevision(latestResult.editor, current)
      ? latestResult.statistics
      : await refreshNow()
    if (statistics && !context.signal.aborted) {
      await context.ui.openDialog({
        title: context.i18n.t('command.showDetails.title'),
        ...(current.path ? { description: current.path } : {}),
        content: { blocks: [{ type: 'key-value', items: formatDetails(context, statistics).split('\n').slice(1).map(line => {
          const split = line.indexOf(': ')
          return { label: line.slice(0, split), value: line.slice(split + 2) }
        }) }] },
      })
    }
    return statistics
  }))

  disposables.push(context.editor.onDidChangeActiveEditor(({ current }) => {
    if (!current) {
      hideForMissingEditor()
      return
    }
    if (!sameEditor(activeEditor, current)) latestResult = null
    activeEditor = current
    schedule(current)
  }))

  disposables.push(context.editor.onDidChangeContent((event) => {
    if (!eventMatchesEditor(event, activeEditor) || !activeEditor) return
    activeEditor = {
      ...activeEditor,
      revision: event.revision,
      composing: event.composing,
      size: event.size,
    }
    schedule(activeEditor)
  }))

  disposables.push(context.settings.onDidChange((key) => {
    if (!key.startsWith(`${context.plugin.id}.`)) return
    if (key === settingKey(context, 'showStatusBar')) {
      renderStatus()
      return
    }
    if (key === settingKey(context, 'includeCodeBlocks')) {
      latestResult = null
      if (activeEditor) schedule(activeEditor)
      return
    }
    renderStatus()
  }))

  const dispose = () => {
    if (disposed) return
    disposed = true
    requestGeneration += 1
    for (const disposable of disposables.splice(0)) disposable.dispose()
    void context.ui.statusBar.update(statusId, { visible: false, busy: false })
      .catch(() => undefined)
  }
  context.signal.addEventListener('abort', dispose, { once: true })

  void context.editor.getActiveEditor()
    .then((editor) => {
      if (disposed || context.signal.aborted) return
      if (!editor) {
        hideForMissingEditor()
        return
      }
      activeEditor = editor
      schedule(editor)
    })
    .catch(() => {
      if (!disposed && !context.signal.aborted) hideForMissingEditor()
    })
}
