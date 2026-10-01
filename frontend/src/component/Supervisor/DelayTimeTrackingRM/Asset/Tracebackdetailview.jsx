import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
// ⚠️ แก้ path 2 บรรทัดนี้ให้ตรงกับตำแหน่งไฟล์ฟอนต์ในโปรเจกต์
import { thSarabunBase64 } from '../../../../fonts/thSarabunBase64';
import { thSarabunBoldBase64 } from '../../../../fonts/thSarabunBoldBase64';

axios.defaults.withCredentials = true;
const API_URL = import.meta.env.VITE_API_URL;

/* ═══════════════════════════════════════════════════════════════════════════
   ใบสอบกลับการผลิต — ฟ้า / ส้ม / ขาว  ไม่มีตัวอักษรสีเทา
   · ค้นหาแบบ dropdown มีช่องค้นหาในตัว ทุกแท็บ
   · สอบกลับได้ทั้งย้อนกลับ (Backward) และไปข้างหน้า (Forward)
     ครอบคลุม วัตถุดิบ / ส่วนผสม / บรรจุภัณฑ์
   · ดีเลย์คำนวณตามสูตร DBS1-4 เดียวกับรายงานควบคุมเวลา F3PFPF67
   · Export PDF เป็นฟอร์มทางการ
   ═══════════════════════════════════════════════════════════════════════════ */

const T = {
  blue: '#0B5FA5', blueDeep: '#083E6B', blueSoft: '#E7F1FA', blueLine: '#B7D5EE',
  orange: '#D9580D', orangeSoft: '#FFF0E3', orangeLine: '#FFCFA6',
  white: '#FFFFFF', bg: '#F5F9FD',
  text: '#0F2740', text2: '#274866', line: '#CBDFEF',
  ok: '#0A6B3D', okSoft: '#E2F5EA', okLine: '#A9DCC0',
  bad: '#A81E14', badSoft: '#FDEBE9', badLine: '#F3B7B1',
};

const WARN_MIN = 120;
const SEVERE_MIN = 480;

/* ── helpers ─────────────────────────────────────────────────────────────── */
const S = v => (v == null ? '' : String(v).trim());
const toDate = v => { if (!v || v === '-') return null; const d = new Date(String(v).replace(' ', 'T')); return isNaN(d) ? null : d; };
const diffMin = (a, b) => { const x = toDate(a), y = toDate(b); return x && y ? Math.round((y - x) / 60000) : null; };

const fmtDT = v => {
  const d = toDate(v);
  if (!d) return '—';
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear() + 543} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const fmtD = v => { const d = toDate(v); if (!d) return '—'; const p = n => String(n).padStart(2, '0'); return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear() + 543}`; };
const fmtRange = (a, b) => (!a && !b ? '—' : `${fmtDT(a)} → ${fmtDT(b)}`);
const fmtNum = (v, d = 2) => (v == null || v === '' || isNaN(Number(v)) ? '—' : Number(v).toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d }));
const fmtDur = mins => {
  if (mins == null || isNaN(Number(mins))) return '—';
  const n = Math.abs(Math.round(Number(mins)));
  const d = Math.floor(n / 1440), h = Math.floor((n % 1440) / 60), m = n % 60;
  const parts = [];
  if (d) parts.push(`${d} วัน`);
  if (h) parts.push(`${h} ชม.`);
  if (m || !parts.length) parts.push(`${m} น.`);
  return (Number(mins) < 0 ? '-' : '') + parts.join(' ');
};
const uniq = arr => [...new Set(arr.filter(v => v != null && v !== ''))];

/* ═══ เครื่องคำนวณดีเลย์ DBS — สูตรเดียวกับรายงาน F3PFPF67 ════════════════ */
const SPECIAL_GROUPS = [55, 85, 49, 46, 82];
const isSpecialGroup = row => SPECIAL_GROUPS.includes(Number(row?.rm_group_id));

const getRemappedRow = (row) => {
  const gid = Number(row?.rm_group_id);
  if (gid === 55) {
    return { _A: row.gm_date, _B: row.start_mixed_date, _C: row.rmit_date, _D: null, _E: null, _D3: null, _E3: null, _F: row.sc_pack_date };
  }
  if (gid === 85 || gid === 49 || gid === 82) {
    const colA = (row.out_cold_date && row.out_cold_date !== '-') ? row.out_cold_date : (row.rmit_date_mix ?? null);
    return { _A: colA, _B: row.start_mixed_date, _C: row.rmit_date, _D: null, _E: null, _D3: null, _E3: null, _F: row.sc_pack_date };
  }
  if (gid === 46) {
    return { _A: null, _B: row.rmit_date, _C: null, _D: null, _E: null, _D3: null, _E3: null, _F: row.sc_pack_date };
  }
  return {
    _A: row.rmit_date, _B: row.come_cold_date, _C: row.out_cold_date,
    _D: row.come_cold_date_two, _E: row.out_cold_date_two,
    _D3: row.come_cold_date_three, _E3: row.out_cold_date_three,
    _F: row.sc_pack_date,
  };
};

const CS_WAIT_ROUNDS = [
  { come: 'cs_come_cold_date', out: 'cs_out_cold_date', p1: 'at_pd_storage_purpose', p2: 'storage_purpose' },
  { come: 'cs_come_cold_date_two', out: 'cs_out_cold_date_two', p1: 'at_pd_storage_purpose_2', p2: 'storage_purpose_2' },
  { come: 'cs_come_cold_date_three', out: 'cs_out_cold_date_three', p1: 'at_pd_storage_purpose_3', p2: 'storage_purpose_3' },
];
const CS_WAIT_PURPOSE = 'ฝากเก็บเพื่อรอผลิต';
const getCsWaitMinutes = (row) => {
  if (!row) return 0;
  let total = 0;
  CS_WAIT_ROUNDS.forEach(({ come, out, p1, p2 }) => {
    if (row[p1] === CS_WAIT_PURPOSE || row[p2] === CS_WAIT_PURPOSE) {
      const m = diffMin(row[come], row[out]);
      if (m !== null) total += m;
    }
  });
  return total;
};

const calcDBS1 = (m, row) => (SPECIAL_GROUPS.filter(g => g !== 55).includes(Number(row?.rm_group_id)) ? null : diffMin(m._A, m._B));
const calcDBS2 = (m, sp, row) => {
  if (sp) return null;
  let t = 0, has = false;
  const c1 = diffMin(m._B, m._C); if (c1 !== null) { t += c1; has = true; }
  if (m._D && m._E) { const c2 = diffMin(m._D, m._E); if (c2 !== null) { t += c2; has = true; } }
  if (m._D3 && m._E3) { const c3 = diffMin(m._D3, m._E3); if (c3 !== null) { t += c3; has = true; } }
  const cs = getCsWaitMinutes(row); if (cs > 0) { t += cs; has = true; }
  return has ? t : null;
};
const calcDBS3 = (m, sp) => {
  if (sp) return null;
  let cold = 0;
  if (m._D && m._E) { const c = diffMin(m._D, m._E); if (c !== null) cold += c; }
  if (m._D3 && m._E3) { const c = diffMin(m._D3, m._E3); if (c !== null) cold += c; }
  const fc = diffMin(m._C, m._F);
  if (fc === null) return null;
  return Math.max(fc - cold, 0);
};
const calcDBS4 = (m, sp, row) => {
  const gid = Number(row?.rm_group_id);
  if (gid === 46) return diffMin(m._B, m._F);
  if (sp) { const p2 = diffMin(m._C, m._F); return p2 !== null ? p2 : diffMin(m._A, m._F); }
  const a = calcDBS1(m, row), c = calcDBS3(m, sp);
  if (a === null && c === null) return diffMin(m._A, m._F);
  return (a ?? 0) + (c ?? 0);
};
const stdToMinutes = v => { if (v == null || v === '-' || v === '') return null; const n = parseFloat(v); return isNaN(n) ? null : n * 60; };

/** คำนวณดีเลย์ทั้งชุดของ 1 ล็อต */
const buildDelay = (m) => {
  const row = { ...(m.history || {}), rm_group_id: m.rm_group_id };
  const mapped = getRemappedRow(row);
  const sp = isSpecialGroup(row);
  const v = {
    dbs1: calcDBS1(mapped, row),
    dbs2: calcDBS2(mapped, sp, row),
    dbs3: calcDBS3(mapped, sp),
    dbs4: calcDBS4(mapped, sp, row),
  };
  const s = { dbs1: stdToMinutes(m.DBS1), dbs2: stdToMinutes(m.DBS2), dbs3: stdToMinutes(m.DBS3), dbs4: stdToMinutes(m.DBS4) };
  const over = {
    dbs1: s.dbs1 != null && v.dbs1 != null && v.dbs1 > s.dbs1,
    dbs2: !sp && s.dbs2 != null && v.dbs2 != null && v.dbs2 > s.dbs2,
    dbs3: !sp && s.dbs3 != null && v.dbs3 != null && v.dbs3 > s.dbs3,
    dbs4: s.dbs4 != null && v.dbs4 != null && v.dbs4 > s.dbs4,
  };
  return { mapped, special: sp, value: v, std: s, over, anyOver: Object.values(over).some(Boolean) };
};

const STAGE_LABEL = {
  _A: 'เตรียมเสร็จ (A)', _B: 'เข้าห้องเย็น 1 (B)', _C: 'ออกห้องเย็น 1 (C)',
  _D: 'เข้าห้องเย็น 2 (D)', _E: 'ออกห้องเย็น 2 (E)',
  _D3: 'เข้าห้องเย็น 3', _E3: 'ออกห้องเย็น 3', _F: 'บรรจุเสร็จ (F)',
};
const DBS_LABEL = {
  dbs1: 'DBS 1 · เตรียมเสร็จ → เข้าห้องเย็น',
  dbs2: 'DBS 2 · เข้าห้องเย็น → ออกห้องเย็น',
  dbs3: 'DBS 3 · ออกห้องเย็น → บรรจุเสร็จ',
  dbs4: 'DBS 4 · รวมทั้งกระบวนการ',
};

/* ═══ อะตอม UI ════════════════════════════════════════════════════════════ */
const Txt = ({ children, c = T.text, size = 12.5, weight = 400, style }) => (
  <span style={{ color: c, fontSize: size, fontWeight: weight, ...style }}>{children}</span>
);

const Tag = ({ children, tone = 'blue', title }) => {
  const map = {
    blue: [T.blueSoft, T.blueDeep, T.blueLine],
    orange: [T.orangeSoft, T.orange, T.orangeLine],
    ok: [T.okSoft, T.ok, T.okLine],
    bad: [T.badSoft, T.bad, T.badLine],
    plain: [T.white, T.text2, T.line],
  }[tone] || [T.blueSoft, T.blueDeep, T.blueLine];
  return (
    <span title={title} style={{
      display: 'inline-block', fontSize: 11.5, fontWeight: 500, padding: '2px 9px',
      borderRadius: 6, background: map[0], color: map[1], border: `1px solid ${map[2]}`,
      whiteSpace: 'nowrap',
    }}>{children}</span>
  );
};

const DelayTag = ({ minutes, over }) => {
  const tone = over ? 'bad' : minutes > SEVERE_MIN ? 'bad' : minutes > WARN_MIN ? 'orange' : 'ok';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      {over && (
        <span style={{
          width: 16, height: 16, borderRadius: 8, background: T.bad, color: T.white,
          fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>!</span>
      )}
      <Tag tone={tone}>{fmtDur(minutes)}</Tag>
    </span>
  );
};

const Field = ({ label, value, wide }) => (
  <div style={{ gridColumn: wide ? 'span 2' : undefined }}>
    <div style={{ fontSize: 11, color: T.blueDeep, fontWeight: 500, marginBottom: 3 }}>{label}</div>
    <div style={{ fontSize: 13, color: T.text, fontWeight: 400, wordBreak: 'break-word' }}>
      {value === 0 || value ? value : '—'}
    </div>
  </div>
);

const Grid = ({ children, min = 170, style }) => (
  <div style={{
    display: 'grid', gridTemplateColumns: `repeat(auto-fill,minmax(${min}px,1fr))`, gap: 14,
    background: T.bg, border: `1px solid ${T.line}`, borderRadius: 10, padding: '14px 16px', ...style,
  }}>{children}</div>
);

const Panel = ({ title, hint, tone = 'blue', children, right }) => {
  const head = tone === 'orange' ? T.orange : T.blue;
  return (
    <div style={{ marginTop: 18, border: `1px solid ${T.line}`, borderRadius: 12, overflow: 'hidden', background: T.white }}>
      <div style={{
        background: head, color: T.white, padding: '9px 14px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{title}</span>
        <span style={{ fontSize: 11.5, fontWeight: 400 }}>{right || hint}</span>
      </div>
      <div style={{ padding: '14px 16px' }}>{children}</div>
    </div>
  );
};

const Kpi = ({ label, value, sub, tone = 'blue' }) => {
  const c = tone === 'bad' ? T.bad : tone === 'orange' ? T.orange : tone === 'ok' ? T.ok : T.blue;
  return (
    <div style={{ background: T.white, border: `1px solid ${T.line}`, borderLeft: `4px solid ${c}`, borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 11.5, color: T.text2, fontWeight: 500, marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: c, lineHeight: 1.15 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.text2, marginTop: 4, fontWeight: 400 }}>{sub}</div>}
    </div>
  );
};

/* ═══ Dropdown ที่ค้นหาได้ในตัว ═══════════════════════════════════════════ */
const SearchSelect = ({ label, value, onChange, options = [], placeholder = 'ทั้งหมด', width = 190 }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setQ(''); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const list = useMemo(() => {
    const opts = options.map(o => (typeof o === 'string' ? { value: o, label: o } : o));
    if (!q) return opts;
    const k = q.toLowerCase();
    return opts.filter(o => String(o.label).toLowerCase().includes(k) || String(o.value).toLowerCase().includes(k));
  }, [options, q]);

  const current = useMemo(() => {
    const opts = options.map(o => (typeof o === 'string' ? { value: o, label: o } : o));
    return opts.find(o => String(o.value) === String(value));
  }, [options, value]);

  return (
    <div ref={ref} style={{ position: 'relative', width }}>
      {label && <div style={{ fontSize: 11.5, color: T.blueDeep, fontWeight: 500, marginBottom: 4 }}>{label}</div>}
      <div onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
          height: 38, padding: '0 11px', borderRadius: 9, cursor: 'pointer', background: T.white,
          border: `1.5px solid ${value ? T.blue : T.line}`,
          color: value ? T.text : T.text2, fontSize: 13, fontWeight: value ? 500 : 400,
        }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {current?.label || value || placeholder}
        </span>
        <span style={{ color: T.blue, fontSize: 11 }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
          background: T.white, border: `1.5px solid ${T.blue}`, borderRadius: 10,
          boxShadow: '0 10px 28px rgba(11,95,165,0.18)', overflow: 'hidden',
        }}>
          <div style={{ padding: 8, borderBottom: `1px solid ${T.line}` }}>
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="พิมพ์เพื่อค้นหา..."
              style={{
                width: '100%', height: 32, padding: '0 10px', borderRadius: 7, fontSize: 12.5,
                border: `1px solid ${T.blueLine}`, outline: 'none', color: T.text, background: T.bg,
                fontFamily: 'inherit', boxSizing: 'border-box',
              }} />
          </div>
          <div style={{ maxHeight: 250, overflowY: 'auto' }}>
            {value && (
              <div onClick={() => { onChange(''); setOpen(false); setQ(''); }}
                style={{ padding: '9px 12px', fontSize: 12.5, color: T.orange, fontWeight: 500, cursor: 'pointer', borderBottom: `1px solid ${T.line}` }}>
                ✕ ล้างตัวเลือก
              </div>
            )}
            {list.length ? list.map((o, i) => (
              <div key={i} onClick={() => { onChange(o.value); setOpen(false); setQ(''); }}
                style={{
                  padding: '9px 12px', fontSize: 12.5, cursor: 'pointer', fontWeight: 400,
                  color: String(o.value) === String(value) ? T.blueDeep : T.text,
                  background: String(o.value) === String(value) ? T.blueSoft : T.white,
                  borderBottom: i < list.length - 1 ? `1px solid ${T.line}` : 'none',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = T.blueSoft; }}
                onMouseLeave={e => { e.currentTarget.style.background = String(o.value) === String(value) ? T.blueSoft : T.white; }}>
                {o.label}
                {o.meta && <span style={{ color: T.text2, fontSize: 11, marginLeft: 6 }}>{o.meta}</span>}
              </div>
            )) : (
              <div style={{ padding: '16px 12px', fontSize: 12.5, color: T.text2, textAlign: 'center', fontWeight: 400 }}>ไม่พบข้อมูล</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const FilterBar = ({ children, onClear, count }) => (
  <div style={{
    display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end',
    background: T.blueSoft, border: `1px solid ${T.blueLine}`, borderRadius: 12,
    padding: '12px 14px', marginBottom: 14,
  }} className="tb-noprint">
    {children}
    <button onClick={onClear} style={{
      height: 38, padding: '0 16px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
      background: T.white, border: `1.5px solid ${T.orange}`, color: T.orange, fontSize: 13, fontWeight: 500,
    }}>ล้างตัวกรอง</button>
    {count != null && (
      <div style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: 13, fontWeight: 600, color: T.blueDeep }}>
        แสดง {count} รายการ
      </div>
    )}
  </div>
);

/* ═══ ตาราง ═══════════════════════════════════════════════════════════════ */
const DataTable = ({ columns, rows, getKey, renderExpanded, empty = 'ไม่มีข้อมูล', rowTone }) => {
  const [open, setOpen] = useState({});
  if (!rows?.length) {
    return (
      <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: 20, background: T.white, fontSize: 13, color: T.text2, fontWeight: 400 }}>
        {empty}
      </div>
    );
  }
  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, overflowX: 'auto', background: T.white }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {renderExpanded && <th style={{ ...THS, width: 34 }} />}
            {columns.map(c => (
              <th key={c.key} style={{ ...THS, textAlign: c.align || 'left', minWidth: c.minWidth }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const k = getKey ? getKey(r, i) : i;
            const isOpen = !!open[k];
            const tone = rowTone?.(r);
            const bg = tone === 'bad' ? T.badSoft : tone === 'orange' ? T.orangeSoft : (i % 2 ? T.bg : T.white);
            return (
              <React.Fragment key={k}>
                <tr onClick={renderExpanded ? () => setOpen(p => ({ ...p, [k]: !p[k] })) : undefined}
                  style={{ background: bg, cursor: renderExpanded ? 'pointer' : 'default' }}>
                  {renderExpanded && (
                    <td style={{ ...TDS, textAlign: 'center', color: T.blue, fontWeight: 700 }}>{isOpen ? '▾' : '▸'}</td>
                  )}
                  {columns.map(c => (
                    <td key={c.key} style={{ ...TDS, textAlign: c.align || 'left', whiteSpace: c.wrap ? 'normal' : 'nowrap', minWidth: c.minWidth }}>
                      {c.render ? c.render(r, i) : (r[c.key] === 0 || r[c.key] ? r[c.key] : '—')}
                    </td>
                  ))}
                </tr>
                {isOpen && renderExpanded && (
                  <tr>
                    <td colSpan={columns.length + 1} style={{ padding: '4px 16px 18px 42px', background: T.bg, borderBottom: `1px solid ${T.line}` }}>
                      {renderExpanded(r)}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const THS = {
  background: T.blue, color: T.white, fontSize: 12.5, fontWeight: 600,
  padding: '10px 12px', whiteSpace: 'nowrap', position: 'sticky', top: 0,
  borderRight: '1px solid rgba(255,255,255,0.18)',
};
const TDS = {
  fontSize: 12.5, color: T.text, fontWeight: 400, padding: '9px 12px',
  borderBottom: `1px solid ${T.line}`, borderRight: `1px solid ${T.line}`,
};

const SectionTitle = ({ no, title, hint, count }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', margin: '26px 0 12px' }}>
    <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <span style={{
        width: 24, height: 24, borderRadius: 7, background: T.orange, color: T.white,
        fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>{no}</span>
      <span style={{ fontSize: 15, fontWeight: 700, color: T.blueDeep }}>{title}</span>
      {count != null && <Tag tone="plain">{count} รายการ</Tag>}
    </span>
    {hint && <span style={{ fontSize: 12, color: T.text2, fontWeight: 400 }}>{hint}</span>}
  </div>
);

/* ═══ ดัชนีสำหรับสอบกลับสองทิศทาง ═════════════════════════════════════════
   สร้างครั้งเดียวจาก data แล้วใช้ค้นทั้ง forward และ backward
   · rm       วัตถุดิบ  (mat + batch)
   · ing      ส่วนผสม   (ngdntCode + batch)
   · pkg      บรรจุภัณฑ์ (code + lot + batch)
   ═══════════════════════════════════════════════════════════════════════ */
const buildIndex = (materials) => {
  const rm = new Map(), ing = new Map(), pkg = new Map();

  materials.forEach(m => {
    const rk = `${m.mat || ''}|${m.batch_before || ''}`;
    if (!rm.has(rk)) rm.set(rk, {
      key: rk, type: 'rm', code: m.mat, name: m.mat_name, batch: m.batch_before,
      code2: m.mat_2x, batch2: m.batch_after, lots: [],
    });
    rm.get(rk).lots.push(m);

    (m.ingredient_summary || []).forEach(g => {
      const ik = `${g.material_code || ''}|${g.batch_no || ''}`;
      if (!ing.has(ik)) ing.set(ik, { key: ik, type: 'ing', code: g.material_code, name: g.material_name, batch: g.batch_no, lots: [], rows: [] });
      const e = ing.get(ik);
      if (!e.lots.includes(m)) e.lots.push(m);
      e.rows.push({ ...g, _m: m });
    });

    (m.packaging || []).forEach(p => {
      const pk = `${p.code || ''}|${p.lot_no || ''}|${p.batch_no || ''}`;
      if (!pkg.has(pk)) pkg.set(pk, { key: pk, type: 'pkg', code: p.code, name: p.material_no, batch: p.batch_no, lot: p.lot_no, lots: [], rows: [] });
      const e = pkg.get(pk);
      if (!e.lots.includes(m)) e.lots.push(m);
      e.rows.push({ ...p, _m: m });
    });
  });

  return { rm: [...rm.values()], ing: [...ing.values()], pkg: [...pkg.values()] };
};

const ENTITY_LABEL = { rm: 'วัตถุดิบ', ing: 'ส่วนผสม', pkg: 'บรรจุภัณฑ์' };

/* ── กล่องในแผนผัง ───────────────────────────────────────────────────────── */
const EV = {
  doc: { label: 'ยืนยันด้วยเอกสาร', bd: T.blue, bg: T.blueSoft, fg: T.blueDeep, dash: false },
  decoded: { label: 'ถอดจากรหัสรุ่น', bd: T.orange, bg: T.orangeSoft, fg: T.orange, dash: false },
  inferred: { label: 'อนุมานจากข้อมูล', bd: T.orange, bg: T.white, fg: T.orange, dash: true },
  none: { label: 'ไม่มีข้อมูล', bd: T.line, bg: T.white, fg: T.text2, dash: true },
};

const Legend = () => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 12, alignItems: 'center' }}>
    <span style={{ fontSize: 12, fontWeight: 600, color: T.blueDeep }}>ระดับหลักฐาน</span>
    {Object.values(EV).map((e, i) => (
      <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.text, fontWeight: 400 }}>
        <span style={{ width: 24, borderTop: `2.5px ${e.dash ? 'dashed' : 'solid'} ${e.bd}` }} />
        {e.label}
      </span>
    ))}
  </div>
);

const Node = ({ title, lines, ev = 'doc', w = 208, onClick }) => {
  const e = EV[ev] || EV.none;
  return (
    <div onClick={onClick} style={{
      minWidth: w, maxWidth: w, background: e.bg, borderRadius: 10, padding: '10px 12px',
      border: `2px ${e.dash ? 'dashed' : 'solid'} ${e.bd}`, flexShrink: 0,
      cursor: onClick ? 'pointer' : 'default',
    }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: e.fg, marginBottom: 6 }}>{title}</div>
      {lines.filter(l => l && l.v != null && l.v !== '' && l.v !== '—').map((l, i) => (
        <div key={i} style={{ display: 'flex', gap: 7, lineHeight: 1.55, fontSize: 11.5 }}>
          <span style={{ color: T.text2, fontWeight: 500, minWidth: 56 }}>{l.k}</span>
          <span style={{ color: T.text, fontWeight: 500, wordBreak: 'break-word' }}>{l.v}</span>
        </div>
      ))}
    </div>
  );
};

const Arrow = ({ dir = 'f' }) => (
  <div style={{ display: 'flex', alignItems: 'center', color: T.orange, fontSize: 20, fontWeight: 700, padding: '0 3px', flexShrink: 0 }}>
    {dir === 'f' ? '→' : '←'}
  </div>
);

/* ── แผนผังของ 1 ล็อต ────────────────────────────────────────────────────── */
const LotFlow = ({ m, summary }) => {
  const it = m.intake;
  const dly = buildDelay(m);

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 6 }}>
      <div style={{ display: 'flex', gap: 5, minWidth: 'min-content', alignItems: 'stretch' }}>
        <Node title="① ผู้ส่งมอบ" ev={it ? 'doc' : 'none'} lines={[
          { k: 'ผู้ขาย', v: m.supplier_name || m.supplier_code },
          { k: 'ชนิด', v: m.fish_specie },
          { k: 'ขนาด', v: m.fish_size },
          { k: 'ผลตรวจ', v: m.intake_decision },
          { k: 'พบ', v: m.intake_defect },
        ]} />
        <Arrow />
        <Node title="② รับเข้าโรงงาน" ev={it ? 'doc' : 'none'} lines={[
          { k: 'Batch', v: m.batch_before },
          { k: 'Batch 2x', v: m.batch_after && m.batch_after !== m.batch_before ? m.batch_after : null },
          { k: 'วันที่ล็อต', v: m.batch_date && fmtD(m.batch_date) },
          { k: 'ผลิต(Supp)', v: m.produce_date },
          { k: 'ปริมาณ', v: m.receive_qty != null ? `${fmtNum(m.receive_qty, 0)} ${m.receive_unit || ''}` : null },
          { k: 'อุณหภูมิ', v: m.intake_temp_avg != null ? `${m.intake_temp_avg} °C` : null },
        ]} />
        <Arrow />
        <Node title="③ ล็อตในโรงงาน" lines={[
          { k: 'mapping', v: m.mapping_id },
          { k: 'Mat', v: m.mat },
          { k: 'Mat 2x', v: m.mat_2x && m.mat_2x !== m.mat ? m.mat_2x : null },
          { k: 'ชื่อ', v: m.mat_name },
          { k: 'น้ำหนัก', v: m.weight_RM != null ? `${fmtNum(m.weight_RM, 1)} kg` : null },
          { k: 'กลุ่ม', v: m.rm_group_name },
        ]} />
        <Arrow />
        <Node title="④ ส่วนผสม" ev={m.ingredient_row_count ? 'doc' : 'none'} lines={[
          { k: 'WO', v: m.wo_list?.join(', ') },
          { k: 'ตะกร้า', v: m.ingredient_basket_count || null },
          { k: 'ชนิด', v: m.ingredient_summary?.length || null },
          { k: 'หลุดพิกัด', v: m.ingredient_out_of_spec || null },
        ]} />
        <Arrow />
        <Node title="⑤ บรรจุ" ev={m.packaging_count ? 'doc' : 'none'} lines={[
          { k: 'ไลน์', v: m.rmm_line_name },
          { k: 'เสร็จ(โรงงาน)', v: fmtDT(m.sc_pack_date) },
          { k: 'วัสดุ', v: m.packaging_count ? `${m.packaging_count} รายการ` : null },
          { k: 'QC', v: [m.qccheck, m.mdcheck, m.defectcheck].filter(Boolean).join(' · ') },
        ]} />
        <Arrow />
        <Node title="⑥ สินค้าที่ผลิต" lines={[
          { k: 'เอกสาร', v: summary?.doc_no },
          { k: 'Code', v: m.raw?.Production?.code || summary?.code },
          { k: 'DBS4', v: fmtDur(dly.value.dbs4) },
        ]} />
      </div>
    </div>
  );
};

/* ═══ ตารางดีเลย์ DBS ของ 1 ล็อต ══════════════════════════════════════════ */
const DelayPanel = ({ m }) => {
  const d = buildDelay(m);
  const stages = ['_A', '_B', '_C', '_D', '_E', '_D3', '_E3', '_F']
    .map(k => ({ k, label: STAGE_LABEL[k], v: d.mapped[k] }))
    .filter(s => s.v);

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <Tag tone="plain">กลุ่ม {m.rm_group_id ?? '—'} {m.rm_group_name || ''}</Tag>
        {d.special && <Tag tone="orange">กลุ่มพิเศษ — ใช้สูตรเฉพาะ</Tag>}
        {d.anyOver ? <Tag tone="bad">เกินมาตรฐาน</Tag> : <Tag tone="ok">อยู่ในมาตรฐาน</Tag>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10, marginBottom: 14 }}>
        {['dbs1', 'dbs2', 'dbs3', 'dbs4'].map(k => (
          <div key={k} style={{
            border: `1.5px solid ${d.over[k] ? T.bad : T.line}`,
            background: d.over[k] ? T.badSoft : T.white,
            borderRadius: 10, padding: '11px 13px',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: d.over[k] ? T.bad : T.blueDeep, marginBottom: 5 }}>
              {DBS_LABEL[k]}
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: d.over[k] ? T.bad : T.text }}>
              {d.value[k] == null ? '—' : fmtDur(d.value[k])}
            </div>
            <div style={{ fontSize: 11.5, color: T.text2, fontWeight: 500, marginTop: 4 }}>
              มาตรฐาน {d.std[k] == null ? '—' : fmtDur(d.std[k])}
              {d.over[k] && d.std[k] != null && (
                <span style={{ color: T.bad, marginLeft: 6 }}>เกิน {fmtDur(d.value[k] - d.std[k])}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <DataTable
        columns={[
          { key: 'label', label: 'จุดบันทึกเวลา', minWidth: 170 },
          { key: 'v', label: 'เวลา', render: r => fmtDT(r.v) },
          { key: 'gap', label: 'ห่างจากจุดก่อนหน้า', align: 'right', render: (r, i) => (i === 0 ? '—' : <DelayTag minutes={diffMin(stages[i - 1].v, r.v)} />) },
        ]}
        rows={stages}
        getKey={r => r.k}
        empty="ไม่มีการบันทึกเวลาในล็อตนี้"
      />
    </div>
  );
};

/* ═══ แผงข้อมูลรับเข้าจาก WISEUP ══════════════════════════════════════════
   แทนการถอดรหัสจากหลักของ batch — ใช้ข้อมูลจริงจากระบบรับเข้า แม่นกว่า
   ═══════════════════════════════════════════════════════════════════════ */
const IntakePanel = ({ m }) => {
  const it = m.intake;
  const code = m.batch_before;

  if (!code) return <Txt c={T.text2}>ล็อตนี้ไม่มีเลขรหัสรุ่นบันทึกไว้</Txt>;

  if (!it) {
    return (
      <div>
        <div style={{ fontFamily: 'ui-monospace,monospace', fontSize: 22, letterSpacing: 4,
                      fontWeight: 700, color: T.text, marginBottom: 10 }}>{code}</div>
        <Tag tone="orange">
          ไม่พบรหัสรุ่นนี้ในระบบรับเข้า (WISEUP) — น่าจะเป็นของกึ่งสำเร็จรูปที่ผลิตเอง
        </Tag>
      </div>
    );
  }

  const q = it.qc || {};

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ fontFamily: 'ui-monospace,monospace', fontSize: 22, letterSpacing: 4,
                      fontWeight: 700, color: T.blueDeep }}>{code}</div>
        {m.batch_after && m.batch_after !== code && (
          <Tag tone="orange">Batch 2x {m.batch_after}</Tag>
        )}
        {it.decision_code && (
          <Tag tone={it.decision_code === 'A01' ? 'ok' : 'orange'}>ผลตัดสิน {it.decision_code}</Tag>
        )}
        {q.defect && <Tag tone="bad">พบข้อบกพร่อง</Tag>}
        {it.inspection_lot && <Tag tone="plain">ล็อตตรวจ {it.inspection_lot}</Tag>}
      </div>

      <Grid min={185}>
        <Field label="ผู้ขาย / ผู้ส่งมอบ" value={it.supplier_name} wide />
        <Field label="รหัสผู้ขาย" value={it.supplier_code} />
        <Field label="รหัสวัสดุในระบบรับเข้า" value={it.mat_external} />
        <Field label="วันที่ล็อต (รับเข้าโรงงาน)" value={it.batch_date && fmtDT(it.batch_date)} />
        <Field label="วันที่ผลิต (แจ้งโดยผู้ขาย/Supplier)" value={q.produce_date} />
        <Field label="วันหมดอายุ" value={it.expiration_date && fmtD(it.expiration_date)} />
        <Field label="อายุการเก็บ" value={it.shelf_life_days != null ? `${it.shelf_life_days} วัน` : null} />
        <Field label="ถือครองก่อนเบิกใช้"
               value={m.hold_days_before_use != null ? `${m.hold_days_before_use} วัน` : null} />
        <Field label="ชนิดปลา" value={it.fish_specie} />
        <Field label="ขนาดปลา" value={it.fish_size} />
        <Field label="ปริมาณรับรวม"
               value={it.receive_qty != null ? `${fmtNum(it.receive_qty, 0)} ${it.receive_unit || ''}` : null} />
        <Field label="จำนวนใบรับ" value={it.receive_lines} />
        <Field label="ช่วงเวลารับของ" value={fmtRange(it.receive_first, it.receive_last)} wide />
        <Field label="เลขใบกำกับที่รับ" value={it.guide_numbers} wide />
        <Field label="เลขล็อตตรวจ (Inspection Lot)" value={it.inspection_lot} />
        <Field label="วันที่ตรวจ (WISEUP)" value={it.inspection_date && fmtDT(it.inspection_date)} />
        <Field label="ผลตัดสินการใช้งาน" value={it.decision_code} />
        <Field label="จำนวนครั้งที่เบิกใช้แล้ว" value={it.consumption_cnt} />
      </Grid>

      {(q.temp_avg != null || q.defect || q.inspector) && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.orange, marginBottom: 8 }}>
            ผลตรวจตอนรับเข้า
          </div>
          <Grid min={175}>
            <Field label="อุณหภูมิเฉลี่ย" value={q.temp_avg != null ? `${q.temp_avg} °C` : null} />
            <Field label="ช่วงอุณหภูมิ"
                   value={q.temp_min != null ? `${q.temp_min} ถึง ${q.temp_max} °C (${q.temp_samples} ตัวอย่าง)` : null} />
            <Field label="ทะเบียนรถขนส่ง" value={q.truck_plate} />
            <Field label="ผู้ตรวจ" value={q.inspector} />
            <Field label="ผู้ทวนสอบ" value={q.reviewer} />
            <Field label="สิ่งที่พบ" value={q.defect} wide />
          </Grid>
        </div>
      )}

      {it.receipts?.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.blueDeep, marginBottom: 8 }}>
            ใบรับของ ({it.receipts.length} ใบ)
          </div>
          <DataTable
            rows={it.receipts} getKey={(r, i) => `${r.guide_number}-${r.guide_line}-${i}`}
            columns={[
              { key: 'guide_number', label: 'เลขใบรับ', render: r => <b>{r.guide_number}</b> },
              { key: 'guide_line', label: 'รายการ', align: 'right' },
              { key: 'quantity', label: 'ปริมาณ', align: 'right', render: r => fmtNum(r.quantity, 0) },
              { key: 'unit', label: 'หน่วย' },
              { key: 'supplier_id', label: 'รหัสผู้ขาย' },
              { key: 'received_at', label: 'วันที่รับของ', render: r => fmtDT(r.received_at) },
            ]}
          />
        </div>
      )}

      {it.qc_features?.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.blueDeep, marginBottom: 8 }}>
            ผลตรวจรายคุณลักษณะ ({it.qc_features.length} รายการ)
          </div>
          <DataTable
            rows={it.qc_features} getKey={(f, i) => f.feature_code + i}
            rowTone={f => (f.status === 'ยังไม่บันทึก' ? 'orange' : null)}
            columns={[
              { key: 'group_label', label: 'กลุ่ม' },
              { key: 'label', label: 'คุณลักษณะ', wrap: true, minWidth: 180,
                render: f => (
                  <span>
                    {f.label}
                    {!f.confirmed_label && (
                      <span style={{ marginLeft: 6 }}><Tag tone="orange">ยังไม่ยืนยันชื่อ</Tag></span>
                    )}
                  </span>
                ) },
              { key: 'value', label: 'ค่าที่วัดได้', wrap: true, minWidth: 190 },
              { key: 'unit', label: 'หน่วย' },
              { key: 'avg', label: 'เฉลี่ย', align: 'right', render: f => (f.avg != null ? f.avg : '—') },
              { key: 'range', label: 'ช่วง', align: 'right',
                render: f => (f.min != null ? `${f.min} – ${f.max}` : '—') },
              { key: 'recorded', label: 'บันทึกแล้ว', align: 'right',
                render: f => `${f.recorded}/${f.sample_size ?? '?'}` },
              { key: 'status', label: 'สถานะ',
                render: f => <Tag tone={f.status === 'ครบ' ? 'ok' : 'orange'}>{f.status}</Tag> },
            ]}
          />
        </div>
      )}
    </div>
  );
};

/* ═══ Export PDF — ฟอร์มทางการ ════════════════════════════════════════════ */
const exportRecordPDF = (data, docNo, code, sign) => {
  const doc = new jsPDF('l', 'mm', 'a4');
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 6;

  doc.addFileToVFS('Sarabun-Regular.ttf', thSarabunBase64);
  doc.addFont('Sarabun-Regular.ttf', 'Sarabun', 'normal');
  doc.addFileToVFS('Sarabun-Bold.ttf', thSarabunBoldBase64);
  doc.addFont('Sarabun-Bold.ttf', 'Sarabun', 'bold');
  doc.setFont('Sarabun', 'normal');

  const rect = (x, y, w, h) => { doc.setDrawColor(0); doc.setLineWidth(0.15); doc.rect(x, y, w, h); };
  const fill = (x, y, w, h, c) => { doc.setFillColor(...c); doc.rect(x, y, w, h, 'F'); };
  const text = (t, x, y, o = {}) => {
    const { size = 8, align = 'center', bold = false, color = [0, 0, 0] } = o;
    doc.setFont('Sarabun', bold ? 'bold' : 'normal');
    doc.setFontSize(size); doc.setTextColor(...color);
    doc.text(String(t ?? '').normalize('NFC'), x, y, { align });
  };
  const cell = (t, x, y, w, h, o = {}) => {
    const { bg, size = 7, bold = false, align = 'center', color = [0, 0, 0] } = o;
    if (bg) fill(x, y, w, h, bg);
    rect(x, y, w, h);
    const lines = String(t ?? '').split('\n');
    const lh = size * 0.45;
    const sy = y + (h - lines.length * lh) / 2 + lh * 0.85;
    lines.forEach((ln, i) => {
      const tx = align === 'center' ? x + w / 2 : align === 'right' ? x + w - 1.5 : x + 1.5;
      text(ln, tx, sy + i * lh, { size, bold, align, color });
    });
  };

  const HB = [231, 241, 250];   // ฟ้าอ่อน
  const OB = [255, 240, 227];   // ส้มอ่อน
  const RB = [253, 235, 233];   // แดงอ่อน

  const s = data.summary || {};
  const materials = data.materials || [];
  const rows = 14;

  // ── layout ──
  const tX = M, tY = 32, tW = W - M * 2;
  const cMat = 15, cMat2 = 15, cName = 30, cBatch = 20, bCols = 10, bW = cBatch / bCols;
  const cBatch2 = 19;
  const cStruct = 16, cRecv = 15, cGrp = 13, cWt = 12, cLine = 12;
  const cA = 16, cF = 16;
  const cD1 = 12, cD2 = 12, cD3 = 12, cD4 = 12;
  const cRem = tW - (cMat + cMat2 + cName + cBatch + cBatch2 + cStruct + cRecv + cGrp + cWt + cLine + cA + cF + cD1 + cD2 + cD3 + cD4);
  const h1 = 6, h2 = 11, hH = h1 + h2;
  const rowH = Math.floor(((H - (tY + hH) - 62) / rows) * 10) / 10;

  const header = (page, total) => {
    text('บริษัท ไอ-เทล คอร์ปอเรชั่น จำกัด (มหาชน)', W / 2, 11, { size: 15, bold: true });
    text('ใบสอบกลับการผลิต (Traceability / Traceback Record)', W / 2, 18, { size: 11, bold: true });
    text('F3PFTB01-1', W - M, 11, { size: 8, align: 'right' });

    const y = 25;
    const items = [
      ['เลขเอกสารผลิต:', docNo || s.doc_no, 32],
      ['Code สินค้า:', code || s.code, 48],
      ['ไลน์ผลิต:', (s.lines || []).join(', '), 40],
      ['ช่วงเวลาที่สอบกลับ:', `${fmtD(s.rm_date_first || s.pack_date_first)} - ${fmtD(s.pack_date_last)}`, 48],
    ];
    let x = M;
    items.forEach(([lb, val, w]) => {
      text(lb, x, y, { size: 8, align: 'left', bold: true });
      const lw = doc.getTextWidth(lb);
      const x1 = x + lw + 1.5, x2 = x1 + w;
      doc.setDrawColor(0); doc.setLineWidth(0.2); doc.line(x1, y + 1, x2, y + 1);
      if (val) text(val, x1 + w / 2, y - 0.5, { size: 8 });
      x = x2 + 5;
    });
    text(`หน้า ${page} / ${total}`, W - M, y, { size: 8, align: 'right' });
  };

  const tableHead = () => {
    let x = tX; const y = tY;
    cell('รหัส\nวัตถุดิบ', x, y, cMat, hH, { bg: HB, bold: true, size: 6.5 }); x += cMat;
    cell('รหัส\nวัตถุดิบ 2x', x, y, cMat2, hH, { bg: OB, bold: true, size: 6.5 }); x += cMat2;
    cell('ชื่อวัตถุดิบ\n(Raw Material)', x, y, cName, hH, { bg: HB, bold: true, size: 6.5 }); x += cName;
    fill(x, y, cBatch, h1, HB); rect(x, y, cBatch, h1);
    text('รหัสรุ่น (Batch)', x + cBatch / 2, y + h1 / 2 + 1.6, { size: 6.5, bold: true });
    for (let i = 0; i < bCols; i++) cell('', x + i * bW, y + h1, bW, h2, { bg: HB, size: 6 });
    x += cBatch;
    cell('รหัสรุ่น 2x\n(Batch 2x)', x, y, cBatch2, hH, { bg: OB, bold: true, size: 6.5 }); x += cBatch2;
    cell('ผู้ขาย /\nผู้ส่งมอบ', x, y, cStruct, hH, { bg: OB, bold: true, size: 6.5 }); x += cStruct;
    cell('วันที่ล็อต\n(รับเข้า)', x, y, cRecv, hH, { bg: OB, bold: true, size: 6.5 }); x += cRecv;
    cell('กลุ่ม\nวัตถุดิบ', x, y, cGrp, hH, { bg: HB, bold: true, size: 6.5 }); x += cGrp;
    cell('น้ำหนัก\n(kg)', x, y, cWt, hH, { bg: HB, bold: true, size: 6.5 }); x += cWt;
    cell('ไลน์', x, y, cLine, hH, { bg: HB, bold: true, size: 6.5 }); x += cLine;
    cell('เตรียมเสร็จ\n(A)', x, y, cA, hH, { bg: HB, bold: true, size: 6.5 }); x += cA;
    cell('บรรจุเสร็จ\n(F)', x, y, cF, hH, { bg: HB, bold: true, size: 6.5 }); x += cF;
    const dW = cD1 + cD2 + cD3 + cD4;
    fill(x, y, dW, h1, OB); rect(x, y, dW, h1);
    text('ดีเลย์ (Delay time)', x + dW / 2, y + h1 / 2 + 1.6, { size: 6.5, bold: true });
    [['DBS1', cD1], ['DBS2', cD2], ['DBS3', cD3], ['DBS4', cD4]].forEach(([l, w]) => {
      cell(l, x, y + h1, w, h2, { bg: OB, bold: true, size: 6.5 }); x += w;
    });
    cell('หมายเหตุ\n(Remark)', x, y, cRem, hH, { bg: HB, bold: true, size: 6.5 });
  };

  const footer = () => {
    const fy = tY + hH + rows * rowH + 6;
    text('เกณฑ์ดีเลย์: DBS1 เตรียมเสร็จ→เข้าห้องเย็น | DBS2 เข้าห้องเย็น→ออกห้องเย็น | DBS3 ออกห้องเย็น→บรรจุเสร็จ | DBS4 รวมทั้งกระบวนการ',
      M, fy, { size: 7, align: 'left' });
    text('ช่องที่แรเงาและมีเครื่องหมาย ! คือค่าที่เกินมาตรฐานของกลุ่มวัตถุดิบนั้น', M, fy + 4, { size: 7, align: 'left' });
    text('เอกสารนี้สร้างจากระบบ PFCM อัตโนมัติ มีข้อมูลเชิงพาณิชย์ที่เป็นความลับ ใช้ภายในองค์กรเท่านั้น',
      M, fy + 8, { size: 7, align: 'left' });

    const sy = fy + 20;
    [
      ['ผู้จัดทำ (Recorded by)', sign.recordedBy, M + 45],
      ['ผู้ตรวจสอบ (Reviewed by)', sign.reviewedBy, W / 2],
      ['ผู้อนุมัติ (QC Manager)', sign.qcManager, W - M - 45],
    ].forEach(([lb, name, x]) => {
      doc.setDrawColor(0); doc.setLineWidth(0.2);
      doc.line(x - 32, sy, x + 32, sy);
      if (name) text(name, x, sy - 1.5, { size: 8, bold: true });
      text(lb, x, sy + 5, { size: 8 });
      doc.line(x - 32, sy + 12, x + 32, sy + 12);
      text('วันที่ / Date', x, sy + 17, { size: 7.5 });
    });
  };

  const total = Math.max(1, Math.ceil(materials.length / rows));
  for (let p = 1; p <= total; p++) {
    if (p > 1) doc.addPage();
    header(p, total);
    tableHead();

    const slice = materials.slice((p - 1) * rows, p * rows);
    slice.forEach((m, i) => {
      const y = tY + hH + i * rowH;
      const bgRow = i % 2 ? [246, 250, 253] : [255, 255, 255];
      const d = buildDelay(m);
      let x = tX;
      const c = (t, w, o = {}) => { cell(t, x, y, w, rowH, { bg: bgRow, size: 6.5, ...o }); x += w; };
      const cOver = (t, w, over) => {
        cell(over ? `! ${t}` : t, x, y, w, rowH,
          { bg: over ? RB : bgRow, size: 6.5, bold: over, color: over ? [168, 30, 20] : [0, 0, 0] });
        x += w;
      };

      c(m.mat, cMat);
      c(m.mat_2x || '-', cMat2);
      c(m.mat_name, cName, { align: 'left' });
      const bs = String(m.batch_before ?? '').padEnd(bCols, ' ');
      for (let b = 0; b < bCols; b++) c(bs[b] || '', bW, { size: 7, bold: true });
      c(m.batch_after || '-', cBatch2, { size: 6 });
      c(m.supplier_name || '-', cStruct, { size: 5.5, align: 'left' });
      c(m.batch_date ? fmtD(m.batch_date) : '-', cRecv, { size: 6 });
      c(m.rm_group_name || m.rm_group_id || '-', cGrp, { size: 6 });
      c(m.weight_RM != null ? Number(m.weight_RM).toFixed(1) : '-', cWt);
      c(m.rmm_line_name || '-', cLine, { size: 6 });
      c(d.mapped._A ? fmtDT(d.mapped._A).replace(' ', '\n') : '-', cA, { size: 5.8 });
      c(d.mapped._F ? fmtDT(d.mapped._F).replace(' ', '\n') : '-', cF, { size: 5.8 });
      cOver(d.value.dbs1 == null ? '-' : fmtDur(d.value.dbs1), cD1, d.over.dbs1);
      cOver(d.value.dbs2 == null ? '-' : fmtDur(d.value.dbs2), cD2, d.over.dbs2);
      cOver(d.value.dbs3 == null ? '-' : fmtDur(d.value.dbs3), cD3, d.over.dbs3);
      cOver(d.value.dbs4 == null ? '-' : fmtDur(d.value.dbs4), cD4, d.over.dbs4);
      c(m.history?.remark_dalay || '', cRem, { align: 'left', size: 6 });
    });

    for (let e = slice.length; e < rows; e++) {
      const y = tY + hH + e * rowH;
      let x = tX;
      [cMat, cMat2, cName, ...Array(bCols).fill(bW), cBatch2, cStruct, cRecv, cGrp, cWt, cLine, cA, cF, cD1, cD2, cD3, cD4, cRem]
        .forEach(w => { rect(x, y, w, rowH); x += w; });
    }

    footer();
  }

  doc.save(`Traceback_${docNo || s.doc_no || 'record'}_${new Date().toISOString().slice(0, 10)}.pdf`);
};

/* ── กล่องกรอกลายเซ็นก่อน export ─────────────────────────────────────────── */
const SignDialog = ({ open, onClose, onExport }) => {
  const [v, setV] = useState({ recordedBy: '', reviewedBy: '', qcManager: '' });
  if (!open) return null;
  const F = ({ k, label, sub }) => (
    <div style={{ flex: 1, minWidth: 190 }}>
      <div style={{ fontSize: 12, color: T.blueDeep, fontWeight: 600, marginBottom: 5 }}>{label}</div>
      <input value={v[k]} onChange={e => setV(p => ({ ...p, [k]: e.target.value }))}
        style={{
          width: '100%', height: 38, padding: '0 12px', borderRadius: 9, fontSize: 13,
          border: `1.5px solid ${T.line}`, color: T.text, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
        }} />
      <div style={{ fontSize: 11, color: T.text2, marginTop: 4, fontWeight: 400 }}>{sub}</div>
    </div>
  );
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,39,64,0.45)', zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{ background: T.white, borderRadius: 14, width: 'min(680px,94vw)', overflow: 'hidden' }}>
        <div style={{ background: T.blue, color: T.white, padding: '13px 18px', fontSize: 15, fontWeight: 600 }}>
          ระบุผู้ลงนามก่อนออกเอกสาร
        </div>
        <div style={{ padding: 18, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <F k="recordedBy" label="ผู้จัดทำ" sub="Recorded by (Production Staff)" />
          <F k="reviewedBy" label="ผู้ตรวจสอบ" sub="Reviewed by (Section Manager)" />
          <F k="qcManager" label="ผู้อนุมัติ" sub="QC Section Manager" />
        </div>
        <div style={{ padding: '0 18px 18px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            height: 40, padding: '0 18px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
            background: T.white, border: `1.5px solid ${T.line}`, color: T.text2, fontSize: 13, fontWeight: 500,
          }}>ยกเลิก</button>
          <button onClick={() => { onExport(v); onClose(); }} style={{
            height: 40, padding: '0 22px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
            background: T.orange, border: 'none', color: T.white, fontSize: 13, fontWeight: 600,
          }}>ออกเอกสาร PDF</button>
        </div>
      </div>
    </div>
  );
};

/* ═══ แท็บ 1 — ชั้นสรุป ═══════════════════════════════════════════════════ */
const SummaryTab = ({ data, docNo, code, onOpenTrace }) => {
  const s = data.summary || {};
  const materials = data.materials || [];
  const [f, setF] = useState({ mat: '', mat2x: '', batch: '', batch2x: '', line: '', supplier: '', status: '' });
  const clear = () => setF({ mat: '', mat2x: '', batch: '', batch2x: '', line: '', supplier: '', status: '' });

  const enriched = useMemo(() => materials.map(m => ({ ...m, _d: buildDelay(m) })), [materials]);

  const shown = useMemo(() => enriched.filter(m => (
    (!f.mat || m.mat === f.mat)
    && (!f.mat2x || m.mat_2x === f.mat2x)
    && (!f.batch || m.batch_before === f.batch)
    && (!f.batch2x || m.batch_after === f.batch2x)
    && (!f.line || m.rmm_line_name === f.line)
    && (!f.supplier || m.supplier_name === f.supplier)
    && (!f.status || (f.status === 'over' ? m._d.anyOver
      : f.status === 'nointake' ? !m.intake
      : f.status === 'defect' ? !!m.intake_defect
      : !m._d.anyOver))
  )), [enriched, f]);

  const rmRows = useMemo(() => {
    const map = new Map();
    shown.forEach(m => {
      const k = `${m.mat}|${m.batch_before}`;
      if (!map.has(k)) {
        map.set(k, {
          key: k, mat: m.mat, mat_2x: m.mat_2x, mat_name: m.mat_name,
          batch: m.batch_before, batch_2x: m.batch_after,
          supplier: m.supplier_name || m.supplier_code,
          batch_date: m.batch_date, decision: m.intake_decision,
          defect: m.intake_defect, temp_avg: m.intake_temp_avg,
          has_intake: !!m.intake,
          group: m.rm_group_name, lots: [], weight: 0, over: 0,
        });
      }
      const e = map.get(k);
      e.lots.push(m); e.weight += Number(m.weight_RM) || 0;
      if (m._d.anyOver) e.over++;
    });
    return [...map.values()];
  }, [shown]);

  const ingRows = useMemo(() => {
    const map = new Map();
    shown.forEach(m => (m.ingredient_summary || []).forEach(g => {
      const k = `${g.material_code}|${g.batch_no || ''}`;
      if (!map.has(k)) map.set(k, { key: k, ...g, net: 0, baskets: 0, oos: 0, lots: [] });
      const e = map.get(k);
      e.net += g.net_weight || 0; e.baskets += g.basket_count || 0; e.oos += g.out_of_spec_count || 0;
      if (!e.lots.includes(m)) e.lots.push(m);
    }));
    return [...map.values()].sort((a, b) => b.net - a.net);
  }, [shown]);

  const pkgRows = useMemo(() => {
    const map = new Map();
    shown.forEach(m => (m.packaging || []).forEach(p => {
      const k = `${p.code}|${p.lot_no}|${p.batch_no}`;
      if (!map.has(k)) map.set(k, { key: k, ...p, lots: [], details: new Set() });
      const e = map.get(k);
      if (!e.lots.includes(m)) e.lots.push(m);
      e.details.add(p.detail_id);
    }));
    return [...map.values()];
  }, [shown]);

  const overCount = shown.filter(m => m._d.anyOver).length;

  return (
    <div>
      <FilterBar onClear={clear} count={shown.length}>
        <SearchSelect label="รหัสวัตถุดิบ (Mat)" value={f.mat} onChange={v => setF(p => ({ ...p, mat: v }))}
          options={uniq(materials.map(m => m.mat))} width={165} />
        <SearchSelect label="รหัสวัตถุดิบ 2x (Mat 2x)" value={f.mat2x} onChange={v => setF(p => ({ ...p, mat2x: v }))}
          options={uniq(materials.map(m => m.mat_2x))} width={175} />
        <SearchSelect label="รหัสรุ่น (Batch)" value={f.batch} onChange={v => setF(p => ({ ...p, batch: v }))}
          options={uniq(materials.map(m => m.batch_before))} width={175} />
        <SearchSelect label="รหัสรุ่น 2x (Batch 2x)" value={f.batch2x} onChange={v => setF(p => ({ ...p, batch2x: v }))}
          options={uniq(materials.map(m => m.batch_after))} width={180} />
        <SearchSelect label="ไลน์ผลิต" value={f.line} onChange={v => setF(p => ({ ...p, line: v }))}
          options={uniq(materials.map(m => m.rmm_line_name))} width={140} />
        <SearchSelect label="ผู้ขาย" value={f.supplier} onChange={v => setF(p => ({ ...p, supplier: v }))}
          options={uniq(materials.map(m => m.supplier_name))} width={215} />
        <SearchSelect label="สถานะ" value={f.status} onChange={v => setF(p => ({ ...p, status: v }))} width={195}
          options={[
            { value: 'over', label: 'ดีเลย์เกินมาตรฐาน' },
            { value: 'ok', label: 'ดีเลย์อยู่ในมาตรฐาน' },
            { value: 'defect', label: 'มีข้อบกพร่องตอนรับเข้า' },
            { value: 'nointake', label: 'ไม่พบในระบบรับเข้า' },
          ]} />
      </FilterBar>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 11, marginBottom: 6 }}>
        <Kpi label="ล็อตวัตถุดิบ" value={shown.length} sub={`${rmRows.length} ชุด Mat + Batch`} />
        <Kpi label="น้ำหนักรวม (kg)" value={fmtNum(shown.reduce((a, m) => a + (Number(m.weight_RM) || 0), 0), 1)} tone="ok" />
        <Kpi label="เกินมาตรฐาน DBS" value={overCount} tone={overCount ? 'bad' : 'ok'} sub="เทียบเกณฑ์ตามกลุ่มวัตถุดิบ" />
        <Kpi label="พบในระบบรับเข้า" value={`${shown.filter(m => m.intake).length}/${shown.length}`} tone="orange"
          sub={`ผู้ขาย ${uniq(shown.map(m => m.supplier_name)).length} ราย`} />
        <Kpi label="ชนิดส่วนผสม" value={ingRows.length} sub={`หลุดพิกัด ${ingRows.reduce((a, g) => a + g.oos, 0)} ครั้ง`} />
        <Kpi label="ชนิดบรรจุภัณฑ์" value={pkgRows.length} />
      </div>

      {/* หมายเหตุ: ข้อ 2/3 — แถวในตารางชั้นสรุปไม่ขยายรายละเอียดเมื่อคลิก
          ต้องกดปุ่ม "ดูเส้นทาง" เท่านั้นถึงจะไปดูรายละเอียด (แท็บแผนผังสอบกลับ)
          และตัดคอลัมน์ กลุ่มวัตถุดิบ / ล็อต / เกินเกณฑ์ ออกจากตารางหลักแล้ว
          (ยังดูได้ในแท็บ "ชั้นรายละเอียด" และหลังกด "ดูเส้นทาง") */}
      <SectionTitle no="1" title="วัตถุดิบและรหัสรุ่น" count={rmRows.length} hint="กดปุ่มดูเส้นทางเพื่อดูรายละเอียดการสอบกลับ" />
      <DataTable
        rows={rmRows} getKey={r => r.key}
        rowTone={r => (r.over ? 'bad' : null)}
        columns={[
          { key: 'mat', label: 'Mat', render: r => <b>{r.mat}</b> },
          { key: 'mat_2x', label: 'Mat 2x', render: r => (r.mat_2x ? <Tag tone={r.mat_2x === r.mat ? 'plain' : 'orange'}>{r.mat_2x}</Tag> : '—') },
          { key: 'mat_name', label: 'ชื่อวัตถุดิบ', wrap: true, minWidth: 180 },
          { key: 'batch', label: 'Batch', render: r => <span style={{ fontFamily: 'ui-monospace,monospace', fontWeight: 600 }}>{r.batch || '—'}</span> },
          { key: 'batch_2x', label: 'Batch 2x', render: r => (r.batch_2x
              ? <span style={{ fontFamily: 'ui-monospace,monospace', fontWeight: 600, color: r.batch_2x === r.batch ? T.text2 : T.orange }}>{r.batch_2x}</span>
              : '—') },
          { key: 'batch_date', label: 'วันที่ล็อต (รับเข้า)', render: r => (r.batch_date ? fmtD(r.batch_date) : '—') },
          { key: 'decision', label: 'ผลตรวจรับเข้า',
            render: r => (r.has_intake
              ? <Tag tone={r.decision === 'A01' ? 'ok' : 'orange'}>{r.decision || '—'}</Tag>
              : <Tag tone="orange">ไม่พบในระบบรับ</Tag>) },
          { key: 'temp_avg', label: 'อุณหภูมิ', align: 'right',
            render: r => (r.temp_avg != null ? `${r.temp_avg} °C` : '—') },
          { key: 'defect', label: 'ข้อบกพร่อง', wrap: true, minWidth: 150,
            render: r => (r.defect ? <Tag tone="bad">{r.defect}</Tag> : '—') },
          { key: 'supplier', label: 'ผู้ขาย', wrap: true, minWidth: 130 },
          { key: 'weight', label: 'น้ำหนัก (kg)', align: 'right', render: r => fmtNum(r.weight, 1) },
          { key: 'trace', label: 'สอบกลับ', render: r => (
            <button onClick={() => onOpenTrace('rm', `${r.mat}|${r.batch || ''}`)}
              style={BTN_SM}>ดูเส้นทาง</button>
          ) },
        ]}
      />

      <SectionTitle no="2" title="ส่วนผสม (Ingredient)" count={ingRows.length} />
      <DataTable
        rows={ingRows} getKey={r => r.key}
        rowTone={r => (r.oos ? 'orange' : null)}
        columns={[
          { key: 'material_code', label: 'รหัส', render: r => <b>{r.material_code}</b> },
          { key: 'material_name', label: 'ชื่อส่วนผสม', wrap: true, minWidth: 190 },
          { key: 'batch_no', label: 'Batch' },
          { key: 'net', label: 'น้ำหนักรวม (kg)', align: 'right', render: r => fmtNum(r.net, 3) },
          { key: 'std_weight', label: 'มาตรฐาน/ตะกร้า', align: 'right', render: r => fmtNum(r.std_weight, 3) },
          { key: 'baskets', label: 'ตะกร้า', align: 'right' },
          { key: 'oos', label: 'หลุดพิกัด', align: 'right', render: r => (r.oos ? <Tag tone="bad">{r.oos}</Tag> : <Tag tone="ok">ครบ</Tag>) },
          { key: 'trace', label: 'สอบกลับ', render: r => (
            <button onClick={() => onOpenTrace('ing', r.key)} style={BTN_SM}>ดูเส้นทาง</button>
          ) },
        ]}
      />

      <SectionTitle no="3" title="บรรจุภัณฑ์ (Packaging)" count={pkgRows.length} />
      <DataTable
        rows={pkgRows} getKey={r => r.key}
        columns={[
          { key: 'code', label: 'Code', render: r => <b>{r.code || r.material_no}</b> },
          { key: 'material_no', label: 'Material No' },
          { key: 'batch_no', label: 'Batch' },
          { key: 'lot_no', label: 'Lot' },
          { key: 'line_name', label: 'ไลน์', render: r => r.report_line_name || r.line_name || '—' },
          { key: 'produce_date', label: 'วันที่ผลิต (โรงงานบรรจุภัณฑ์)', render: r => (r.produce_date ? fmtD(r.produce_date) : '—') },
          { key: 'use', label: 'ช่วงใช้บนไลน์', render: r => fmtRange(r.start_time, r.stop_time) },
          { key: 'lots', label: 'ล็อตที่ใช้', align: 'right', render: r => r.lots.length },
          { key: 'trace', label: 'สอบกลับ', render: r => (
            <button onClick={() => onOpenTrace('pkg', r.key)} style={BTN_SM}>ดูเส้นทาง</button>
          ) },
        ]}
      />
    </div>
  );
};

const BTN_SM = {
  height: 28, padding: '0 12px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit',
  background: T.orangeSoft, border: `1.5px solid ${T.orangeLine}`, color: T.orange, fontSize: 12, fontWeight: 600,
};

/* ═══ แท็บ 2 — แผนผังสอบกลับ (Forward / Backward) ═════════════════════════
   ข้อ 1: สอบกลับข้ามเอกสารได้ทั้ง 3 ประเภท (วัตถุดิบ/ส่วนผสม/บรรจุภัณฑ์)
   ใช้ endpoint เดียวกัน /api/traceback/batch/:code/trace โดยส่งรหัสที่
   เหมาะกับประเภทนั้น ๆ (rm → batch วัตถุดิบ, ing → batch ส่วนผสม,
   pkg → batch/lot บรรจุภัณฑ์). ฝั่ง backend ต้องรองรับรหัสทั้ง 3 แบบ
   ในตาราง Batch/ระบบที่เกี่ยวข้อง — ถ้า endpoint ปัจจุบันรองรับเฉพาะ
   batch วัตถุดิบ ให้แจ้งกลับเพื่อขยาย endpoint ฝั่ง Tracebackbatch.js
   ═══════════════════════════════════════════════════════════════════════ */
const FlowTab = ({ data, focus, setFocus }) => {
  const s = data.summary || {};
  const materials = data.materials || [];
  const idx = useMemo(() => buildIndex(materials), [materials]);

  const [type, setType] = useState(focus?.type || 'rm');
  const [key, setKey] = useState(focus?.key || '');
  const [dir, setDir] = useState('both');
  const [ext, setExt] = useState(null);
  const [extLoading, setExtLoading] = useState(false);

  useEffect(() => {
    if (focus?.type) { setType(focus.type); setKey(focus.key); }
  }, [focus]);

  const list = idx[type] || [];
  const entity = list.find(e => e.key === key) || null;

  // รหัสที่ใช้เรียก endpoint ข้ามเอกสาร ตามประเภทที่กำลังดู
  const traceCode = entity ? (type === 'rm' ? entity.batch : type === 'ing' ? entity.batch : entity.lot || entity.batch) : null;

  // สอบกลับข้ามเอกสารสำหรับทั้ง 3 ประเภท — ใช้ endpoint /batch/:code/trace ร่วมกัน
  useEffect(() => {
    setExt(null);
    if (!traceCode) return;
    let cancel = false;
    (async () => {
      try {
        setExtLoading(true);
        const res = await axios.get(`${API_URL}/api/traceback/batch/${encodeURIComponent(traceCode)}/trace`, {
          params: { entity_type: type },
        });
        if (!cancel) setExt(res.data?.data || null);
      } catch { if (!cancel) setExt(null); } finally { if (!cancel) setExtLoading(false); }
    })();
    return () => { cancel = true; };
  }, [type, traceCode]);

  // ค้นหาได้จากทั้ง mat, mat 2x, batch, batch 2x  (ฝังไว้ใน label ให้ตัวกรองจับได้)
  const options = list.map(e => {
    const extra = [
      e.code2 && e.code2 !== e.code ? `2x ${e.code2}` : '',
      e.batch ? e.batch : '',
      e.batch2 && e.batch2 !== e.batch ? e.batch2 : '',
    ].filter(Boolean).join(' ');
    return {
      value: e.key,
      label: `${e.code || '—'} · ${e.name || ''}`.trim() + (extra ? `  ⟨${extra}⟩` : ''),
      meta: e.batch ? `Batch ${e.batch}` : '',
    };
  });

  return (
    <div>
      <FilterBar onClear={() => { setKey(''); setFocus(null); }}>
        <SearchSelect label="ประเภทข้อมูล" value={type} width={150}
          onChange={v => { setType(v || 'rm'); setKey(''); }}
          options={[
            { value: 'rm', label: 'วัตถุดิบ' },
            { value: 'ing', label: 'ส่วนผสม' },
            { value: 'pkg', label: 'บรรจุภัณฑ์' },
          ]} />
        <SearchSelect label={`เลือก${ENTITY_LABEL[type]}ที่ต้องการสอบกลับ`} value={key} onChange={setKey}
          options={options} width={330} placeholder="พิมพ์รหัสหรือชื่อเพื่อค้นหา" />
        <SearchSelect label="ทิศทาง" value={dir} width={190} onChange={v => setDir(v || 'both')}
          options={[
            { value: 'both', label: 'ทั้งสองทิศทาง' },
            { value: 'back', label: 'ย้อนกลับ (Backward)' },
            { value: 'fwd', label: 'ไปข้างหน้า (Forward)' },
          ]} />
      </FilterBar>

      {!entity && (
        <div style={{ border: `2px dashed ${T.blueLine}`, borderRadius: 12, padding: '46px 24px', textAlign: 'center', background: T.white }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.blueDeep, marginBottom: 7 }}>
            เลือก{ENTITY_LABEL[type]}ที่ต้องการสอบกลับ
          </div>
          <div style={{ fontSize: 13, color: T.text2, fontWeight: 400 }}>
            ระบบจะแสดงเส้นทางย้อนกลับไปหาต้นทาง และเส้นทางไปข้างหน้าถึงสินค้าที่ผลิตออกมา
          </div>
        </div>
      )}

      {entity && (
        <>
          <div style={{
            background: T.blue, color: T.white, borderRadius: 12, padding: '14px 18px',
            display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, opacity: 0.9 }}>{ENTITY_LABEL[type]}ที่กำลังสอบกลับ</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 3 }}>
                {entity.code} {entity.name ? `· ${entity.name}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {entity.code2 && entity.code2 !== entity.code && <Tag tone="plain">Mat 2x {entity.code2}</Tag>}
              {entity.batch && <Tag tone="plain">Batch {entity.batch}</Tag>}
              {entity.batch2 && entity.batch2 !== entity.batch && <Tag tone="plain">Batch 2x {entity.batch2}</Tag>}
              {entity.lot && <Tag tone="plain">Lot {entity.lot}</Tag>}
              <Tag tone="plain">{entity.lots.length} ล็อตการผลิต</Tag>
            </div>
          </div>

          <Legend />

          {/* ── ย้อนกลับ ── */}
          {dir !== 'fwd' && (
            <Panel title="◀ สอบกลับย้อนทาง (Backward) — ที่มาของรายการนี้" tone="orange">
              {type === 'rm' && (
                <div style={{ overflowX: 'auto' }}>
                  <div style={{ display: 'flex', gap: 5, minWidth: 'min-content' }}>
                    <Node title="ผู้ส่งมอบ" ev={entity.lots[0]?.intake ? 'doc' : 'none'} lines={[
                      { k: 'ผู้ขาย', v: entity.lots[0]?.supplier_name || entity.lots[0]?.supplier_code },
                      { k: 'ชนิด', v: entity.lots[0]?.fish_specie },
                      { k: 'ผลตรวจ', v: entity.lots[0]?.intake_decision },
                    ]} />
                    <Arrow dir="f" />
                    <Node title="รับเข้าโรงงาน" ev={entity.lots[0]?.intake ? 'doc' : 'none'} lines={[
                      { k: 'Batch', v: entity.batch },
                      { k: 'Batch 2x', v: entity.batch2 && entity.batch2 !== entity.batch ? entity.batch2 : null },
                      { k: 'วันที่ล็อต', v: entity.lots[0]?.batch_date && fmtD(entity.lots[0].batch_date) },
                      { k: 'ผลิต(Supp)', v: entity.lots[0]?.produce_date },
                      { k: 'ปริมาณ', v: entity.lots[0]?.receive_qty != null
                          ? `${fmtNum(entity.lots[0].receive_qty, 0)} ${entity.lots[0].receive_unit || ''}` : null },
                    ]} />
                    <Arrow dir="f" />
                    <Node title="ล็อตในโรงงาน" lines={[
                      { k: 'Mat', v: entity.code },
                      { k: 'Mat 2x', v: entity.code2 && entity.code2 !== entity.code ? entity.code2 : null },
                      { k: 'จำนวน', v: `${entity.lots.length} ล็อต` },
                      { k: 'น้ำหนัก', v: `${fmtNum(entity.lots.reduce((a, m) => a + (Number(m.weight_RM) || 0), 0), 1)} kg` },
                    ]} />
                  </div>
                </div>
              )}

              {type === 'ing' && (
                <div>
                  <Txt c={T.text2} size={12.5}>ส่วนผสมนี้ถูกชั่งและผสมในใบสั่งผลิตด้านล่าง ก่อนนำเข้าสู่ล็อตวัตถุดิบ</Txt>
                  <DataTable
                    rows={entity.rows} getKey={(r, i) => i}
                    rowTone={r => (r.out_of_spec_count ? 'orange' : null)}
                    columns={[
                      { key: 'wo', label: 'WO', render: r => (r._m.wo_list || []).join(', ') || '—' },
                      { key: 'mat', label: 'ใช้ในล็อตวัตถุดิบ', render: r => `${r._m.mat} · ${r._m.mat_name}`, wrap: true, minWidth: 200 },
                      { key: 'basket_count', label: 'ตะกร้า', align: 'right' },
                      { key: 'net_weight', label: 'น้ำหนักรวม (kg)', align: 'right', render: r => fmtNum(r.net_weight, 3) },
                      { key: 'spec', label: 'พิกัด', render: r => `${fmtNum(r.min_weight, 3)} – ${fmtNum(r.max_weight, 3)}` },
                      { key: 'oos', label: 'หลุดพิกัด', align: 'right', render: r => (r.out_of_spec_count ? <Tag tone="bad">{r.out_of_spec_count}</Tag> : <Tag tone="ok">ครบ</Tag>) },
                      { key: 'mix', label: 'ช่วงเวลาผสม', render: r => fmtRange(r.used_from, r.used_to) },
                    ]}
                  />
                </div>
              )}

              {type === 'pkg' && (
                <DataTable
                  rows={entity.rows} getKey={(r, i) => r.detail_id ?? i}
                  columns={[
                    { key: 'slip_id', label: 'ใบเบิก (Slip)' },
                    { key: 'slip_line_name', label: 'ไลน์ที่ออกใบเบิก' },
                    { key: 'produce_date', label: 'วันที่ผลิตวัสดุ (โรงงานบรรจุภัณฑ์)', render: r => (r.produce_date ? fmtD(r.produce_date) : '—') },
                    { key: 'receive_date', label: 'วันที่รับเข้า', render: r => (r.receive_date ? fmtD(r.receive_date) : '—') },
                    { key: 'hu_no', label: 'HU' },
                    { key: 'box_no', label: 'กล่อง', align: 'right' },
                    { key: 'slip_size', label: 'ขนาด' },
                    { key: 'slip_qty', label: 'จำนวนในใบเบิก', align: 'right', render: r => fmtNum(r.slip_qty, 0) },
                  ]}
                />
              )}
            </Panel>
          )}

          {/* ── ไปข้างหน้า ── */}
          {dir !== 'back' && (
            <Panel title="▶ สอบกลับไปข้างหน้า (Forward) — รายการนี้ไปอยู่ในสินค้าใดบ้าง">
              <DataTable
                rows={entity.lots} getKey={m => m.mapping_id}
                rowTone={m => (buildDelay(m).anyOver ? 'bad' : null)}
                columns={[
                  { key: 'mapping_id', label: 'mapping_id' },
                  { key: 'mat', label: 'วัตถุดิบ', render: m => `${m.mat} · ${m.mat_name}`, wrap: true, minWidth: 200 },
                  { key: 'mat_2x', label: 'Mat 2x', render: m => (m.mat_2x || '—') },
                  { key: 'batch_after', label: 'Batch 2x', render: m => <span style={{ fontFamily: 'ui-monospace,monospace' }}>{m.batch_after || '—'}</span> },
                  { key: 'doc', label: 'เอกสารผลิต', render: m => m.raw?.Production?.doc_no || s.doc_no },
                  { key: 'code', label: 'Code สินค้า', render: m => m.raw?.Production?.code || s.code, wrap: true, minWidth: 160 },
                  { key: 'rmm_line_name', label: 'ไลน์' },
                  { key: 'sc_pack_date', label: 'บรรจุเสร็จ (โรงงาน)', render: m => fmtDT(m.sc_pack_date) },
                  { key: 'dbs4', label: 'DBS4', align: 'right', render: m => { const d = buildDelay(m); return <DelayTag minutes={d.value.dbs4} over={d.over.dbs4} />; } },
                ]}
                renderExpanded={m => <LotFlow m={m} summary={s} />}
              />

              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.blueDeep, marginBottom: 8 }}>
                  การใช้งานข้ามเอกสาร (ทั้งระบบ)
                </div>
                {extLoading && <Txt c={T.text2}>กำลังค้นหาการใช้งานในเอกสารอื่น...</Txt>}
                {!extLoading && ext?.products?.length > 0 && (
                  <DataTable
                    rows={ext.products} getKey={(p, i) => `${p.doc_no}-${p.code}-${i}`}
                    columns={[
                      { key: 'doc_no', label: 'เอกสารผลิต', render: p => <b>{p.doc_no}</b> },
                      { key: 'code', label: 'Code สินค้า', wrap: true, minWidth: 180 },
                      { key: 'lots', label: 'ล็อต', align: 'right' },
                      { key: 'total_weight', label: 'น้ำหนักรวม (kg)', align: 'right', render: p => fmtNum(p.total_weight, 1) },
                      { key: 'lines', label: 'ไลน์', render: p => (p.lines || []).join(', ') },
                      { key: 'pack_first', label: 'ช่วงบรรจุ', render: p => fmtRange(p.pack_first, p.pack_last) },
                    ]}
                  />
                )}
                {!extLoading && (!ext || !ext.products?.length) && (
                  <Txt c={T.text2}>
                    ไม่พบการใช้งานในเอกสารอื่น หรือระบบยังไม่เปิดใช้ endpoint สอบกลับข้ามเอกสารสำหรับประเภท "{ENTITY_LABEL[type]}"
                    (ปัจจุบัน endpoint /api/traceback/batch/:code/trace ยืนยันแล้วว่ารองรับวัตถุดิบ — ส่วนผสม/บรรจุภัณฑ์ต้องตรวจสอบฝั่ง backend เพิ่มเติม)
                  </Txt>
                )}
              </div>
            </Panel>
          )}
        </>
      )}
    </div>
  );
};

/* ═══ แท็บ 3 — ชั้นรายละเอียดรายล็อต ══════════════════════════════════════ */
const DetailTab = ({ data, onOpenTrace }) => {
  const s = data.summary || {};
  const materials = data.materials || [];
  const [f, setF] = useState({ mat: '', mat2x: '', batch: '', batch2x: '', line: '', supplier: '', qc: '', delay: '' });
  const clear = () => setF({ mat: '', mat2x: '', batch: '', batch2x: '', line: '', supplier: '', qc: '', delay: '' });

  const rows = useMemo(() => materials.map(m => ({ ...m, _d: buildDelay(m) })), [materials]);

  const shown = useMemo(() => rows.filter(m => {
    const qcFail = [m.qccheck, m.mdcheck, m.defectcheck].some(v => v && String(v).trim() !== 'ผ่าน');
    return (!f.mat || m.mat === f.mat)
      && (!f.mat2x || m.mat_2x === f.mat2x)
      && (!f.batch || m.batch_before === f.batch)
      && (!f.batch2x || m.batch_after === f.batch2x)
      && (!f.line || m.rmm_line_name === f.line)
      && (!f.supplier || m.supplier_name === f.supplier)
      && (!f.qc || (f.qc === 'fail' ? qcFail : !qcFail))
      && (!f.delay || (f.delay === 'over' ? m._d.anyOver : !m._d.anyOver));
  }), [rows, f]);

  return (
    <div>
      <FilterBar onClear={clear} count={shown.length}>
        <SearchSelect label="รหัสวัตถุดิบ (Mat)" value={f.mat} onChange={v => setF(p => ({ ...p, mat: v }))} options={uniq(materials.map(m => m.mat))} width={165} />
        <SearchSelect label="รหัสวัตถุดิบ 2x" value={f.mat2x} onChange={v => setF(p => ({ ...p, mat2x: v }))} options={uniq(materials.map(m => m.mat_2x))} width={170} />
        <SearchSelect label="รหัสรุ่น (Batch)" value={f.batch} onChange={v => setF(p => ({ ...p, batch: v }))} options={uniq(materials.map(m => m.batch_before))} width={175} />
        <SearchSelect label="รหัสรุ่น 2x" value={f.batch2x} onChange={v => setF(p => ({ ...p, batch2x: v }))} options={uniq(materials.map(m => m.batch_after))} width={175} />
        <SearchSelect label="ไลน์ผลิต" value={f.line} onChange={v => setF(p => ({ ...p, line: v }))} options={uniq(materials.map(m => m.rmm_line_name))} width={140} />
        <SearchSelect label="ผู้ขาย" value={f.supplier} onChange={v => setF(p => ({ ...p, supplier: v }))} width={210}
          options={uniq(materials.map(m => m.supplier_name))} />
        <SearchSelect label="ผล QC" value={f.qc} onChange={v => setF(p => ({ ...p, qc: v }))} width={130}
          options={[{ value: 'pass', label: 'ผ่าน' }, { value: 'fail', label: 'ไม่ผ่าน' }]} />
        <SearchSelect label="ดีเลย์" value={f.delay} onChange={v => setF(p => ({ ...p, delay: v }))} width={160}
          options={[{ value: 'over', label: 'เกินมาตรฐาน' }, { value: 'ok', label: 'อยู่ในมาตรฐาน' }]} />
      </FilterBar>

      <DataTable
        rows={shown} getKey={m => m.mapping_id}
        rowTone={m => (m._d.anyOver ? 'bad' : null)}
        empty="ไม่มีล็อตที่ตรงเงื่อนไข"
        columns={[
          { key: 'mat', label: 'Mat', render: m => <b>{m.mat}</b> },
          { key: 'mat_2x', label: 'Mat 2x', render: m => (m.mat_2x ? <Tag tone={m.mat_2x === m.mat ? 'plain' : 'orange'}>{m.mat_2x}</Tag> : '—') },
          { key: 'mat_name', label: 'ชื่อวัตถุดิบ', wrap: true, minWidth: 170 },
          { key: 'batch_before', label: 'Batch', render: m => <span style={{ fontFamily: 'ui-monospace,monospace', fontWeight: 600 }}>{m.batch_before || '—'}</span> },
          { key: 'batch_after', label: 'Batch 2x', render: m => (m.batch_after
              ? <span style={{ fontFamily: 'ui-monospace,monospace', fontWeight: 600, color: m.batch_after === m.batch_before ? T.text2 : T.orange }}>{m.batch_after}</span>
              : '—') },
          { key: 'supplier_name', label: 'ผู้ขาย', wrap: true, minWidth: 160 },
          { key: 'batch_date', label: 'วันที่ล็อต (รับเข้า)', render: m => (m.batch_date ? fmtD(m.batch_date) : '—') },
          { key: 'intake_decision', label: 'ผลตรวจรับเข้า',
            render: m => (m.intake
              ? <Tag tone={m.intake_decision === 'A01' ? 'ok' : 'orange'}>{m.intake_decision || '—'}</Tag>
              : <Tag tone="orange">ไม่พบ</Tag>) },
          { key: 'rm_group_name', label: 'กลุ่ม', wrap: true, minWidth: 110 },
          { key: 'rmm_line_name', label: 'ไลน์' },
          { key: 'weight_RM', label: 'น้ำหนัก', align: 'right', render: m => fmtNum(m.weight_RM, 1) },
          { key: 'sc_pack_date', label: 'บรรจุเสร็จ (โรงงาน)', render: m => fmtDT(m.sc_pack_date) },
          { key: 'd1', label: 'DBS1', align: 'right', render: m => <DelayTag minutes={m._d.value.dbs1} over={m._d.over.dbs1} /> },
          { key: 'd2', label: 'DBS2', align: 'right', render: m => <DelayTag minutes={m._d.value.dbs2} over={m._d.over.dbs2} /> },
          { key: 'd3', label: 'DBS3', align: 'right', render: m => <DelayTag minutes={m._d.value.dbs3} over={m._d.over.dbs3} /> },
          { key: 'd4', label: 'DBS4', align: 'right', render: m => <DelayTag minutes={m._d.value.dbs4} over={m._d.over.dbs4} /> },
          { key: 'qc', label: 'QC', render: m => {
            const fail = [m.qccheck, m.mdcheck, m.defectcheck].some(v => v && String(v).trim() !== 'ผ่าน');
            return <Tag tone={fail ? 'bad' : 'ok'}>{fail ? 'ไม่ผ่าน' : 'ผ่าน'}</Tag>;
          } },
          { key: 'trace', label: 'สอบกลับ', render: m => (
            <button onClick={() => onOpenTrace('rm', `${m.mat}|${m.batch_before || ''}`)} style={BTN_SM}>ดูเส้นทาง</button>
          ) },
        ]}
        renderExpanded={m => (
          <div>
            <Panel title="แผนผังการสอบกลับของล็อตนี้">
              <Legend />
              <LotFlow m={m} summary={s} />
            </Panel>
            <Panel title="ดีเลย์ตามมาตรฐานกลุ่มวัตถุดิบ (DBS)" tone="orange">
              <DelayPanel m={m} />
            </Panel>
            <Panel title="ข้อมูลรับเข้าจากระบบ WISEUP" hint={m.intake?.supplier_name}>
              <IntakePanel m={m} />
            </Panel>
            <Panel title="ส่วนผสมที่ใช้ในล็อตนี้">
              <DataTable
                rows={m.ingredient_summary || []} getKey={(g, i) => i}
                rowTone={g => (g.out_of_spec_count ? 'orange' : null)}
                empty="ล็อตนี้ยังไม่ได้ผูก WO ส่วนผสม"
                columns={[
                  { key: 'material_code', label: 'รหัส', render: g => <b>{g.material_code}</b> },
                  { key: 'material_name', label: 'ชื่อ', wrap: true, minWidth: 170 },
                  { key: 'batch_no', label: 'Batch' },
                  { key: 'basket_count', label: 'ตะกร้า', align: 'right' },
                  { key: 'net_weight', label: 'รวม (kg)', align: 'right', render: g => fmtNum(g.net_weight, 3) },
                  { key: 'avg_net_weight', label: 'เฉลี่ย/ตะกร้า', align: 'right', render: g => fmtNum(g.avg_net_weight, 3) },
                  { key: 'spec', label: 'พิกัด', render: g => `${fmtNum(g.min_weight, 3)} – ${fmtNum(g.max_weight, 3)}` },
                  { key: 'oos', label: 'หลุดพิกัด', align: 'right', render: g => (g.out_of_spec_count ? <Tag tone="bad" title={`ตะกร้า ${g.out_of_spec_baskets?.join(', ')}`}>{g.out_of_spec_count}</Tag> : <Tag tone="ok">ครบ</Tag>) },
                ]}
              />
            </Panel>
            <Panel title="บรรจุภัณฑ์ที่ใช้ตอนบรรจุ">
              <DataTable
                rows={m.packaging || []} getKey={(p, i) => p.detail_id ?? i}
                empty={`ไม่พบบรรจุภัณฑ์ที่ครอบคลุมเวลาบรรจุ ${fmtDT(m.sc_pack_date)} บนไลน์ ${m.rmm_line_name || '—'}`}
                columns={[
                  { key: 'code', label: 'Code', render: p => <b>{p.code}</b> },
                  { key: 'material_no', label: 'Material No' },
                  { key: 'batch_no', label: 'Batch' },
                  { key: 'lot_no', label: 'Lot' },
                  { key: 'hu_no', label: 'HU' },
                  { key: 'use', label: 'ช่วงใช้บนไลน์', render: p => fmtRange(p.start_time, p.stop_time) },
                  { key: 'use_minutes', label: 'ใช้นาน', align: 'right', render: p => fmtDur(p.use_minutes) },
                  { key: 'slip_id', label: 'Slip', align: 'right' },
                ]}
              />
            </Panel>
          </div>
        )}
      />
    </div>
  );
};

/* ═══ หัวเอกสาร ═══════════════════════════════════════════════════════════ */
const RecordHeader = ({ s, docNo, code }) => (
  <div style={{ border: `1px solid ${T.line}`, borderRadius: 12, overflow: 'hidden', marginBottom: 16, background: T.white }}>
    <div style={{
      background: T.blueDeep, color: T.white, padding: '11px 16px',
      display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: 14, fontWeight: 700 }}>ใบสอบกลับการผลิต · TRACEABILITY RECORD</span>
      <span style={{ fontSize: 12, fontWeight: 500 }}>พิมพ์เมื่อ {fmtDT(s.printed_at || new Date().toISOString())}</span>
    </div>
    <Grid min={165} style={{ border: 'none', borderRadius: 0, background: T.white }}>
      <Field label="เลขเอกสารผลิต" value={s.doc_no || docNo} />
      <Field label="Code สินค้า" value={s.code || code} wide />
      <Field label="ไลน์ผลิต" value={(s.lines || []).join(', ')} />
      <Field label="ช่วงเวลาที่สอบกลับ" value={`${fmtD(s.rm_date_first || s.pack_date_first)} – ${fmtD(s.pack_date_last)}`} wide />
      <Field label="จำนวนล็อตวัตถุดิบ" value={s.material_count} />
      <Field label="ชนิดส่วนผสม" value={s.ingredient_kind_count} />
      <Field label="ชนิดบรรจุภัณฑ์" value={s.packaging_kind_count} />
      <Field label="พบในระบบรับเข้า" value={s.intake_found_count != null ? `${s.intake_found_count} / ${s.material_count}` : null} />
      <Field label="ผู้ขาย" value={(s.supplier_list || []).join(', ')} wide />
    </Grid>
  </div>
);

const DataGaps = ({ s, meta, materials }) => {
  const g = [];
  const over = materials.filter(m => buildDelay(m).anyOver).length;
  if (over) g.push(`ดีเลย์เกินมาตรฐาน ${over} ล็อต`);
  if (s.batch_missing_count > 0) g.push(`ไม่มีเลขรหัสรุ่น ${s.batch_missing_count} ล็อต`);
  if (s.intake_missing_count > 0) g.push(`ไม่พบในระบบรับเข้า ${s.intake_missing_count} ล็อต`);
  if (s.intake_defect_count > 0) g.push(`มีข้อบกพร่องตอนตรวจรับ ${s.intake_defect_count} ล็อต`);
  if (meta?.intake_error) g.push(`ดึงข้อมูลรับเข้าไม่สำเร็จ: ${meta.intake_error}`);
  if (s.supplier_missing_count > 0) g.push(`ไม่มีข้อมูลผู้ขาย ${s.supplier_missing_count} ล็อต`);
  if (s.materials_without_ingredient?.length) g.push(`ยังไม่ผูก WO ส่วนผสม ${s.materials_without_ingredient.length} ล็อต`);
  if (s.materials_without_packaging?.length) g.push(`ไม่พบบรรจุภัณฑ์ ${s.materials_without_packaging.length} ล็อต`);
  if (s.ingredient_out_of_spec > 0) g.push(`ส่วนผสมชั่งหลุดพิกัด ${s.ingredient_out_of_spec} ครั้ง`);
  if (s.qc_fail_count > 0) g.push(`QC ไม่ผ่าน ${s.qc_fail_count} ล็อต`);
  if (meta?.wo_rows_deduped > 0) g.push(`ตัดแถว WO ที่คีย์ซ้ำออก ${meta.wo_rows_deduped} แถว`);
  if (meta?.dbs_standard_error) g.push(`ดึงมาตรฐาน DBS ไม่สำเร็จ: ${meta.dbs_standard_error}`);
  if (!g.length) return null;
  return (
    <div style={{ background: T.orangeSoft, border: `1.5px solid ${T.orangeLine}`, borderRadius: 12, padding: '13px 15px', marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: T.orange, marginBottom: 8 }}>
        ข้อสังเกตจากบันทึก (Inconsistent or Incomplete Records)
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {g.map((x, i) => <Tag key={i} tone="orange">{x}</Tag>)}
      </div>
    </div>
  );
};

/* ═══ ตัวหลัก ═════════════════════════════════════════════════════════════ */
const TracebackDetailView = ({ docNo, code, onBack, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('summary');
  const [focus, setFocus] = useState(null);
  const [signOpen, setSignOpen] = useState(false);
  const goBack = onBack || onClose;

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setLoading(true); setError(null); setData(null);
        const res = await axios.get(`${API_URL}/api/traceback/detail`, { params: { doc_no: docNo, code } });
        if (!cancel) setData(res.data?.data || null);
      } catch (e) {
        if (!cancel) setError(e.response?.data?.error || e.message);
      } finally { if (!cancel) setLoading(false); }
    })();
    return () => { cancel = true; };
  }, [docNo, code]);

  useEffect(() => {
    const h = e => { if (e.key === 'Escape' && goBack) goBack(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [goBack]);

  const openTrace = (type, key) => { setFocus({ type, key }); setTab('flow'); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const s = data?.summary || {};
  const TABS = [
    { key: 'summary', label: 'ชั้นสรุป' },
    { key: 'flow', label: 'แผนผังสอบกลับ' },
    { key: 'detail', label: `ชั้นรายละเอียด${data?.materials?.length ? ` (${data.materials.length})` : ''}` },
  ];

  const btn = (bg, bd, fg) => ({
    height: 38, padding: '0 16px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
    background: bg, border: `1.5px solid ${bd}`, color: fg, fontSize: 13, fontWeight: 600,
  });

  return (
    <div id="tb-detail" style={{ background: T.bg, border: `1px solid ${T.line}`, borderRadius: 14, overflow: 'hidden' }}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #tb-detail, #tb-detail * { visibility: visible; }
          #tb-detail { position: absolute; left: 0; top: 0; width: 100%; border: none; }
          .tb-noprint { display: none !important; }
        }
        #tb-detail ::-webkit-scrollbar { height: 9px; width: 9px; }
        #tb-detail ::-webkit-scrollbar-thumb { background: ${T.blueLine}; border-radius: 6px; }
      `}</style>

      {/* หัว */}
      <div style={{ background: T.white, borderBottom: `1px solid ${T.line}`, padding: '14px 20px', position: 'sticky', top: 0, zIndex: 20 }}>
        <div className="tb-noprint" style={{ display: 'flex', gap: 9, marginBottom: 10, flexWrap: 'wrap' }}>
          <button onClick={goBack} style={btn(T.white, T.blue, T.blue)}>← กลับไปหน้าค้นหา</button>
          <button onClick={() => setSignOpen(true)} disabled={!data} style={btn(T.orange, T.orange, T.white)}>
            ออกเอกสาร PDF
          </button>
          <button onClick={() => window.print()} style={btn(T.white, T.line, T.text2)}>พิมพ์หน้าจอ</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: T.blueDeep, lineHeight: 1.2 }}>{docNo}</div>
            <div style={{ fontSize: 13.5, color: T.text, fontWeight: 500, marginTop: 3 }}>{code || s.code}</div>
          </div>
          {data && (
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              <Tag tone="plain">{s.material_count} ล็อต</Tag>
              <Tag tone="plain">{fmtNum(s.total_weight_rm, 1)} kg</Tag>
              {(s.lines || []).map(l => <Tag key={l}>{l}</Tag>)}
            </div>
          )}
        </div>
      </div>

      {/* แท็บ */}
      <div className="tb-noprint" style={{
        display: 'flex', gap: 6, padding: '0 20px', background: T.white,
        borderBottom: `2px solid ${T.line}`, position: 'sticky', top: 96, zIndex: 19,
      }}>
        {TABS.map(t => {
          const on = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '12px 18px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              border: 'none', background: 'none', color: on ? T.orange : T.text2,
              borderBottom: on ? `3px solid ${T.orange}` : '3px solid transparent', marginBottom: -2,
            }}>{t.label}</button>
          );
        })}
      </div>

      <div style={{ padding: '18px 20px 44px' }}>
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 220, gap: 12 }}>
            <div style={{ width: 26, height: 26, border: `3px solid ${T.blueLine}`, borderTop: `3px solid ${T.blue}`, borderRadius: '50%', animation: 'tbSpin 0.7s linear infinite' }} />
            <Txt c={T.blueDeep} size={14} weight={600}>กำลังรวบรวมข้อมูลจากทุกระบบ...</Txt>
          </div>
        )}

        {error && !loading && (
          <div style={{ background: T.badSoft, border: `1.5px solid ${T.badLine}`, borderRadius: 11, padding: 16, color: T.bad, fontSize: 14, fontWeight: 500 }}>
            โหลดข้อมูลไม่สำเร็จ: {error}
          </div>
        )}

        {!loading && !error && data && (
          <>
            <RecordHeader s={s} docNo={docNo} code={code} />
            <DataGaps s={s} meta={data.meta} materials={data.materials || []} />
            {tab === 'summary' && <SummaryTab data={data} docNo={docNo} code={code} onOpenTrace={openTrace} />}
            {tab === 'flow' && <FlowTab data={data} focus={focus} setFocus={setFocus} />}
            {tab === 'detail' && <DetailTab data={data} onOpenTrace={openTrace} />}

            <div style={{ marginTop: 28, paddingTop: 14, borderTop: `1px dashed ${T.line}`, textAlign: 'center', fontSize: 11.5, color: T.text2, fontWeight: 400, lineHeight: 1.8 }}>
              เอกสารนี้สร้างจากระบบ PFCM โดยอัตโนมัติ มีข้อมูลเชิงพาณิชย์ที่เป็นความลับ<br />
              ใช้ภายในองค์กรเพื่อการสอบกลับและตรวจสอบคุณภาพเท่านั้น ห้ามเผยแพร่ต่อโดยไม่ได้รับอนุญาต
            </div>
          </>
        )}
      </div>

      <SignDialog open={signOpen} onClose={() => setSignOpen(false)}
        onExport={sign => exportRecordPDF(data, docNo, code, sign)} />
    </div>
  );
};

export default TracebackDetailView;