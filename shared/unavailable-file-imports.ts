/** Browser-only Nomnoml bundles must never invoke the upstream CLI file loader. */
function unavailable(): never {
  throw new Error('Filesystem imports are unavailable in offline code-block previews')
}

export const readFileSync = unavailable
export const resolve = unavailable
export const dirname = unavailable
export const basename = unavailable
export const join = unavailable
