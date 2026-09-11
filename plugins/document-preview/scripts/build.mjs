// Maintainer-only build. NoteGen users receive the complete archive.
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(join(root, 'package.json'));
const ownPackage = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const out = join(root, 'dist');
await mkdir(out, { recursive: true });
const results = [];
for (const entry of ['preview', 'pdf', 'docx', 'xlsx', 'xlsx.worker', 'pptx']) {
  results.push(await build({
    absWorkingDir: root, entryPoints: [`src/${entry}.js`], outfile: `dist/${entry}.js`,
    bundle: true, format: 'iife', platform: 'browser', target: ['es2022'],
    globalName: ['pdf', 'docx', 'xlsx', 'pptx'].includes(entry) ? 'NoteGenPreviewRenderer' : undefined,
    minify: true, legalComments: 'inline', metafile: true, loader: { '.css': 'text' },
  }));
}
const pdfRoot = dirname(require.resolve('pdfjs-dist/package.json'));
// A classic worker also works in Chromium's opaque iframe origins, where a
// module worker may fail its module fetch. Bundle the upstream worker locally.
results.push(await build({
  absWorkingDir: root, entryPoints: [join(pdfRoot, 'build/pdf.worker.mjs')],
  outfile: 'dist/pdf.worker.mjs', bundle: true, format: 'iife',
  platform: 'browser', target: ['es2022'], minify: true,
  legalComments: 'inline', metafile: true,
}));
const support = {};
for (const folder of ['cmaps', 'standard_fonts']) {
  for (const name of (await readdir(join(pdfRoot, folder))).sort()) {
    if (/\.(bcmap|pfb|ttf|otf)$/.test(name)) support[`${folder}/${name}`] = (await readFile(join(pdfRoot, folder, name))).toString('base64');
  }
}
await writeFile(join(out, 'pdf-support.json'), JSON.stringify(support));

// Carry upstream notices for all bundled inputs, including transitive packages.
const packageRoots = new Set([pdfRoot]);
for (const result of results) {
  for (const input of Object.keys(result.metafile.inputs)) {
    let directory = dirname(resolve(root, input));
    while (directory !== dirname(directory)) {
      try {
        const pkg = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
        // The plugin itself is not a third-party notice. Bundle inputs can
        // resolve through its own package.json when esbuild reports relative
        // source paths, so exclude the exact project root explicitly.
        if (directory !== root && pkg.name && pkg.name !== ownPackage.name) packageRoots.add(directory);
        break;
      } catch { directory = dirname(directory); }
    }
  }
}
const notices = ['NoteGen Document Preview — third-party notices\nRenderer dependencies are included in the plugin, not in NoteGen.'];
for (const directory of [...packageRoots].sort()) {
  const pkg = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
  notices.push(`\n=== ${pkg.name} ${pkg.version} (${pkg.license || 'see notice'}) ===\n`);
  const candidates = (await readdir(directory)).filter(name => /^(license|licence|copying|notice)(\.|$)/i.test(name));
  if (!candidates.length) throw new Error(`Missing redistribution notice for ${pkg.name}`);
  for (const name of candidates.sort()) {
    if ((await stat(join(directory, name))).isFile()) notices.push(await readFile(join(directory, name), 'utf8'));
  }
}
for (const folder of ['cmaps', 'standard_fonts']) {
  for (const name of (await readdir(join(pdfRoot, folder))).filter(name => /license|notice/i.test(name)).sort()) {
    notices.push(`\n=== PDF.js ${folder}/${name} ===\n`, await readFile(join(pdfRoot, folder, name), 'utf8'));
  }
}
await writeFile(join(out, 'THIRD-PARTY-NOTICES.txt'), notices.join('\n'));
// Fail packaging before invoking the SDK when the public resource cap is exceeded.
const manifest = JSON.parse(await readFile(join(root, 'plugin.json'), 'utf8'));
for (const preview of manifest.resources.documentPreviews) {
  for (const name of [preview.script, ...preview.assets]) {
    if ((await stat(join(root, name))).size > 5 * 1048576) throw new Error(`Resource exceeds 5 MiB: ${name}`);
  }
}
