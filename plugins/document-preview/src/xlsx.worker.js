import * as XLSX from 'xlsx';

let workbook;
const ROW_LIMIT = 100000;
const COLUMN_LIMIT = 256;
function bounds(sheet) {
  const ref = sheet['!fullref'] || sheet['!ref'];
  if (!ref) return null;
  const source = XLSX.utils.decode_range(ref);
  const visible = XLSX.utils.decode_range(sheet['!ref'] || ref);
  return {
    rows: Math.min(visible.e.r + 1, ROW_LIMIT),
    columns: Math.min(visible.e.c + 1, COLUMN_LIMIT),
    sourceRows: source.e.r + 1,
    sourceColumns: source.e.c + 1,
    truncated: source.e.r >= ROW_LIMIT || source.e.c >= COLUMN_LIMIT,
  };
}
self.onmessage = ({ data }) => {
  const { id, method } = data;
  try {
    if (method === 'open') {
      workbook = XLSX.read(data.bytes, {
        type: 'array', sheetRows: ROW_LIMIT, cellHTML: false, cellStyles: false,
        cellFormula: true, cellNF: false, bookVBA: false, dense: false,
      });
      if (!workbook.SheetNames.length || workbook.SheetNames.length > 128) throw new Error('Invalid worksheet count / 工作表数量无效');
      self.postMessage({ id, result: workbook.SheetNames.map((name, index) => ({
        name, index, hidden: !!workbook.Workbook?.Sheets?.[index]?.Hidden,
        bounds: bounds(workbook.Sheets[name]),
      })) });
    } else if (method === 'page') {
      if (!workbook || !Number.isInteger(data.sheet) || !workbook.SheetNames[data.sheet]) throw new Error('Invalid worksheet');
      const sheet = workbook.Sheets[workbook.SheetNames[data.sheet]];
      const range = bounds(sheet);
      const row = Math.max(0, Math.min(ROW_LIMIT - 1, Math.floor(data.row) || 0));
      const rows = [];
      for (let r = row; range && r < Math.min(row + 100, range.rows); r++) {
        const cells = [];
        for (let c = 0; c < range.columns; c++) {
          const cell = sheet[XLSX.utils.encode_cell({ r, c })];
          const value = cell ? (cell.v === undefined ? '' : (cell.w ?? XLSX.utils.format_cell(cell))) : '';
          cells.push({ value: String(value).slice(0, 32768), formula: cell?.f?.slice(0, 8192), missing: !!cell?.f && cell.v === undefined });
        }
        rows.push(cells);
      }
      const columns = [];
      for (let c = 0; range && c < range.columns; c++) columns.push(XLSX.utils.encode_col(c));
      self.postMessage({ id, result: { rows, columns, row, bounds: range } });
    } else throw new Error('Unknown workbook request');
  } catch (error) {
    self.postMessage({ id, error: String(error?.message || error).slice(0, 400) });
  }
};
