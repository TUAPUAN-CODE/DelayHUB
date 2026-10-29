// The one search form of /sup/Traceback: both directions (สอบย้อนกลับ / สอบไปข้างหน้า) read the same fields.
//   trace      = Batch / Lot to trace — one code or several (separated by , or space); every kind of code (raw material / ingredient / packaging) is searched
//   doc_no · code · mat · mat_name · rmm_line_name · supplier(backward) · pack_status · from / to (single = only `from`) · sort

export const PACK_STATUS_OPTIONS = [
  { value: 'packed', label: 'บรรจุเสร็จเท่านั้น' },
  { value: 'all', label: 'ทุกสถานะวัตถุดิบ' },
  { value: 'unpacked', label: 'ยังไม่บรรจุเสร็จ (อยู่ระหว่างกระบวนการ)' },
];

export const BACK_SORT_OPTIONS = [
  { value: 'pack_date_desc', label: 'วันบรรจุ ล่าสุด → เก่าสุด' },
  { value: 'pack_date_asc', label: 'วันบรรจุ เก่าสุด → ล่าสุด' },
  { value: 'severe_desc', label: 'ดีเลย์รุนแรง มาก → น้อย' },
  { value: 'delay_desc', label: 'ดีเลย์สูงสุด มาก → น้อย' },
  { value: 'weight_desc', label: 'น้ำหนักรวม มาก → น้อย' },
  { value: 'material_desc', label: 'จำนวนวัตถุดิบ มาก → น้อย' },
  { value: 'doc_no_asc', label: 'เลขเอกสาร (doc_no) ก → ฮ' },
  { value: 'doc_no_desc', label: 'เลขเอกสาร (doc_no) ฮ → ก' },
  { value: 'code_asc', label: 'Code ก → ฮ' },
  { value: 'batch_asc', label: 'รหัสรุ่น (Batch) ก → ฮ' },
  { value: 'batch_desc', label: 'รหัสรุ่น (Batch) ฮ → ก' },
  { value: 'mat_2x_asc', label: 'Mat 2x ก → ฮ' },
  { value: 'mat_2x_desc', label: 'Mat 2x ฮ → ก' },
  { value: 'batch_2x_asc', label: 'Batch 2x ก → ฮ' },
  { value: 'batch_2x_desc', label: 'Batch 2x ฮ → ก' },
];

export const FWD_SORT_OPTIONS = [
  { value: 'day_desc', label: 'วันผลิต ล่าสุด → เก่าสุด' },
  { value: 'day_asc', label: 'วันผลิต เก่าสุด → ล่าสุด' },
  { value: 'weight_desc', label: 'น้ำหนักรวม มาก → น้อย' },
  { value: 'lots_desc', label: 'จำนวนล็อต มาก → น้อย' },
  { value: 'wip_desc', label: 'ยังไม่บรรจุ มาก → น้อย' },
  { value: 'doc_no_asc', label: 'เลขเอกสาร ก → ฮ' },
  { value: 'doc_no_desc', label: 'เลขเอกสาร ฮ → ก' },
  { value: 'code_asc', label: 'Code ก → ฮ' },
];

export const defaultSort = (mode) => (mode === 'forward' ? 'day_desc' : 'pack_date_desc');
// backward lists the finished productions; forward follows a code into every lot, packed or not
export const defaultStatus = (mode) => (mode === 'forward' ? 'all' : 'packed');

export const makeForm = (mode, init = {}) => ({
  trace: '',
  doc_no: '', code: '', mat: '', mat_name: '', rmm_line_name: '', supplier: '',
  pack_status: defaultStatus(mode), single: true, from: '', to: '',
  sort: defaultSort(mode),
  ...init,
});

/** the codes to trace: the pasted list (many) or the one code */
export const splitCodes = (text) => [...new Set(String(text || '').split(/[\s,;]+/).map(x => x.trim().toUpperCase()).filter(Boolean))].slice(0, 50);
export const traceCodes = (f) => splitCodes(f.trace);

/** the filters of GET /api/traceback/search from the form */
export const backwardFilters = (f) => ({
  doc_no: f.doc_no, code: f.code, mat: f.mat, mat_name: f.mat_name, rmm_line_name: f.rmm_line_name, supplier: f.supplier,
  trace: traceCodes(f).join(','), trace_type: 'auto', // every kind of code, every time
  sc_pack_date_from: f.from, sc_pack_date_to: f.single ? f.from : f.to, pack_status: f.pack_status,
});
