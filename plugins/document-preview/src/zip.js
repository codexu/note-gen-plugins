// Inspect ZIP metadata before an Office parser inflates content. This is a
// conservative admission limit, not an OS memory quota or a full ZIP validator.
export function inspectOfficeZip(bytes, kind) {
  const fail = () => { throw new Error('Invalid, encrypted, ZIP64 or oversized Office package / Office 文件损坏、加密或超出限制'); };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 22 || view.getUint32(0, true) !== 0x04034b50) fail();
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { end = i; break; }
  }
  if (end < 0 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) fail();
  const count = view.getUint16(end + 10, true);
  const size = view.getUint32(end + 12, true);
  let at = view.getUint32(end + 16, true);
  if (count > 4096 || count !== view.getUint16(end + 8, true) || at + size !== end) fail();
  let total = 0;
  const names = new Set();
  const decoder = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (at + 46 > end || view.getUint32(at, true) !== 0x02014b50) fail();
    const flags = view.getUint16(at + 8, true);
    const method = view.getUint16(at + 10, true);
    const compressed = view.getUint32(at + 20, true);
    const expanded = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const next = at + 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    if (next > end || (flags & 1) || ![0, 8].includes(method) || local + 30 > bytes.length || view.getUint32(local, true) !== 0x04034b50) fail();
    const dataStart = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    if (dataStart + compressed > view.getUint32(end + 16, true) || view.getUint16(local + 6, true) !== flags || view.getUint16(local + 8, true) !== method) fail();
    if (compressed === 0xffffffff || expanded > 32 * 1048576 || expanded > Math.max(1, compressed) * 200) fail();
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    if (names.has(name) || name.includes('..') || name.includes('\\') || name.startsWith('/')) fail();
    if (name.endsWith('.xml') && expanded > 16 * 1048576) fail();
    names.add(name);
    total += expanded;
    if (total > 96 * 1048576) fail();
    at = next;
  }
  const mainPart = { docx: 'word/document.xml', xlsx: 'xl/workbook.xml', pptx: 'ppt/presentation.xml' }[kind];
  if (at !== end || !names.has('[Content_Types].xml') || !mainPart || !names.has(mainPart)) fail();
  if (kind === 'xlsx' && [...names].filter(name => /^xl\/worksheets\/sheet[^/]*\.xml$/.test(name)).length > 128) fail();
  if (kind === 'pptx' && [...names].filter(name => /^ppt\/slides\/slide[^/]*\.xml$/.test(name)).length > 300) fail();
}
