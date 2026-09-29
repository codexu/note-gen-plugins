import { registerView, resolveMarkdownAttachmentPath, collectMarkdownImageSources, PluginError, type PluginActivate, type PluginContext, type PluginFormBlock, type PluginJsonValue, type PluginRenderedDocument, type PluginUiBlock, type ActiveEditorContext } from '@notegen/plugin-api'

const builtInIds = ['simple', 'technical', 'reading'] as const
type BuiltInId = typeof builtInIds[number]
type FontFamily = 'sans' | 'serif'
interface Options { template: string; width: 'mobile' | 'desktop' }
interface TemplateStyle {
  accent: string
  textColor: string
  backgroundColor: string
  fontFamily: FontFamily
  fontSize: number
  lineHeight: number
}
interface TemplateConfig extends TemplateStyle { css: string }
interface CustomTemplate extends TemplateConfig { id: string; name: string; base: BuiltInId }
const defaultStyles: Record<BuiltInId, TemplateStyle> = {
  simple: { accent: '#2563eb', textColor: '#25313a', backgroundColor: '#ffffff', fontFamily: 'sans', fontSize: 16, lineHeight: 1.8 },
  technical: { accent: '#2563eb', textColor: '#263445', backgroundColor: '#ffffff', fontFamily: 'sans', fontSize: 16, lineHeight: 1.75 },
  reading: { accent: '#8f6745', textColor: '#443d34', backgroundColor: '#fbf8f1', fontFamily: 'serif', fontSize: 17, lineHeight: 1.95 },
}
const isBuiltIn = (value: string): value is BuiltInId => builtInIds.some(id => id === value)
const isColor = (value: unknown): value is string => typeof value === 'string' && /^#[a-f\d]{6}$/i.test(value)
const asRecord = (value: PluginJsonValue | undefined): Record<string, PluginJsonValue> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, PluginJsonValue> : {}
function styleFrom(value: PluginJsonValue | undefined, fallback: TemplateStyle): TemplateStyle {
  const v = asRecord(value)
  return {
    accent: isColor(v.accent) ? v.accent : fallback.accent,
    textColor: isColor(v.textColor) ? v.textColor : fallback.textColor,
    backgroundColor: isColor(v.backgroundColor) ? v.backgroundColor : fallback.backgroundColor,
    fontFamily: v.fontFamily === 'serif' || v.fontFamily === 'sans' ? v.fontFamily : fallback.fontFamily,
    fontSize: typeof v.fontSize === 'number' && v.fontSize >= 12 && v.fontSize <= 24 ? v.fontSize : fallback.fontSize,
    lineHeight: typeof v.lineHeight === 'number' && v.lineHeight >= 1.2 && v.lineHeight <= 2.5 ? v.lineHeight : fallback.lineHeight,
  }
}
function optionsFrom(value: PluginJsonValue | undefined): Options {
  const v = asRecord(value)
  return { template: typeof v.template === 'string' ? v.template : 'simple', width: v.width === 'desktop' ? 'desktop' : 'mobile' }
}
function templatesFrom(value: PluginJsonValue | undefined, legacyStyle: TemplateStyle): CustomTemplate[] {
  if (!Array.isArray(value)) return []
  return value.flatMap(item => {
    const v = asRecord(item)
    if (typeof v.id !== 'string' || !/^custom-[\w-]+$/.test(v.id) || typeof v.name !== 'string' || !v.name.trim() || v.name.length > 60 || typeof v.css !== 'string' || v.css.length > 10000) return []
    const base = typeof v.base === 'string' && isBuiltIn(v.base) ? v.base : 'simple'
    return [{ id: v.id, name: v.name, base, ...styleFrom(item, legacyStyle), css: v.css }]
  }).slice(0, 20)
}
function builtInStylesFrom(value: PluginJsonValue | undefined): Partial<Record<BuiltInId, TemplateConfig>> {
  const stored = asRecord(value)
  const result: Partial<Record<BuiltInId, TemplateConfig>> = {}
  for (const id of builtInIds) {
    const v = asRecord(stored[id])
    if (typeof v.css === 'string' && v.css.length <= 10000) result[id] = { ...styleFrom(stored[id], defaultStyles[id]), css: v.css }
  }
  return result
}
const storedBuiltInStyles = (styles: Partial<Record<BuiltInId, TemplateConfig>>): PluginJsonValue =>
  Object.fromEntries(Object.entries(styles).map(([id, style]) => [id, { ...style }]))
function stylesheet(base: BuiltInId, style: TemplateStyle, css: string): string {
  const builtIn: Record<string, string> = {
    simple: `.article h1 { color: #17212b; font-size: 30px; font-weight: 700; letter-spacing: 1px; border-bottom: 3px solid ${style.accent}; padding-bottom: 14px; margin-bottom: 30px; }
.article h2 { color: #17212b; font-size: 22px; font-weight: 700; border-bottom: 1px solid #dce4ea; padding-bottom: 9px; margin-top: 32px; margin-bottom: 18px; }
.article h3 { color: ${style.accent}; font-size: 18px; font-weight: 700; margin-top: 24px; }
.article p { margin-bottom: 18px; }
.article a { color: ${style.accent}; text-decoration: underline; }
.article blockquote { color: #52616d; background-color: #f4f8fa; border-left: 3px solid ${style.accent}; padding: 12px 16px; margin: 24px 0; }
.article pre { background-color: #f4f7f9; border: 1px solid #e1e8ec; border-radius: 8px; padding: 16px; }
.article th { background-color: #f4f8fa; }`,
    technical: `.article h1 { color: #172334; font-size: 30px; font-weight: 800; border-left: 6px solid ${style.accent}; padding-left: 16px; margin-bottom: 30px; }
.article h2 { color: #172334; font-size: 22px; font-weight: 700; background-color: #eef3f8; border-left: 4px solid ${style.accent}; padding: 8px 12px; margin-top: 32px; }
.article h3 { color: ${style.accent}; font-size: 18px; font-weight: 700; margin-top: 26px; }
.article a { color: ${style.accent}; text-decoration: underline; }
.article blockquote { color: #475569; background-color: #f1f5f9; border-left: 4px solid #94a3b8; padding: 12px 16px; }
.article pre { color: #e2e8f0; background-color: #152238; border-radius: 8px; padding: 18px; margin: 20px 0; }
.article pre code { color: #e2e8f0; background-color: transparent; font-family: "SFMono-Regular", Consolas, monospace; }
.article p code, .article li code { color: #9d3d58; background-color: #f5edf0; border-radius: 4px; padding: 2px 4px; font-family: "SFMono-Regular", Consolas, monospace; }
.article th { color: #172334; background-color: #eaf0f6; }
.article td { border-bottom: 1px solid #dce5ee; }`,
    reading: `.article { padding: 24px; }
.article h1 { color: #57452f; font-size: 30px; font-weight: 700; text-align: center; letter-spacing: 2px; border-bottom: 1px solid #c7ad83; padding-bottom: 22px; margin-bottom: 34px; }
.article h2 { color: #684f34; font-size: 22px; font-weight: 700; text-align: center; letter-spacing: 1px; margin-top: 38px; margin-bottom: 24px; }
.article h3 { color: #806241; font-size: 18px; font-weight: 700; margin-top: 30px; }
.article p { text-indent: 2em; margin-bottom: 22px; }
.article a { color: ${style.accent}; text-decoration: underline; }
.article blockquote { color: #6f604e; background-color: #f2eadb; border-left: 3px solid #bc9b6d; padding: 16px 18px; margin: 28px 0; }
.article blockquote p { text-indent: 0; }
.article pre { background-color: #f1ebdf; border: 1px solid #ded2bb; border-radius: 6px; padding: 16px; }
.article th { background-color: #f1eadc; }`,
  }
  const family = style.fontFamily === 'serif' ? '"Songti SC", "STSong", "Noto Serif CJK SC", Georgia, serif' : '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif'
  return `${builtIn[base]}
.article { color: ${style.textColor}; background-color: ${style.backgroundColor}; font-family: ${family}; font-size: ${style.fontSize}px; line-height: ${style.lineHeight}; }
${css}`
}
async function imageMappings(context: PluginContext, markdown: string, path?: string): Promise<{ source: string; dataUrl: string }[]> {
  if (!path) return []
  const images: { source: string; dataUrl: string }[] = []
  const sources = collectMarkdownImageSources(markdown)
  let total = 0
  for (const source of sources) {
    const relative = resolveMarkdownAttachmentPath(path, source)
    const extension = relative?.split('.').pop()?.toLowerCase()
    const mime = extension === 'jpg' || extension === 'jpeg' ? 'jpeg' : extension === 'png' || extension === 'gif' || extension === 'webp' ? extension : null
    if (!relative || !mime) continue
    try {
      const attachment = await context.attachments.read({ path: relative })
      // Keep both the input and returned HTML comfortably inside the RPC budget.
      if (attachment.base64.length > 200 * 1024 || total + attachment.base64.length > 300 * 1024) continue
      total += attachment.base64.length
      images.push({ source, dataUrl: `data:image/${mime};base64,${attachment.base64}` })
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'Cancelled') throw error
      // Rendering reports unresolved images, including denied attachment grants.
    }
  }
  return images
}

export const activate: PluginActivate = async context => {
  const id = context.plugin.id
  const studio = `${id}.studio`
  const settings = `${id}.settings`
  const t = context.i18n.t
  const savedOptions = await context.storage.device.get('options')
  let options = optionsFrom(savedOptions)
  const oldOptions = asRecord(savedOptions)
  const legacyStyle = styleFrom(savedOptions, defaultStyles[isBuiltIn(options.template) ? options.template : 'simple'])
  let builtInStyles = builtInStylesFrom(await context.storage.device.get('builtInStyles'))
  if (isBuiltIn(options.template) && (oldOptions.accent !== undefined || oldOptions.fontSize !== undefined || oldOptions.lineHeight !== undefined) && !builtInStyles[options.template]) {
    builtInStyles = { ...builtInStyles, [options.template]: { ...legacyStyle, css: '' } }
    await context.storage.device.set('builtInStyles', storedBuiltInStyles(builtInStyles))
  }
  const savedTemplates = await context.storage.device.get('customTemplates')
  let customTemplates = templatesFrom(savedTemplates, legacyStyle)
  if (Array.isArray(savedTemplates) && savedTemplates.some(item => {
    const value = asRecord(item)
    return value.base === undefined || value.accent === undefined
  })) await context.storage.device.set('customTemplates', customTemplates.map(item => ({ ...item })))
  if (typeof oldOptions.customCss === 'string' && oldOptions.customCss.trim() && !customTemplates.length) {
    customTemplates = [{ id: 'custom-imported', name: t('importedTemplate'), base: 'simple', ...legacyStyle, css: oldOptions.customCss.slice(0, 10000) }]
    options.template = 'custom-imported'
    await context.storage.device.set('customTemplates', customTemplates.map(item => ({ ...item })))
  }
  if (!isBuiltIn(options.template) && !customTemplates.some(item => item.id === options.template)) {
    options.template = 'simple'
  }
  if (oldOptions.accent !== undefined || oldOptions.fontSize !== undefined || oldOptions.lineHeight !== undefined || oldOptions.customCss !== undefined) await context.storage.device.set('options', { ...options })
  let document: PluginRenderedDocument | null = null
  let source: ActiveEditorContext | null = null
  let stale = false
  let generation = 0
  let formVersion = 0
  let editingTemplateId: string | null = options.template

  const templateConfig = (templateId: string): { base: BuiltInId; style: TemplateStyle; css: string } => {
    if (isBuiltIn(templateId)) {
      const saved = builtInStyles[templateId]
      return { base: templateId, style: saved ?? defaultStyles[templateId], css: saved?.css ?? '' }
    }
    const custom = customTemplates.find(item => item.id === templateId)
    if (custom) return { base: custom.base, style: custom, css: custom.css }
    return { base: 'simple', style: defaultStyles.simple, css: '' }
  }

  const templateOptions = () => [
    ...['simple', 'technical', 'reading'].map(value => ({ value, label: t(`template.${value}`) })),
    ...customTemplates.map(item => ({ value: item.id, label: item.name })),
  ]
  const templatePicker = (): PluginFormBlock => ({
    type: 'form', id: 'template-picker', resetKey: String(formVersion), submitLabel: t('useTemplate'), command: `${id}.select-template`, changeCommand: `${id}.select-template`, submitDisabled: true,
    fields: [{ type: 'select', id: 'template', label: t('template'), value: options.template, options: templateOptions() }],
  })
  const templateForm = (): PluginFormBlock => {
    const selected = customTemplates.find(item => item.id === editingTemplateId)
    const builtIn = editingTemplateId !== null && isBuiltIn(editingTemplateId)
    const current = templateConfig(editingTemplateId ?? options.template)
    return { type: 'form', id: 'template-settings', resetKey: String(formVersion),
      submitLabel: t(editingTemplateId === null ? 'createTemplate' : 'updateTemplate'), command: `${id}.save-template`, fields: [
        ...(!builtIn ? [{ type: 'text' as const, id: 'name', label: t('templateName'), value: selected?.name ?? '', maxLength: 60 }] : []),
        { type: 'select', id: 'base', label: t('baseTemplate'), value: current.base, disabled: builtIn, options: builtInIds.map(value => ({ value, label: t(`template.${value}`) })) },
        { type: 'text', id: 'accent', label: t('accent'), value: current.style.accent, maxLength: 7 },
        { type: 'text', id: 'textColor', label: t('textColor'), value: current.style.textColor, maxLength: 7 },
        { type: 'text', id: 'backgroundColor', label: t('backgroundColor'), value: current.style.backgroundColor, maxLength: 7 },
        { type: 'select', id: 'fontFamily', label: t('fontFamily'), value: current.style.fontFamily, options: ['sans', 'serif'].map(value => ({ value, label: t(`fontFamily.${value}`) })) },
        { type: 'number', id: 'fontSize', label: t('fontSize'), value: current.style.fontSize, min: 12, max: 24 },
        { type: 'number', id: 'lineHeight', label: t('lineHeight'), value: current.style.lineHeight, min: 1.2, max: 2.5 },
        { type: 'textarea', id: 'css', label: t('css'), description: t('css.help'), value: selected?.css ?? (builtIn ? current.css : ''), maxLength: 10000, placeholder: '.article h2 { color: #2563eb; }' },
      ] }
  }
  const renderStudio = () => {
    const blocks: PluginUiBlock[] = [templatePicker(), { type: 'toolbar', id: 'output', label: t('name'), actions: [
      { id: 'refresh', label: t('command.refresh'), command: `${id}.refresh`, icon: 'refresh-cw', variant: 'outline' },
      { id: 'copy', label: t('command.copy'), command: `${id}.copy`, icon: 'copy', variant: 'default', disabled: !document || stale },
      { id: 'export', label: t('command.export'), command: `${id}.export`, icon: 'download', variant: 'outline', disabled: !document || stale },
    ] }, { type: 'toolbar', id: 'preview-width', label: t('preview'), actions: [
      { id: 'mobile', label: t('width.mobile'), command: `${id}.preview-width`, argument: { width: 'mobile' }, variant: options.width === 'mobile' ? 'default' : 'outline' },
      { id: 'desktop', label: t('width.desktop'), command: `${id}.preview-width`, argument: { width: 'desktop' }, variant: options.width === 'desktop' ? 'default' : 'outline' },
    ] }]
    if (stale) blocks.push({ type: 'callout', title: t('stale'), text: '', tone: 'destructive' })
    if (document) {
      blocks.push({ type: 'document-preview', id: 'article', documentId: document.id, title: t('preview'), width: options.width })
    } else blocks.push({ type: 'empty', title: t('empty') })
    return { blocks }
  }
  const renderSettings = (): PluginUiBlock[] => {
    const blocks: PluginUiBlock[] = [templatePicker(), { type: 'heading', text: t('templateSettings') }, templateForm()]
    if (editingTemplateId !== null) blocks.push({ type: 'actions', actions: [
      { id: 'new-template', label: t('newTemplate'), command: `${id}.new-template` },
    ] })
    if (editingTemplateId && isBuiltIn(editingTemplateId) && builtInStyles[editingTemplateId]) blocks.push({ type: 'actions', actions: [
      { id: 'reset-template', label: t('resetTemplate'), command: `${id}.reset-template`, variant: 'secondary' },
    ] })
    if (editingTemplateId && customTemplates.some(item => item.id === editingTemplateId)) blocks.push({ type: 'actions', actions: [
      { id: 'delete-template', label: t('deleteTemplate'), command: `${id}.delete-template`, variant: 'destructive' },
    ] })
    blocks.push({ type: 'text', tone: 'muted', text: t('configureHint') })
    return blocks
  }
  const studioView = registerView(context, { id: studio, render: renderStudio })
  const publish = async () => {
    await studioView.refresh()
    await context.ui.views.update(settings, { blocks: renderSettings() })
  }
  const refresh = async () => {
    const run = ++generation
    const editor = await context.editor.getActiveEditor()
    if (!editor) { stale = Boolean(document); await publish(); return }
    const snapshot = await context.editor.getTextSnapshot({ editorId: editor.editorId, expectedRevision: editor.revision, format: 'markdown' })
    const images = await imageMappings(context, snapshot.text, editor.path)
    const template = templateConfig(options.template)
    const rendered = await context.documents.render({ markdown: snapshot.text, css: stylesheet(template.base, template.style, template.css), title: editor.path?.split('/').pop()?.replace(/\.md$/i, '') ?? '', target: 'wechat', images })
    if (run !== generation) { await context.documents.release(rendered.id); return }
    const current = await context.editor.getActiveEditor()
    const previous = document
    document = rendered; source = editor
    stale = !current || current.editorId !== editor.editorId || current.revision !== snapshot.revision
    if (previous) await context.documents.release(previous.id)
    await publish()
  }
  const assertFresh = async () => {
    const current = await context.editor.getActiveEditor()
    if (!document || stale || !source || !current || current.editorId !== source.editorId || current.revision !== source.revision) {
      stale = Boolean(document); await publish()
      throw new PluginError('StaleRevision', t('stale'))
    }
    return document
  }
  context.commands.handle(`${id}.open`, async () => {
    if (!context.plugin.capabilities?.includes('document-preview')) { await context.ui.showNotice(t('capabilityMissing')); return }
    await context.ui.views.open(studio)
  })
  context.commands.handle(`${id}.refresh`, refresh)
  context.commands.handle(`${id}.preview-width`, async argument => {
    const width = argument && typeof argument === 'object' && !Array.isArray(argument) ? (argument as Record<string, PluginJsonValue>).width : undefined
    if (width !== 'mobile' && width !== 'desktop' || options.width === width) return
    options = { ...options, width }
    await context.storage.device.set('options', { ...options })
    formVersion++
    await publish()
  })
  context.commands.handle(`${id}.select-template`, async (argument): Promise<PluginJsonValue | void> => {
    const arg = argument && typeof argument === 'object' && !Array.isArray(argument) ? argument as Record<string, PluginJsonValue> : {}
    const values = arg.values && typeof arg.values === 'object' && !Array.isArray(arg.values) ? arg.values as Record<string, PluginJsonValue> : {}
    const template = values.template
    if (typeof template !== 'string' || !templateOptions().some(item => item.value === template)) return { fieldErrors: { template: t('invalidValue') } }
    options = { ...options, template }
    editingTemplateId = template
    await context.storage.device.set('options', { ...options })
    formVersion++
    await refresh()
  })
  context.commands.handle(`${id}.new-template`, async () => {
    editingTemplateId = null
    formVersion++
    await publish()
  })
  context.commands.handle(`${id}.save-template`, async (argument): Promise<PluginJsonValue | void> => {
    const arg = argument && typeof argument === 'object' && !Array.isArray(argument) ? argument as Record<string, PluginJsonValue> : {}
    const values = arg.values && typeof arg.values === 'object' && !Array.isArray(arg.values) ? arg.values as Record<string, PluginJsonValue> : {}
    const editingBuiltIn = editingTemplateId !== null && isBuiltIn(editingTemplateId) ? editingTemplateId : null
    const selected = customTemplates.find(item => item.id === editingTemplateId)
    const name = typeof values.name === 'string' ? values.name.trim() : ''
    const css = typeof values.css === 'string' ? values.css.trim() : ''
    const base = editingBuiltIn ?? values.base
    if (!editingBuiltIn && (!name || name.length > 60)) return { fieldErrors: { name: t('templateNameRequired') } }
    if (typeof base !== 'string' || !isBuiltIn(base)) return { fieldErrors: { base: t('invalidValue') } }
    if (!isColor(values.accent)) return { fieldErrors: { accent: t('invalidColor') } }
    if (!isColor(values.textColor)) return { fieldErrors: { textColor: t('invalidColor') } }
    if (!isColor(values.backgroundColor)) return { fieldErrors: { backgroundColor: t('invalidColor') } }
    if (values.fontFamily !== 'sans' && values.fontFamily !== 'serif') return { fieldErrors: { fontFamily: t('invalidValue') } }
    if (typeof values.fontSize !== 'number' || values.fontSize < 12 || values.fontSize > 24) return { fieldErrors: { fontSize: t('invalidValue') } }
    if (typeof values.lineHeight !== 'number' || values.lineHeight < 1.2 || values.lineHeight > 2.5) return { fieldErrors: { lineHeight: t('invalidValue') } }
    if (!editingBuiltIn && !selected && customTemplates.length >= 20) return { fieldErrors: { name: t('templateLimit') } }
    if (!editingBuiltIn && customTemplates.some(item => item.name === name && item.id !== selected?.id)) return { fieldErrors: { name: t('templateNameExists') } }
    const style: TemplateStyle = { accent: values.accent, textColor: values.textColor, backgroundColor: values.backgroundColor,
      fontFamily: values.fontFamily, fontSize: values.fontSize, lineHeight: values.lineHeight }
    let probe: PluginRenderedDocument
    try { probe = await context.documents.render({ markdown: '', css: stylesheet(base, style, css) }) }
    catch (error) { return { fieldErrors: { css: error instanceof Error ? error.message : String(error) } } }
    await context.documents.release(probe.id)
    if (editingBuiltIn) {
      builtInStyles = { ...builtInStyles, [editingBuiltIn]: { ...style, css } }
      await context.storage.device.set('builtInStyles', storedBuiltInStyles(builtInStyles))
      options = { ...options, template: editingBuiltIn }
      editingTemplateId = editingBuiltIn
    } else {
      const template = { id: selected?.id ?? `custom-${Date.now()}`, name, base, ...style, css }
      customTemplates = [...customTemplates.filter(item => item.id !== template.id), template]
      options = { ...options, template: template.id }
      editingTemplateId = template.id
      await context.storage.device.set('customTemplates', customTemplates.map(item => ({ ...item })))
    }
    await context.storage.device.set('options', { ...options })
    formVersion++; await refresh()
  })
  context.commands.handle(`${id}.reset-template`, async () => {
    if (!editingTemplateId || !isBuiltIn(editingTemplateId) || !builtInStyles[editingTemplateId]) return
    const next = { ...builtInStyles }
    delete next[editingTemplateId]
    builtInStyles = next
    await context.storage.device.set('builtInStyles', storedBuiltInStyles(builtInStyles))
    formVersion++; await refresh()
  })
  context.commands.handle(`${id}.delete-template`, async () => {
    if (!editingTemplateId || !customTemplates.some(item => item.id === editingTemplateId)) return
    customTemplates = customTemplates.filter(item => item.id !== editingTemplateId)
    options = { ...options, template: 'simple' }
    editingTemplateId = 'simple'
    await context.storage.device.set('customTemplates', customTemplates.map(item => ({ ...item })))
    await context.storage.device.set('options', { ...options })
    formVersion++; await refresh()
  })
  context.commands.handle(`${id}.copy`, async () => {
    const current = await assertFresh()
    await context.clipboard.write({ documentId: current.id })
    await context.ui.showNotice(t('copied'))
  })
  context.commands.handle(`${id}.export`, async () => {
    const current = await assertFresh()
    const name = source?.path?.split('/').pop()?.replace(/\.md$/i, '') || 'article'
    const result = await context.files.export({ fileName: `${name}.html`, documentId: current.id })
    await context.ui.showNotice(t(result.saved ? 'saved' : 'cancelled'))
  })
  const markStale = async () => {
    if (!document || stale) return
    stale = true
    await publish()
  }
  context.editor.onDidChangeContent(event => {
    if (source && event.editorId === source.editorId && event.revision !== source.revision) return markStale()
  })
  context.editor.onDidChangeActiveEditor(event => {
    if (event.current?.editorId !== source?.editorId) return markStale()
  })
  context.ui.views.onDidChange(async view => {
    if (view.visible && view.id === settings) await publish()
  })
  await publish()
}
