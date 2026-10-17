// Maintainer-only bundling. Never executed at install or while rendering a note.
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(join(root, 'package.json'))
const packageRoot = dirname(require.resolve('@plantuml/core/package.json'))
await mkdir(join(root, 'dist'), { recursive: true })
await build({ absWorkingDir: root, entryPoints: ['src/renderer.ts'], outfile: 'dist/renderer.js', bundle: true, format: 'iife', platform: 'browser', target: 'es2022', minify: true, legalComments: 'inline' })
for (const asset of ['plantuml.js', 'viz-global.js', 'themes.js', 'emoji.js', 'openiconic.js']) await copyFile(join(packageRoot, asset), join(root, 'dist', asset))
const license = await readFile(join(packageRoot, 'LICENSE'), 'utf8')
await writeFile(join(root, 'dist', 'THIRD-PARTY-NOTICES.txt'), `@plantuml/core 1.2026.9 (MIT), including its bundled Viz.js/Graphviz engine and resources.\nUpstream: https://github.com/plantuml/plantuml\nOriginal license and component notices follow.\n\n${license}`)
