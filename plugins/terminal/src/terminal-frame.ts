import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import './terminal-frame.css'
import { acceptEmbeddedFrameInit, createEmbeddedFrameSession, type PluginEmbeddedFrameSession } from '@notegen/plugin-api'

type Status = 'starting' | 'running' | 'ended' | 'error'

const labels = {
  en: {
    ended: 'Terminal ended', unavailable: 'Terminal permission is unavailable',
    invalidSession: 'Could not start the terminal session.',
  },
  zh: {
    ended: '终端已结束', unavailable: '没有获得终端权限',
    invalidSession: '无法启动终端会话。',
  },
  'zh-tw': {
    ended: '終端已結束', unavailable: '未取得終端權限',
    invalidSession: '無法啟動終端工作階段。',
  },
  ja: {
    ended: 'ターミナルが終了しました', unavailable: 'ターミナルの権限がありません',
    invalidSession: 'ターミナルを起動できませんでした。',
  },
  de: {
    ended: 'Terminal wurde beendet', unavailable: 'Terminalberechtigung fehlt',
    invalidSession: 'Die Terminalsitzung konnte nicht gestartet werden.',
  },
  'pt-br': {
    ended: 'Terminal encerrado', unavailable: 'Permissão do terminal indisponível',
    invalidSession: 'Não foi possível iniciar a sessão do terminal.',
  },
}

function localizedLabels(locale: string) {
  const normalized = locale.toLowerCase().replace('_', '-')
  if (normalized === 'zh-tw' || normalized === 'zh-hk') return labels['zh-tw']
  if (normalized.startsWith('zh')) return labels.zh
  if (normalized.startsWith('ja')) return labels.ja
  if (normalized.startsWith('de')) return labels.de
  if (normalized.startsWith('pt')) return labels['pt-br']
  return labels.en
}

function blendBackground(background: string, muted: string, mutedShare: number): string {
  const rgb = (value: string): number[] | undefined => {
    const hex = value.match(/^#([\da-f]{6})$/i)
    if (hex) return [0, 2, 4].map(index => Number.parseInt(hex[1].slice(index, index + 2), 16))
    if (!/^rgba?\(/i.test(value)) return undefined
    const channels = value.match(/\d+(?:\.\d+)?/g)?.slice(0, 3).map(Number)
    return channels?.length === 3 && channels.every(channel => channel >= 0 && channel <= 255) ? channels : undefined
  }
  const base = rgb(background)
  const tint = rgb(muted)
  if (!base || !tint) return background
  return `rgb(${base.map((channel, index) => Math.round(channel * (1 - mutedShare) + tint[index] * mutedShare)).join(', ')})`
}

let initialized = false
const frameToken = (window as Window & { __notegenFrameToken?: string }).__notegenFrameToken
window.addEventListener('message', event => {
  const accepted = acceptEmbeddedFrameInit(event, frameToken ?? '', window.parent)
  if (initialized || !accepted) return
  initialized = true
  const { init, port } = accepted
  const text = localizedLabels(init.locale)
  const canOpen = init.capabilities.includes('terminal')
  const root = document.createElement('main')
  root.className = 'terminal-root'
  const viewport = document.createElement('div')
  viewport.className = 'terminal-viewport'
  root.append(viewport)
  document.body.append(root)

  const terminal = new Terminal({
    cursorBlink: true, scrollback: 2000, screenReaderMode: true, fontSize: 13, lineHeight: 1.25,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Noto Sans Mono CJK SC", monospace',
  })
  const fit = new FitAddon()
  terminal.loadAddon(fit)
  terminal.open(viewport)
  fit.fit()
  let decoder = new TextDecoder()
  let status: Status = 'ended'
  let sessionId: string | undefined
  let inputQueue = Promise.resolve()
  let session: PluginEmbeddedFrameSession
  const request = (method: string, values: Record<string, unknown> = {}): Promise<unknown> => session.request(method, values)
  const setStatus = (next: Status, detail = '') => {
    status = next
    if (next === 'ended') terminal.writeln(`\r\n${text.ended}`)
    if (next === 'error') terminal.writeln(`\r\n${detail}`)
  }
  const dimensions = () => ({ cols: Math.max(2, Math.min(500, terminal.cols)), rows: Math.max(1, Math.min(200, terminal.rows)) })
  const start = async () => {
    if (!canOpen || status === 'starting') return
    setStatus('starting')
    if (sessionId) {
      const previous = sessionId
      sessionId = undefined
      await request('terminal.close', { sessionId: previous }).catch(() => undefined)
    }
    terminal.reset()
    decoder = new TextDecoder()
    try {
      const opened = await request('terminal.open', dimensions())
      if (typeof opened !== 'string') throw new Error(text.invalidSession)
      sessionId = opened
      setStatus('running')
      terminal.focus()
    } catch (error) {
      setStatus('error', String(error))
    }
  }
  const applyTheme = (value: unknown, fallbackBackground?: unknown, fallbackForeground?: unknown) => {
    const theme = value && typeof value === 'object' ? value as Record<string, unknown> : {}
    const color = (name: string, fallback: string) => typeof theme[name] === 'string' && CSS.supports('color', theme[name] as string)
      ? theme[name] as string : fallback
    const background = color('background', typeof fallbackBackground === 'string' ? fallbackBackground : '#fff')
    const foreground = color('foreground', typeof fallbackForeground === 'string' ? fallbackForeground : '#171717')
    const primary = color('primary', foreground)
    const muted = color('muted', background)
    const terminalBackground = blendBackground(background, muted, theme.colorScheme === 'dark' ? 0.24 : 0.58)
    const rootStyle = document.documentElement.style
    rootStyle.setProperty('--terminal-bg', terminalBackground)
    rootStyle.setProperty('--terminal-fg', foreground)
    rootStyle.setProperty('--terminal-primary', primary)
    rootStyle.setProperty('--terminal-muted', muted)
    rootStyle.setProperty('--terminal-muted-fg', color('mutedForeground', foreground))
    rootStyle.setProperty('--terminal-border', color('border', foreground))
    rootStyle.setProperty('--terminal-error', color('destructive', foreground))
    if (theme.colorScheme === 'light' || theme.colorScheme === 'dark') rootStyle.colorScheme = theme.colorScheme
    if (typeof theme.fontFamily === 'string' && theme.fontFamily.length < 500) rootStyle.setProperty('--terminal-ui-font', theme.fontFamily)
    if (typeof theme.rootFontSize === 'string' && /^\d+(?:\.\d+)?px$/.test(theme.rootFontSize)) {
      const size = Number.parseFloat(theme.rootFontSize)
      if (size >= 10 && size <= 32) {
        rootStyle.fontSize = theme.rootFontSize
      }
    }
    terminal.options.theme = { background: terminalBackground, foreground, cursor: primary, cursorAccent: terminalBackground,
      selectionBackground: muted, selectionForeground: foreground }
    fit.fit()
  }
  const applySettings = (value: unknown) => {
    const settings = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
    const get = (name: string) => settings[`top.notegen.terminal.${name}`]
    const number = (name: string, fallback: number, min: number, max: number) => {
      const value = get(name)
      return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : fallback
    }
    const font = get('fontFamily')
    terminal.options.fontFamily = font === 'menlo'
      ? 'Menlo, Monaco, Consolas, "Noto Sans Mono CJK SC", monospace'
      : font === 'monospace' ? 'monospace'
        : 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Noto Sans Mono CJK SC", monospace'
    terminal.options.fontSize = number('fontSize', 13, 10, 24)
    terminal.options.lineHeight = number('lineHeight', 1.25, 1, 2)
    const cursorStyle = get('cursorStyle')
    terminal.options.cursorStyle = cursorStyle === 'underline' || cursorStyle === 'bar' ? cursorStyle : 'block'
    terminal.options.cursorBlink = get('cursorBlink') !== false
    terminal.options.scrollback = Math.round(number('scrollback', 2000, 100, 20000))
    terminal.options.scrollSensitivity = number('scrollSensitivity', 1, 0.25, 4)
    terminal.options.rightClickSelectsWord = get('rightClickSelectsWord') === true
    fit.fit()
    if (status === 'running' && sessionId) void request('terminal.resize', { sessionId, ...dimensions() }).catch(() => undefined)
  }
  terminal.onData(data => {
    if (status !== 'running' || !sessionId) return
    const current = sessionId
    inputQueue = inputQueue.then(() => request('terminal.write', { sessionId: current, data })).then(() => undefined)
      .catch(error => { if (sessionId === current) setStatus('error', String(error)) })
  })
  const observer = new ResizeObserver(() => {
    fit.fit()
    if (status === 'running' && sessionId) void request('terminal.resize', { sessionId, ...dimensions() }).catch(() => undefined)
  })
  observer.observe(viewport)
  session = createEmbeddedFrameSession(port, {
    onTheme: applyTheme,
    onSettings: applySettings,
    onEvent: data => {
    if (data.type === 'terminal.closed' && data.sessionId === sessionId) { sessionId = undefined; setStatus('ended'); return }
    if (data.type === 'terminal.output' && data.sessionId === sessionId && typeof data.data === 'string') {
      const bytes = Uint8Array.from(atob(data.data), character => character.charCodeAt(0))
      terminal.write(decoder.decode(bytes, { stream: true }))
    }
    },
  })
  window.addEventListener('pagehide', () => {
    observer.disconnect()
    session.dispose()
    terminal.dispose()
  }, { once: true })
  applyTheme(init.theme, init.background, init.foreground)
  applySettings(init.settings)
  session.ready()
  if (canOpen) void start()
  else setStatus('error', text.unavailable)
})
