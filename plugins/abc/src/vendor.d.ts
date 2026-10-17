declare module 'abcjs/src/api/abc_tunebook_svg' {
  import type { AbcVisualParams, TuneObjectArray } from 'abcjs'
  const renderAbc: (target: HTMLElement, source: string, options?: AbcVisualParams) => TuneObjectArray
  export default renderAbc
}
