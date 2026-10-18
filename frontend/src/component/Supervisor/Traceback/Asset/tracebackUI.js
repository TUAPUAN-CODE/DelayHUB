// ค่าสี/สไตล์/ฟังก์ชันจัดรูปแบบที่ใช้ร่วมกันในหน้า Traceback
export const C = {
  blue: '#0B5FA5', blueDark: '#083E6B', blueSoft: '#E7F1FA',
  orange: '#D9580D', orangeSoft: '#FFF0E3',
  violetSoft: '#EDE9FE',
  white: '#FFFFFF', bg: '#F5F9FD',
  text: '#0F2740', text2: '#274866', muted: '#4A6A88', faint: '#6B8AA6',
  line: '#B7D5EE', line2: '#E3EEF8',
};

export const labelStyle = {
  display: 'block', fontSize: 12, fontWeight: 500, color: C.blueDark, marginBottom: 4,
};

export const inputStyle = {
  width: '100%', height: 38, padding: '0 11px', borderRadius: 9, fontSize: 13,
  border: `1.5px solid ${C.line}`, color: C.text, background: C.white,
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
};

export const btnPrimary = {
  height: 38, padding: '0 18px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
  background: C.orange, border: `1.5px solid ${C.orange}`, color: C.white, fontSize: 13, fontWeight: 600,
};

export const btnSecondary = {
  height: 38, padding: '0 16px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
  background: C.white, border: `1.5px solid ${C.blue}`, color: C.blue, fontSize: 13, fontWeight: 600,
};

export const DELAY_STYLE = {
  severe: { label: 'ดีเลย์รุนแรง', border: '#A81E14', bg: '#FDEBE9', color: '#A81E14' },
  warn: { label: 'ดีเลย์', border: '#D9580D', bg: '#FFF0E3', color: '#D9580D' },
  ok: { label: 'ปกติ', border: '#0A6B3D', bg: '#E2F5EA', color: '#0A6B3D' },
};

const pad = (n) => String(n).padStart(2, '0');

export const fmtDisplay = (v) => {
  if (!v) return '—';
  const d = new Date(String(v).replace(' ', 'T'));
  if (isNaN(d)) return String(v);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear() + 543} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const fmtNum = (v, d = 2) => (v == null || v === '' || isNaN(Number(v))
  ? '—'
  : Number(v).toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d }));

// ชุดสีเดียวกับใบสอบกลับ (ฟ้า / ส้ม / ขาว)
export const T = {
  blue: '#0B5FA5', blueDeep: '#083E6B', blueSoft: '#E7F1FA', blueLine: '#B7D5EE',
  orange: '#D9580D', orangeSoft: '#FFF0E3', orangeLine: '#FFCFA6',
  white: '#FFFFFF', bg: '#F5F9FD',
  text: '#0F2740', text2: '#274866', line: '#CBDFEF',
  ok: '#0A6B3D', okSoft: '#E2F5EA', okLine: '#A9DCC0',
  bad: '#A81E14', badSoft: '#FDEBE9', badLine: '#F3B7B1',
};

export const TYPE_LABEL = { auto: 'ค้นหาทุกประเภท', rm: 'วัตถุดิบ', ing: 'ส่วนผสม', pkg: 'บรรจุภัณฑ์' };

// ช่องกรอกมาตรฐานของหน้า Traceback
export const inputCss = {
  height: 38, padding: '0 11px', borderRadius: 9, fontSize: 13, border: `1.5px solid ${T.line}`,
  color: T.text, background: T.white, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', width: '100%',
};
