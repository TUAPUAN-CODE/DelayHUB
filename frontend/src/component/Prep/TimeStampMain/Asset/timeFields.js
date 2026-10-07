/**
 * Time columns of a SAP_Receive row (API /api/coldstorages/scan/sap/month). A material can go out of the cold room up to 4 times:
 * the keys of round 1 have no suffix, round 2 "_two", 3 "_three", 4 "_four" (round 4 has no production / cold-room columns).
 */
const SUFFIX = ['', '_two', '_three', '_four'];
const KINDS = [
  { id: 'withdraw_date', label: 'จ่ายออกห้องเย็น', color: '#e65100', bg: '#fff3e0' },
  { id: 'start_defrost_date', label: 'เริ่มละลาย', color: '#0277bd', bg: '#EAF0FF' },
  { id: 'end_defrost_date', label: 'ละลายเสร็จ', color: '#0277bd', bg: '#EAF0FF' },
  { id: 'input_pd_date', label: 'ไลน์ผลิตรับเข้า', color: '#2e7d32', bg: '#e8f5e9' },
  { id: 'output_pd_date', label: 'ไลน์ผลิตส่งคืน', color: '#558b2f', bg: '#f1f8e9' },
  { id: 'input_cd_date', label: 'เข้าห้องเย็น', color: '#6a1b9a', bg: '#f3e5f5' },
];
const MISSING = new Set(['output_pd_date_four', 'input_pd_date_four', 'input_cd_date_four']);

export const TIME_FIELDS = SUFFIX.flatMap((suf, r) =>
  KINDS.map((k) => ({ key: `${k.id}${suf}`, round: r + 1, label: `${k.label} (${r + 1})`, short: k.label, color: k.color, bg: k.bg })),
).filter((f) => !MISSING.has(f.key));

export const ROUNDS = [1, 2, 3, 4];
export const fieldsOfRound = (round) => TIME_FIELDS.filter((f) => f.round === round);

/** Rounds that have at least one time in the given rows (round 1 is always listed) */
export const roundsInUse = (rows) => ROUNDS.filter((r) => r === 1 || rows.some((row) => fieldsOfRound(r).some((f) => row.sap?.[f.key])));

const pad = (n) => String(n).padStart(2, '0');
/** Today as YYYY-MM-DD in the computer's own time zone (toISOString() would give yesterday between 00:00 and 07:00 in Thailand) */
export const todayLocal = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

/** "2026-10-03 07:15:00" → "03/10 07:15" ; anything else is shown as it is */
export function shortDateTime(v) {
  if (!v) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(v));
  return m ? `${m[3]}/${m[2]} ${m[4]}:${m[5]}` : String(v);
}
export const sortByTime = (a, b) => String(a.value).replace(' ', 'T').localeCompare(String(b.value).replace(' ', 'T'));

const MONTH_MAP = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
/** Date text of the production-plan list → "DD/MM/YYYY HH:MM" (same rules the old page used; the dialogs expect this format) */
export function formatDateTime(v) {
  if (!v || v === 'แสดงข้อมูล') return v || null;
  if (typeof v === 'string' && /\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/.test(v)) return v;
  if (typeof v === 'string') {
    const m = v.trim().match(/^([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})\s+(\d{1,2}):(\d{2})(AM|PM)$/i);
    if (m) {
      let h = parseInt(m[4], 10);
      if (m[6].toUpperCase() === 'AM' && h === 12) h = 0;
      if (m[6].toUpperCase() === 'PM' && h !== 12) h += 12;
      const d = new Date(parseInt(m[3], 10), MONTH_MAP[m[1]], parseInt(m[2], 10), h, parseInt(m[5], 10));
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
  }
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
