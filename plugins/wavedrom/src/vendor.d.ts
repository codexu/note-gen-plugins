declare module 'wavedrom-render-any' {
  const renderAny: (index: number, source: Record<string, unknown>, skin: unknown) => unknown
  export default renderAny
}
declare module 'wavedrom/skins/default.js' {
  const skin: unknown
  export default skin
}
declare module 'onml/stringify.js' {
  const stringify: (value: unknown) => string
  export default stringify
}
