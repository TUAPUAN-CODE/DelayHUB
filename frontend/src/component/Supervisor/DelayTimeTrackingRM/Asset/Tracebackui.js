// ─────────────────────────────────────────────────────────────────────────────
// tracebackUI.js — token / helper กลาง ใช้ร่วมกันทุกไฟล์ของโมดูล Traceback
// คงโทนเดิมของระบบ (ขาว-เทา-น้ำเงิน, radius 8-14, border 0.5px)
// ─────────────────────────────────────────────────────────────────────────────

export const C = {
  text: '#111827',
  text2: '#374151',
  muted: '#6B7280',
  faint: '#9CA3AF',
  line: '#E5E7EB',
  line2: '#F3F4F6',
  bg: '#F5F8FF',
  white: '#fff',
  blue: '#1552F0',
  blueDark: '#0F3FC4',
  blueSoft: '#EAF0FF',
  green: '#16A34A',
  greenSoft: '#DCFCE7',
  amber: '#D97706',
  amberSoft: '#FEF3C7',
  red: '#DC2626',
  redSoft: '#FEE2E2',
  violet: '#7C3AED',
  violetSoft: '#EDE9FE',
};

export const labelStyle = { fontSize: 11, color: C.muted, marginBottom: 4, display: 'block' };
export const inputStyle = {
  fontSize: 13, padding: '6px 10px', height: 34, border: `0.5px solid #D1D5DB`,
  borderRadius: 8, background: C.white, color: C.text, outline: 'none',
  boxSizing: 'border-box', width: '100%',
};
export const btnPrimary = {
  fontSize: 13, padding: '0 18px', height: 34, border: 'none', borderRadius: 8,
  cursor: 'pointer', background: C.blue, color: '#fff', fontWeight: 600,
};
export const btnSecondary = {
  fontSize: 13, padding: '0 14px', height: 34, border: '0.5px solid #D1D5DB',
  borderRadius: 8, cursor: 'pointer', background: C.white, color: C.text2,
};
export const cardBox = { border: `0.5px solid ${C.line}`, borderRadius: 12, overflow: 'hidden', background: C.white };
export const sectionTitle = { fontSize: 15, fontWeight: 700, color: C.text, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 };

export const th = {
  padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.muted,
  borderBottom: `1px solid ${C.line}`, background: C.bg, whiteSpace: 'nowrap', userSelect: 'none',
};
export const td = {
  padding: '8px 12px', borderBottom: `0.5px solid ${C.line2}`, fontSize: 12.5,
  color: C.text, whiteSpace: 'nowrap', verticalAlign: 'top',
};

// ── เกณฑ์ดีเลย์ (นาที) — ปรับที่เดียว ใช้ทั้งระบบ ────────────────────────────
export const DELAY_WARN_MIN = 120;   // 2 ชม.
export const DELAY_SEVERE_MIN = 480; // 8 ชม.

export function delayLevel(mins) {
  if (mins == null) return 'none';
  if (mins > DELAY_SEVERE_MIN) return 'severe';
  if (mins > DELAY_WARN_MIN) return 'warn';
  return 'ok';
}

export const DELAY_STYLE = {
  severe: { bg: C.redSoft, color: '#991B1B', border: '#FECACA', label: 'ดีเลย์รุนแรง' },
  warn: { bg: C.amberSoft, color: '#92400E', border: '#FDE68A', label: 'ดีเลย์' },
  ok: { bg: '#F0FDF4', color: '#166534', border: '#BBF7D0', label: 'ปกติ' },
  none: { bg: C.line2, color: C.muted, border: C.line, label: '-' },
};

// ── format ──────────────────────────────────────────────────────────────────
export function parseDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d) ? null : d;
}

export function fmtDisplay(val) {
  const d = parseDate(val);
  if (!d) return '-';
  return `${d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })} ${d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`;
}

export function fmtDateOnly(val) {
  const d = parseDate(val);
  if (!d) return '-';
  return d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function fmtRange(from, to) {
  if (!from && !to) return '-';
  if (!to || from === to) return fmtDisplay(from);
  return `${fmtDisplay(from)} → ${fmtDisplay(to)}`;
}

export function fmtNum(v, digits = 2) {
  if (v == null || v === '') return '-';
  const n = Number(v);
  return isNaN(n) ? String(v) : n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function fmtDuration(mins) {
  if (mins == null || isNaN(mins)) return '-';
  const abs = Math.abs(Math.round(mins));
  const d = Math.floor(abs / 1440);
  const h = Math.floor((abs % 1440) / 60);
  const m = abs % 60;
  const sign = mins < 0 ? '-' : '';
  if (d > 0) return `${sign}${d}d ${h}h`;
  if (h === 0) return `${sign}${m}m`;
  if (m === 0) return `${sign}${h}h`;
  return `${sign}${h}h ${m}m`;
}

export function diffMinutes(a, b) {
  const da = parseDate(a), db = parseDate(b);
  if (!da || !db) return null;
  return Math.round((db - da) / 60000);
}

export function minDate(list) {
  const v = list.map(parseDate).filter(Boolean).sort((a, b) => a - b);
  return v.length ? v[0].toISOString() : null;
}

export function maxDate(list) {
  const v = list.map(parseDate).filter(Boolean).sort((a, b) => a - b);
  return v.length ? v[v.length - 1].toISOString() : null;
}