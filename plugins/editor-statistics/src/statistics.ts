import MarkdownIt from 'markdown-it'
import GraphemerImport from 'graphemer'

export type MarkdownEditorStatistics = {
  characters: number
  charactersWithWhitespace: number
  charactersWithoutWhitespace: number
  words: number
  nonCjkWords: number
  cjkCharacters: number
  readingMinutes: number
  codeBlocks: number
  codeLines: number
  hasReadableText: boolean
}

interface MarkdownToken {
  type: string
  content: string
  children: MarkdownToken[] | null
  markup?: string
}

interface MarkdownInlineState {
  readonly src: string
  pos: number
  readonly posMax: number
  push(type: string, tag: string, nesting: number): MarkdownToken
}

interface ExtractedMarkdownText {
  characterText: string
  readableText: string
  codeBlocks: number
  codeLines: number
}

interface InlineText {
  characterText: string
  readableText: string
}

const markdownParser = new MarkdownIt({
  html: true,
  linkify: false,
  typographer: false,
})
// Graphemer 1.x publishes transpiled CommonJS. In a type:module project,
// esbuild follows Node's default-import behavior and may return the exports
// object instead of its default constructor; other bundlers return the class.
const GraphemerConstructor = typeof GraphemerImport === 'function'
  ? GraphemerImport
  : (GraphemerImport as unknown as { default: typeof GraphemerImport }).default
const graphemeSplitter = new GraphemerConstructor()
// Consume math while Markdown source escapes and token boundaries are still intact.
markdownParser.inline.ruler.before('escape', 'notegen_math', tokenizeInlineMath)

const CJK_SCRIPT_CHARACTER = /[\p{Script_Extensions=Han}\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}\p{Script_Extensions=Hangul}]/u
const WORD_CHARACTER = /[\p{L}\p{N}]/u
const FALLBACK_WORD = /[\p{L}\p{N}]+(?:['’_-][\p{L}\p{N}]+)*/gu
const URL = /\b(?:[a-z][a-z\d+.-]*:\/\/|www\.)[^\s<>{}\[\]]+/giu
const HTML_BLOCK_SEPARATOR = /<\/?(?:address|article|aside|blockquote|br|dd|div|dl|dt|figcaption|figure|footer|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|table|tbody|td|tfoot|th|thead|tr|ul)\b[^>]*>/giu
const NBSP_PLACEHOLDER = /^(?:(?:&nbsp;|&#160;|&#x0*a0;)\s*)+$/iu

function normalizeLineEndings(value: string): string {
  return value.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
}

function stripFrontmatter(markdown: string): string {
  const lines = markdown.split('\n')
  if (lines[0]?.trim() !== '---') return markdown

  const closingIndex = lines.findIndex((line, index) => (
    index > 0 && (line.trim() === '---' || line.trim() === '...')
  ))
  if (closingIndex < 0) return markdown

  return lines.slice(closingIndex + 1).join('\n')
}

function isEscaped(value: string, index: number): boolean {
  let slashes = 0
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === '\\'; cursor -= 1) {
    slashes += 1
  }
  return slashes % 2 === 1
}

function findUnescaped(
  value: string,
  needle: string,
  start: number,
  end = value.length,
): number {
  let cursor = value.indexOf(needle, start)
  while (cursor >= 0 && cursor + needle.length <= end) {
    if (!isEscaped(value, cursor)) return cursor
    cursor = value.indexOf(needle, cursor + needle.length)
  }
  return -1
}

function tokenizeInlineMath(state: MarkdownInlineState, silent: boolean): boolean {
  const start = state.pos
  let opening: '$' | '$$' | '\\(' | '\\['
  let closing: '$' | '$$' | '\\)' | '\\]'

  if (state.src.startsWith('\\(', start)) {
    opening = '\\('
    closing = '\\)'
  } else if (state.src.startsWith('\\[', start)) {
    opening = '\\['
    closing = '\\]'
  } else if (state.src.startsWith('$$', start)) {
    opening = '$$'
    closing = '$$'
  } else if (state.src[start] === '$') {
    opening = '$'
    closing = '$'
  } else {
    return false
  }

  const closingIndex = findUnescaped(
    state.src,
    closing,
    start + opening.length,
    state.posMax,
  )
  if (closingIndex < 0 || (opening === '$' && closingIndex === start + 1)) {
    return false
  }

  if (!silent) {
    const token = state.push('math_inline', '', 0)
    token.markup = opening
    token.content = state.src.slice(start + opening.length, closingIndex)
  }
  state.pos = closingIndex + closing.length
  return true
}

function stripPlainTextMath(value: string, replacement = ''): string {
  let result = ''
  let cursor = 0
  while (cursor < value.length) {
    const twoCharacters = value.slice(cursor, cursor + 2)
    let opening: '$' | '$$' | '\\(' | '\\[' | null = null
    let closing: '$' | '$$' | '\\)' | '\\]' | null = null
    if (!isEscaped(value, cursor) && (twoCharacters === '\\(' || twoCharacters === '\\[')) {
      opening = twoCharacters
      closing = twoCharacters === '\\(' ? '\\)' : '\\]'
    } else if (!isEscaped(value, cursor) && twoCharacters === '$$') {
      opening = '$$'
      closing = '$$'
    } else if (
      value[cursor] === '$'
      && !isEscaped(value, cursor)
      && value[cursor + 1] !== '$'
    ) {
      opening = '$'
      closing = '$'
    }

    if (opening && closing) {
      const closingIndex = findUnescaped(value, closing, cursor + opening.length)
      if (closingIndex >= cursor + opening.length + (opening === '$' ? 1 : 0)) {
        result += replacement
        cursor = closingIndex + closing.length
        continue
      }
    }
    result += value[cursor]
    cursor += 1
  }
  return result
}

function stripBlockMath(markdown: string): string {
  const lines = markdown.split('\n')
  let fence: { marker: '`' | '~'; length: number } | null = null
  let mathCloser: '$$' | '\\]' | null = null

  return lines.map((line) => {
    if (fence) {
      const closingFence = line.match(/^ {0,3}(`{3,}|~{3,})\s*$/u)
      if (
        closingFence
        && closingFence[1][0] === fence.marker
        && closingFence[1].length >= fence.length
      ) {
        fence = null
      }
      return line
    }

    const openingFence = line.match(/^ {0,3}(`{3,}|~{3,})/u)
    if (openingFence) {
      const run = openingFence[1]
      fence = { marker: run[0] as '`' | '~', length: run.length }
      return line
    }

    if (mathCloser) {
      if (findUnescaped(line, mathCloser, 0) >= 0) mathCloser = null
      return ''
    }

    if (/^ {4}/u.test(line)) return line
    const trimmed = line.trim()
    if (trimmed.startsWith('$$')) {
      if (findUnescaped(trimmed, '$$', 2) < 0) mathCloser = '$$'
      return ''
    }
    if (trimmed.startsWith('\\[')) {
      if (findUnescaped(trimmed, '\\]', 2) < 0) mathCloser = '\\]'
      return ''
    }
    return line
  }).join('\n')
}

function prepareMarkdownForStatistics(markdown: string): string {
  return stripBlockMath(stripFrontmatter(normalizeLineEndings(markdown)))
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      const paragraphBody = trimmed
        .replace(/^<p(?:\s[^>]*)?>\s*/iu, '')
        .replace(/\s*<\/p>$/iu, '')
      return NBSP_PLACEHOLDER.test(paragraphBody) ? '' : line
    })
    .join('\n')
}

function trailingUrlPunctuation(value: string): string {
  const match = value.match(/[.,!?;:'"’”»）。。，！？；：]+$/u)
  return match?.[0] ?? ''
}

function stripUrls(value: string, replacement = ''): string {
  return value.replace(URL, (url) => replacement + trailingUrlPunctuation(url))
}

function decodeHtmlEntities(value: string): string {
  return markdownParser.utils.unescapeAll(value)
}

function htmlToVisibleText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<!--[\s\S]*?(?:-->|$)/gu, '')
      .replace(/<(script|style)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/giu, '')
      .replace(HTML_BLOCK_SEPARATOR, '\n')
      .replace(/<[^>]*>/gu, ''),
  )
}

function appendText(current: string, next: string): string {
  if (!next) return current
  if (!current) return next
  if (current.endsWith('\n') || next.startsWith('\n')) return current + next
  return `${current}\n${next}`
}

function isCjkGrapheme(value: string): boolean {
  return CJK_SCRIPT_CHARACTER.test(value) && WORD_CHARACTER.test(value)
}

function sanitizeCharacterText(value: string, preserveUrls = false): string {
  return preserveUrls ? value : stripUrls(value)
}

function sanitizeReadableText(value: string, preserveUrls = false): string {
  return preserveUrls ? value : stripUrls(value, ' ')
}

function sanitizeHtmlCharacterText(value: string, preserveUrls = false): string {
  const withoutMath = stripPlainTextMath(value)
  return preserveUrls ? withoutMath : stripUrls(withoutMath)
}

function sanitizeHtmlReadableText(value: string, preserveUrls = false): string {
  const withoutMath = stripPlainTextMath(value, ' ')
  return preserveUrls ? withoutMath : stripUrls(withoutMath, ' ')
}

function extractImageAlt(token: MarkdownToken): string {
  const children = token.children ?? []
  const childText = children
    .map((child) => {
      if (
        child.type === 'text'
        || child.type === 'text_special'
        || child.type === 'code_inline'
      ) {
        return child.content
      }
      if (child.type === 'softbreak' || child.type === 'hardbreak') return '\n'
      if (child.type === 'html_inline') return htmlToVisibleText(child.content)
      return ''
    })
    .join('')
  return childText || token.content
}

function extractInlineText(tokens: MarkdownToken[], statisticsMode: boolean): InlineText {
  let characterText = ''
  let readableText = ''
  let ignoredHtmlTag: 'script' | 'style' | null = null
  const countedLinkStack: boolean[] = []

  for (const token of tokens) {
    if (token.type === 'link_open') {
      countedLinkStack.push(token.markup !== 'autolink')
      continue
    }
    if (token.type === 'link_close') {
      countedLinkStack.pop()
      continue
    }

    const preserveUrls = countedLinkStack[countedLinkStack.length - 1] ?? false
    if (token.type === 'html_inline') {
      const lower = token.content.toLowerCase()
      if (ignoredHtmlTag) {
        if (lower.includes(`</${ignoredHtmlTag}`)) ignoredHtmlTag = null
        continue
      }
      const ignoredTagMatch = lower.match(/<(script|style)\b/u)
      if (ignoredTagMatch && !lower.includes(`</${ignoredTagMatch[1]}`)) {
        ignoredHtmlTag = ignoredTagMatch[1] as 'script' | 'style'
        continue
      }
      const visible = htmlToVisibleText(token.content)
      characterText += statisticsMode ? sanitizeHtmlCharacterText(visible, preserveUrls) : visible
      readableText += statisticsMode ? sanitizeHtmlReadableText(visible, preserveUrls) : visible
      continue
    }
    if (ignoredHtmlTag) continue

    if (token.type === 'math_inline') {
      // Keep neighboring prose as separate words without counting the formula.
      readableText += ' '
      continue
    }

    if (token.type === 'text' || token.type === 'text_special') {
      characterText += statisticsMode
        ? sanitizeCharacterText(token.content, preserveUrls)
        : token.content
      readableText += statisticsMode
        ? sanitizeReadableText(token.content, preserveUrls)
        : token.content
    } else if (token.type === 'code_inline') {
      characterText += token.content
      readableText += statisticsMode ? ' ' : token.content
    } else if (token.type === 'image') {
      const alt = extractImageAlt(token)
      characterText += statisticsMode ? sanitizeCharacterText(alt, true) : alt
      readableText += statisticsMode ? sanitizeReadableText(alt, true) : alt
    } else if (token.type === 'softbreak' || token.type === 'hardbreak') {
      characterText += '\n'
      readableText += '\n'
    }
  }

  return { characterText, readableText }
}

function countCodeLines(content: string): number {
  const normalized = normalizeLineEndings(content)
  const withoutTrailingLineBreak = normalized.endsWith('\n') ? normalized.slice(0, -1) : normalized
  return withoutTrailingLineBreak ? withoutTrailingLineBreak.split('\n').length : 0
}

function extractMarkdownText(
  markdown: string,
  options: { includeCodeBlocks: boolean },
): ExtractedMarkdownText {
  const source = prepareMarkdownForStatistics(markdown)
  const tokens = markdownParser.parse(source, {}) as unknown as MarkdownToken[]
  let characterText = ''
  let readableText = ''
  let codeBlocks = 0
  let codeLines = 0
  let listItemDepth = 0

  for (const token of tokens) {
    if (token.type === 'list_item_open') {
      listItemDepth += 1
      continue
    }
    if (token.type === 'list_item_close') {
      listItemDepth = Math.max(0, listItemDepth - 1)
      continue
    }
    if (token.type === 'fence' || token.type === 'code_block') {
      codeBlocks += 1
      codeLines += countCodeLines(token.content)
      if (options.includeCodeBlocks) {
        characterText = appendText(characterText, token.content.replace(/\n$/u, ''))
      }
      continue
    }
    if (token.type === 'math_block' || token.type === 'math_inline') continue

    if (token.type === 'inline') {
      const inline = extractInlineText(token.children ?? [], true)
      const characterInline = listItemDepth > 0
        ? inline.characterText.replace(/^\[[ xX]\](?:\s+|$)/u, '')
        : inline.characterText
      const readableInline = listItemDepth > 0
        ? inline.readableText.replace(/^\[[ xX]\](?:\s+|$)/u, '')
        : inline.readableText
      characterText = appendText(characterText, characterInline)
      readableText = appendText(readableText, readableInline)
      continue
    }

    if (token.type === 'html_block') {
      const visible = htmlToVisibleText(token.content)
      characterText = appendText(characterText, sanitizeHtmlCharacterText(visible))
      readableText = appendText(readableText, sanitizeHtmlReadableText(visible))
    }
  }

  return { characterText, readableText, codeBlocks, codeLines }
}

function graphemeSegments(value: string): string[] {
  return graphemeSplitter.splitGraphemes(value)
}

function countNonCjkWords(value: string): number {
  const withoutCjk = graphemeSegments(value)
    .map((segment) => isCjkGrapheme(segment) ? ' ' : segment)
    .join('')

  return withoutCjk.match(FALLBACK_WORD)?.length ?? 0
}

export function getEditorStatistics(
  markdown: string,
  options: { includeCodeBlocks?: boolean } = {},
): MarkdownEditorStatistics {
  const extracted = extractMarkdownText(markdown, {
    includeCodeBlocks: options.includeCodeBlocks ?? false,
  })
  const characterSegments = graphemeSegments(extracted.characterText)
  const readableSegments = graphemeSegments(extracted.readableText)
  let legacyStart = 0
  let legacyEnd = characterSegments.length
  while (legacyStart < legacyEnd && /^\s+$/u.test(characterSegments[legacyStart])) legacyStart += 1
  while (legacyEnd > legacyStart && /^\s+$/u.test(characterSegments[legacyEnd - 1])) legacyEnd -= 1
  const legacyCharacters = legacyEnd - legacyStart
  const charactersWithWhitespace = characterSegments.length
  const charactersWithoutWhitespace = characterSegments.filter((segment) => !/^\s+$/u.test(segment)).length
  const cjkCharacters = readableSegments.filter(isCjkGrapheme).length
  const nonCjkWords = countNonCjkWords(extracted.readableText)
  const hasReadableText = cjkCharacters > 0 || nonCjkWords > 0
  const readingMinutes = hasReadableText
    ? Math.max(1, Math.ceil((cjkCharacters / 300) + (nonCjkWords / 200)))
    : 0

  return {
    characters: legacyCharacters,
    charactersWithWhitespace,
    charactersWithoutWhitespace,
    words: nonCjkWords,
    nonCjkWords,
    cjkCharacters,
    readingMinutes,
    codeBlocks: extracted.codeBlocks,
    codeLines: extracted.codeLines,
    hasReadableText,
  }
}
