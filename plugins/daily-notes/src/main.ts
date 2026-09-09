import {
  PluginError,
  type PluginActivate,
  type PluginContext,
  type ResolvedDay,
} from '@notegen/plugin-api'

const MAX_TEMPLATE_BYTES = 65_536
const MAX_PATH_BYTES = 1_024
const MAX_PATH_SEGMENT_BYTES = 240
const MAX_PATH_DEPTH = 12
const PATH_VARIABLE_NAMES = ['date', 'year', 'month', 'day'] as const
const BODY_VARIABLE_NAMES = [
  ...PATH_VARIABLE_NAMES,
  'dateLong',
  'weekday',
  'time',
  'title',
  'path',
  'workspaceName',
] as const
const INVALID_PORTABLE_NAME_CHARACTER = /[<>:"/\\|?*\u0000-\u001F\u007F-\u009F\uD800-\uDFFF]/u
const WINDOWS_RESERVED_STEMS = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'CLOCK$',
  'CONIN$',
  'CONOUT$',
])
const WINDOWS_RESERVED_PORT_SUFFIXES = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9', '¹', '²', '³'])
const RESERVED_PATH_SEGMENTS = new Set([
  '.notegen',
  'node_modules',
  '.git',
  '.hg',
  '.svn',
  '.cache',
])

type PathVariableName = typeof PATH_VARIABLE_NAMES[number]
type BodyVariableName = typeof BODY_VARIABLE_NAMES[number]
type DailyTemplateValues = Record<BodyVariableName, string>

function settingKey(context: PluginContext, name: string): string {
  return `${context.plugin.id}.${name}`
}

function readStringSetting(context: PluginContext, name: string, fallback: string): string {
  const value = context.settings.get(settingKey(context, name))
  return typeof value === 'string' ? value : fallback
}

function utf8Length(value: string): number {
  let length = 0
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0
    if (codePoint <= 0x7F) length += 1
    else if (codePoint <= 0x7FF) length += 2
    else if (codePoint <= 0xFFFF) length += 3
    else length += 4
  }
  return length
}

function assertNotCancelled(context: PluginContext): void {
  if (context.signal.aborted) {
    throw new PluginError('Cancelled', 'Daily Notes was cancelled')
  }
}

function templateError(message: string, pathTemplate: boolean): never {
  throw new PluginError(pathTemplate ? 'InvalidPath' : 'RuntimeFailure', message)
}

function renderTemplate<Name extends string>(
  template: string,
  values: Record<Name, string>,
  allowedNames: readonly Name[],
  options: { pathTemplate?: boolean } = {},
): string {
  const allowed = new Set<string>(allowedNames)
  const token = /\{\{([A-Za-z][A-Za-z0-9]*)\}\}/gu
  let result = ''
  let cursor = 0

  for (const match of template.matchAll(token)) {
    const index = match.index
    const literal = template.slice(cursor, index)
    if (literal.includes('{{') || literal.includes('}}')) {
      return templateError('Template contains a malformed variable', options.pathTemplate ?? false)
    }

    const name = match[1] as Name
    if (!allowed.has(name) || !Object.prototype.hasOwnProperty.call(values, name)) {
      return templateError(`Unknown template variable: ${name}`, options.pathTemplate ?? false)
    }
    result += literal + values[name]
    cursor = index + match[0].length
  }

  const remainder = template.slice(cursor)
  if (remainder.includes('{{') || remainder.includes('}}')) {
    return templateError('Template contains a malformed variable', options.pathTemplate ?? false)
  }
  return result + remainder
}

function asciiUppercase(value: string): string {
  return value.replace(/[a-z]/gu, (character) => character.toUpperCase())
}

function isWindowsReservedName(segment: string): boolean {
  const stem = asciiUppercase(segment.replace(/[. ]+$/gu, '').split('.')[0] ?? '')
  if (WINDOWS_RESERVED_STEMS.has(stem)) return true
  return ['COM', 'LPT'].some((prefix) => (
    stem.startsWith(prefix)
    && WINDOWS_RESERVED_PORT_SUFFIXES.has(stem.slice(prefix.length))
  ))
}

function assertPortableSegment(segment: string): void {
  if (!segment || segment === '.' || segment === '..') {
    throw new PluginError('InvalidPath', 'Daily note path contains an unsafe segment')
  }
  if (segment.endsWith('.') || segment.endsWith(' ')) {
    throw new PluginError('InvalidPath', 'Daily note path segments cannot end with a dot or space')
  }
  if (INVALID_PORTABLE_NAME_CHARACTER.test(segment)) {
    throw new PluginError('InvalidPath', 'Daily note path contains a character that is not portable')
  }
  if (isWindowsReservedName(segment)) {
    throw new PluginError('InvalidPath', `Daily note path uses a reserved file name: ${segment}`)
  }
  const lower = segment.toLowerCase()
  if (
    RESERVED_PATH_SEGMENTS.has(lower)
    || lower === '.env'
    || lower.startsWith('.env.')
  ) {
    throw new PluginError('InvalidPath', `Daily note path uses a reserved segment: ${segment}`)
  }
  if (utf8Length(segment) > MAX_PATH_SEGMENT_BYTES) {
    throw new PluginError('InvalidPath', 'A daily note path segment is too long')
  }
}

function validateDailyNotePath(value: string): string {
  const normalized = value
    .normalize('NFC')
    .trim()
    .replace(/\\/gu, '/')
    .replace(/\/+/gu, '/')
  if (!normalized || normalized.startsWith('/') || /^[A-Za-z]:\//u.test(normalized)) {
    throw new PluginError('InvalidPath', 'Daily note path must be relative to the workspace')
  }
  if (utf8Length(normalized) > MAX_PATH_BYTES) {
    throw new PluginError('InvalidPath', 'Daily note path is too long')
  }

  const segments = normalized.split('/')
  if (segments.length > MAX_PATH_DEPTH) {
    throw new PluginError('InvalidPath', 'Daily note path is nested too deeply')
  }
  segments.forEach(assertPortableSegment)
  if (!/\.md$/iu.test(segments[segments.length - 1])) {
    throw new PluginError('InvalidPath', 'Daily note file name must end in .md')
  }
  return segments.join('/')
}

function validateTemplateFilePath(value: string): string {
  return validateDailyNotePath(value)
}

function parseLogicalDate(day: ResolvedDay): Pick<DailyTemplateValues, 'date' | 'year' | 'month' | 'day'> {
  const match = day.logicalDate.match(/^(\d{4})-(\d{2})-(\d{2})$/u)
  if (!match) {
    throw new PluginError('RuntimeFailure', 'The host returned an invalid logical date')
  }
  return {
    date: day.logicalDate,
    year: match[1],
    month: match[2],
    day: match[3],
  }
}

function weekdayIndex(year: number, month: number, day: number): number {
  // Sakamoto's Gregorian algorithm avoids internationalization globals that
  // are outside the external plugin runtime contract.
  const offsets = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4]
  const adjustedYear = month < 3 ? year - 1 : year
  return (
    adjustedYear
    + Math.floor(adjustedYear / 4)
    - Math.floor(adjustedYear / 100)
    + Math.floor(adjustedYear / 400)
    + offsets[month - 1]
    + day
  ) % 7
}

function formatResolvedDay(
  context: PluginContext,
  day: ResolvedDay,
  dateValues: Pick<DailyTemplateValues, 'date' | 'year' | 'month' | 'day'>,
): Pick<DailyTemplateValues, 'dateLong' | 'weekday' | 'time'> {
  const timeMatch = day.localDateTime.match(/T(\d{2}):(\d{2})(?::\d{2})?$/u)
  if (!timeMatch) {
    throw new PluginError('RuntimeFailure', 'The host returned an invalid local date and time')
  }
  const year = Number(dateValues.year)
  const month = Number(dateValues.month)
  const date = Number(dateValues.day)
  const weekday = weekdayIndex(year, month, date)
  return {
    dateLong: context.i18n.t('template.dateLong', {
      ...dateValues,
      monthName: context.i18n.t(`month.${dateValues.month}`),
    }),
    weekday: context.i18n.t(`weekday.${weekday}`),
    time: `${timeMatch[1]}:${timeMatch[2]}`,
  }
}

function stablePathHash(value: string): string {
  let hash = 0x811C9DC5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function buildIdempotencyKey(logicalDate: string, path: string): string {
  return `daily:${logicalDate}:${stablePathHash(path.normalize('NFC'))}`
}

function pathsReferToSamePortableFile(left: string, right: string): boolean {
  return left.normalize('NFC').toLowerCase() === right.normalize('NFC').toLowerCase()
}

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/[\r\n]+/gu, ' ').slice(0, 240)
}

async function showNoticeSafely(context: PluginContext, message: string): Promise<void> {
  if (context.signal.aborted) return
  try {
    await context.ui.showNotice(message)
  } catch {
    // A notice failure must not change the outcome of the note operation.
  }
}

export const activate: PluginActivate = async (context) => {
  const commandId = `${context.plugin.id}.open-today`
  context.commands.handle(commandId, async () => {
    const noticeTitle = context.i18n.t('command.openToday.title')
    try {
      assertNotCancelled(context)
      const configuredTimeZone = readStringSetting(context, 'timeZone', 'system').trim()
      const folderTemplate = readStringSetting(context, 'folder', 'Daily/{{year}}/{{month}}')
      const fileNameTemplate = readStringSetting(context, 'fileName', '{{date}}.md')
      const configuredBodyTemplate = readStringSetting(context, 'bodyTemplate', '# {{dateLong}}\n\n')
      const templateFileSetting = readStringSetting(context, 'templateFile', '')
      if (!configuredTimeZone || configuredTimeZone.length > 100) {
        throw new PluginError('InvalidTimeZone', 'Daily Notes time zone is invalid')
      }
      const [workspace, resolvedDay] = await Promise.all([
        context.workspace.getCurrent(),
        context.calendar.resolveDay({
          timeZone: configuredTimeZone,
          dayStartsAt: '00:00',
        }),
      ])
      assertNotCancelled(context)

      const dateValues = parseLogicalDate(resolvedDay)
      const pathValues: Record<PathVariableName, string> = dateValues
      const folder = renderTemplate(
        folderTemplate,
        pathValues,
        PATH_VARIABLE_NAMES,
        { pathTemplate: true },
      )
      const fileName = renderTemplate(
        fileNameTemplate,
        pathValues,
        PATH_VARIABLE_NAMES,
        { pathTemplate: true },
      )
      if (!fileName || fileName.includes('/') || fileName.includes('\\')) {
        throw new PluginError('InvalidPath', 'Daily Notes file name cannot contain a directory')
      }
      const path = validateDailyNotePath(folder ? `${folder}/${fileName}` : fileName)

      let bodyTemplate = configuredBodyTemplate
      if (templateFileSetting) {
        const templatePath = validateTemplateFilePath(templateFileSetting)
        if (pathsReferToSamePortableFile(templatePath, path)) {
          throw new PluginError('Conflict', 'The daily note cannot use itself as its template')
        }
        const template = await context.notes.read({ path: templatePath })
        assertNotCancelled(context)
        if (utf8Length(template.content) > MAX_TEMPLATE_BYTES) {
          throw new PluginError('QuotaExceeded', 'The Daily Notes template is too large')
        }
        bodyTemplate = template.content
      } else if (utf8Length(bodyTemplate) > MAX_TEMPLATE_BYTES) {
        throw new PluginError('QuotaExceeded', 'The Daily Notes template is too large')
      }

      const title = fileName.replace(/\.md$/iu, '')
      const bodyValues: DailyTemplateValues = {
        ...dateValues,
        ...formatResolvedDay(context, resolvedDay, dateValues),
        title,
        path,
        workspaceName: workspace.name,
      }
      const initialContent = renderTemplate(
        bodyTemplate,
        bodyValues,
        BODY_VARIABLE_NAMES,
      )
      if (utf8Length(initialContent) > MAX_TEMPLATE_BYTES) {
        throw new PluginError('QuotaExceeded', 'The rendered Daily Notes template is too large')
      }

      assertNotCancelled(context)
      const result = await context.notes.openOrCreate({
        workspaceId: workspace.id,
        path,
        initialContent,
        conflict: 'open-existing',
        open: true,
        idempotencyKey: buildIdempotencyKey(resolvedDay.logicalDate, path),
      })
      assertNotCancelled(context)
      if (!result.opened) {
        throw new PluginError('CreatedNotOpened', 'The daily note exists but could not be opened', {
          result: { ...result },
        })
      }

      try {
        await context.storage.workspace.set('last-opened', {
          schemaVersion: 1,
          logicalDate: resolvedDay.logicalDate,
          path: result.path,
          status: result.status,
        })
      } catch {
        // The note operation succeeded; diagnostics storage is best effort.
      }
      await showNoticeSafely(context, `${noticeTitle}: ${result.path}`)
      return { ...result }
    } catch (error) {
      if (!context.signal.aborted) {
        await showNoticeSafely(context, `${noticeTitle}: ${safeErrorMessage(error)}`)
      }
      throw error
    }
  })
}
