// Maintainer-only build entry. This is never invoked by installing a plugin.
import { build, type BuildOptions } from 'esbuild'
import { createRequire } from 'node:module'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { brotliDecompressSync, gzipSync } from 'node:zlib'

const root = process.cwd()
const require = createRequire(join(root, 'package.json'))
const manifest = JSON.parse(await readFile(join(root, 'plugin.json'), 'utf8')) as { id: string }
const slug = manifest.id.split('.').at(-1)
const options: BuildOptions = { absWorkingDir: root, bundle: true, platform: 'browser', target: 'es2022', minify: true, legalComments: 'inline', metafile: true, define: { 'process.env.NODE_ENV': '"production"' }, loader: { '.css': 'text' } }
const d2Directory = slug === 'd2' ? resolve(dirname(require.resolve('@terrastruct/d2')), '../node-esm') : null
const alias = d2Directory ? { 'd2-go-runtime': join(d2Directory, 'wasm_exec.js') } : slug === 'wavedrom'
  ? { 'wavedrom-render-any': join(dirname(require.resolve('wavedrom/package.json')), 'lib/render-any.js') }
  : slug === 'nomnoml' ? { fs: resolve(root, '../../renderers/unavailable-file-imports.ts'), path: resolve(root, '../../renderers/unavailable-file-imports.ts') }
  : undefined
await mkdir(join(root, 'dist'), { recursive: true })
if (d2Directory) {
  const wasm = await readFile(join(d2Directory, 'd2.wasm'))
  const dagre = await readFile(join(root, 'vendor/dagre.js.br'))
  const setup = await readFile(join(root, 'vendor/setup.txt'), 'utf8')
  if (!wasm.includes(dagre) || !wasm.includes(Buffer.from(setup))) throw new Error('D2 layout bridge does not match the pinned WASM; review upstream commands before upgrading')
  const dagreSource = brotliDecompressSync(dagre).toString('utf8')
  options.define = { ...options.define, __D2_DAGRE_SOURCE__: JSON.stringify(dagreSource), __D2_SETUP_SOURCE__: JSON.stringify(setup) }
  options.plugins = [{ name: 'static-d2-dagre', setup(builder) {
    builder.onResolve({ filter: /^d2-dagre-runtime$/ }, () => ({ path: 'dagre', namespace: 'static-d2-dagre' }))
    builder.onLoad({ filter: /.*/, namespace: 'static-d2-dagre' }, () => ({ contents: dagreSource, loader: 'js' }))
  } }]
  const compressed = gzipSync(wasm, { level: 9 })
  const chunkBytes = 4 * 1024 * 1024
  if (compressed.length > chunkBytes * 2) throw new Error('Pinned D2 engine exceeds its two declared resource chunks')
  for (let index = 0; index < 2; index++) await writeFile(join(root, `dist/d2-wasm-${index}.bin`), compressed.subarray(index * chunkBytes, (index + 1) * chunkBytes))
}
const results = [
  await build({ ...options, entryPoints: ['src/renderer.ts'], outfile: 'dist/renderer.js', format: 'iife' }),
  await build({ ...options, entryPoints: ['src/engine.ts'], outfile: 'dist/engine.js', format: 'esm', alias }),
]
if (slug === 'excalidraw') {
  const source = await readFile(join(root, 'dist/engine.js'))
  if (source.length > 32 * 1024 * 1024) throw new Error('Excalidraw module exceeds its decompressed size limit')
  const compressed = gzipSync(source, { level: 9 })
  const chunkBytes = 4 * 1024 * 1024
  if (compressed.length > chunkBytes * 4) throw new Error('Excalidraw module exceeds its four declared resource chunks')
  for (let index = 0; index < 4; index++) await writeFile(join(root, `dist/engine-${index}.bin`), compressed.subarray(index * chunkBytes, (index + 1) * chunkBytes))
}
// Every renderer asset must fit the unchanged host/SDK resource protocol.
for (const result of results) for (const [path, output] of Object.entries(result.metafile!.outputs)) {
  if (output.bytes > 5 * 1024 * 1024 && !(slug === 'excalidraw' && path.endsWith('dist/engine.js'))) throw new Error(`${path} exceeds the renderer asset limit`)
}
const packageRoots = new Set<string>()
for (const result of results) for (const input of Object.keys(result.metafile!.inputs)) {
  if (!input.includes('node_modules/')) continue
  let directory = dirname(resolve(root, input))
  while (directory !== dirname(directory)) {
    try {
      const metadata = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')) as { name?: string }
      if (metadata.name) { packageRoots.add(directory); break }
    } catch { /* Continue past directories without a package manifest. */ }
    directory = dirname(directory)
  }
}
const notices = ['Bundled dependencies and original license notices.\nPlugin adapters: GPL-3.0-or-later.\n']
for (const directory of [...packageRoots].sort()) {
  const metadata = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')) as { name: string; version: string; license?: unknown }
  notices.push(`\n--- ${metadata.name}@${metadata.version} (${String(metadata.license ?? 'see notices')}) ---\n`)
  const files = (await readdir(directory, { withFileTypes: true })).filter(file => file.isFile() && /^(licen[sc]e|copying|notice)(?:[.-]|$)/i.test(file.name)).map(file => file.name)
  // Viz.js does not ship LICENSE in its npm tarball; keep pinned source notices
  // for Viz.js and its embedded Graphviz/Expat in this plugin's notices folder.
  if (!files.length) {
    const supplemental = slug === 'graphviz' && metadata.name === '@viz-js/viz' ? 'viz-js.txt'
      : slug === 'd2' && metadata.name === '@terrastruct/d2' ? 'd2.txt'
      : slug === 'vega' && metadata.name === 'vega-lite' ? 'vega-lite.txt'
      : slug === 'vega' && (metadata.name === 'vega' || metadata.name.startsWith('vega-')) ? 'vega.txt' : null
    const upstreamLicense = supplemental ?? (slug === 'excalidraw' && metadata.name === '@excalidraw/utils' ? 'excalidraw.txt' : null)
    if (!upstreamLicense) throw new Error(`No license file found for bundled dependency ${metadata.name}`)
    notices.push(await readFile(join(root, 'notices', upstreamLicense), 'utf8'))
  }
  for (const file of files) notices.push(await readFile(join(directory, file), 'utf8'))
}
if (slug === 'graphviz') for (const file of ['viz-js.txt', 'graphviz.txt', 'expat.txt']) {
  notices.push(await readFile(join(root, 'notices', file), 'utf8'))
}
if (slug === 'd2') for (const file of ['d2.txt', 'go.txt', 'dagre.txt']) notices.push(await readFile(join(root, 'notices', file), 'utf8'))
await writeFile(join(root, 'dist/THIRD-PARTY-NOTICES.txt'), notices.join('\n'))
