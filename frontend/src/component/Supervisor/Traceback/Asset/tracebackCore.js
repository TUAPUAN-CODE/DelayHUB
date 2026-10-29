// ฟังก์ชันกลางของ Traceback: จัดรูปแบบ + คำนวณดีเลย์ DBS1-4 + คะแนนความครบถ้วน/ความเสี่ยง

export const WARN_MIN = 120;
export const SEVERE_MIN = 480;

/* ── helpers ─────────────────────────────────────────────────────────────── */
export const S = v => (v == null ? '' : String(v).trim());
export const toDate = v => { if (!v || v === '-') return null; const d = new Date(String(v).replace(' ', 'T')); return isNaN(d) ? null : d; };
export const diffMin = (a, b) => { const x = toDate(a), y = toDate(b); return x && y ? Math.round((y - x) / 60000) : null; };

export const fmtDT = v => {
  const d = toDate(v);
  if (!d) return '—';
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear() + 543} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
export const fmtD = v => { const d = toDate(v); if (!d) return '—'; const p = n => String(n).padStart(2, '0'); return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear() + 543}`; };
export const fmtRange = (a, b) => (!a && !b ? '—' : `${fmtDT(a)} → ${fmtDT(b)}`);
export const fmtNum = (v, d = 2) => (v == null || v === '' || isNaN(Number(v)) ? '—' : Number(v).toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d }));
export const fmtDur = mins => {
  if (mins == null || isNaN(Number(mins))) return '—';
  const n = Math.abs(Math.round(Number(mins)));
  const d = Math.floor(n / 1440), h = Math.floor((n % 1440) / 60), m = n % 60;
  const parts = [];
  if (d) parts.push(`${d} วัน`);
  if (h) parts.push(`${h} ชม.`);
  if (m || !parts.length) parts.push(`${m} น.`);
  return (Number(mins) < 0 ? '-' : '') + parts.join(' ');
};
export const uniq = arr => [...new Set(arr.filter(v => v != null && v !== ''))];

/* ═══ เครื่องคำนวณดีเลย์ DBS — สูตรเดียวกับรายงาน F3PFPF67 ════════════════ */
export const SPECIAL_GROUPS = [55, 85, 49, 46, 82];
export const isSpecialGroup = row => SPECIAL_GROUPS.includes(Number(row?.rm_group_id));

export const getRemappedRow = (row) => {
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

export const CS_WAIT_ROUNDS = [
  { come: 'cs_come_cold_date', out: 'cs_out_cold_date', p1: 'at_pd_storage_purpose', p2: 'storage_purpose' },
  { come: 'cs_come_cold_date_two', out: 'cs_out_cold_date_two', p1: 'at_pd_storage_purpose_2', p2: 'storage_purpose_2' },
  { come: 'cs_come_cold_date_three', out: 'cs_out_cold_date_three', p1: 'at_pd_storage_purpose_3', p2: 'storage_purpose_3' },
];
export const CS_WAIT_PURPOSE = 'ฝากเก็บเพื่อรอผลิต';
export const getCsWaitMinutes = (row) => {
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

export const calcDBS1 = (m, row) => (SPECIAL_GROUPS.filter(g => g !== 55).includes(Number(row?.rm_group_id)) ? null : diffMin(m._A, m._B));
export const calcDBS2 = (m, sp, row) => {
  if (sp) return null;
  let t = 0, has = false;
  const c1 = diffMin(m._B, m._C); if (c1 !== null) { t += c1; has = true; }
  if (m._D && m._E) { const c2 = diffMin(m._D, m._E); if (c2 !== null) { t += c2; has = true; } }
  if (m._D3 && m._E3) { const c3 = diffMin(m._D3, m._E3); if (c3 !== null) { t += c3; has = true; } }
  const cs = getCsWaitMinutes(row); if (cs > 0) { t += cs; has = true; }
  return has ? t : null;
};
export const calcDBS3 = (m, sp) => {
  if (sp) return null;
  let cold = 0;
  if (m._D && m._E) { const c = diffMin(m._D, m._E); if (c !== null) cold += c; }
  if (m._D3 && m._E3) { const c = diffMin(m._D3, m._E3); if (c !== null) cold += c; }
  const fc = diffMin(m._C, m._F);
  if (fc === null) return null;
  return Math.max(fc - cold, 0);
};
export const calcDBS4 = (m, sp, row) => {
  const gid = Number(row?.rm_group_id);
  if (gid === 46) return diffMin(m._B, m._F);
  if (sp) { const p2 = diffMin(m._C, m._F); return p2 !== null ? p2 : diffMin(m._A, m._F); }
  const a = calcDBS1(m, row), c = calcDBS3(m, sp);
  if (a === null && c === null) return diffMin(m._A, m._F);
  return (a ?? 0) + (c ?? 0);
};
export const stdToMinutes = v => { if (v == null || v === '-' || v === '') return null; const n = parseFloat(v); return isNaN(n) ? null : n * 60; };

/** คำนวณดีเลย์ทั้งชุดของ 1 ล็อต */
export const buildDelay = (m) => {
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

export const STAGE_LABEL = {
  _A: 'เตรียมเสร็จ (A)', _B: 'เข้าห้องเย็น 1 (B)', _C: 'ออกห้องเย็น 1 (C)',
  _D: 'เข้าห้องเย็น 2 (D)', _E: 'ออกห้องเย็น 2 (E)',
  _D3: 'เข้าห้องเย็น 3', _E3: 'ออกห้องเย็น 3', _F: 'บรรจุเสร็จ (F)',
};
export const DBS_LABEL = {
  dbs1: 'DBS 1 · เตรียมเสร็จ → เข้าห้องเย็น',
  dbs2: 'DBS 2 · เข้าห้องเย็น → ออกห้องเย็น',
  dbs3: 'DBS 3 · ออกห้องเย็น → บรรจุเสร็จ',
  dbs4: 'DBS 4 · รวมทั้งกระบวนการ',
};


/* ═══ คะแนนความครบถ้วนของห่วงโซ่ (Chain completeness) ══════════════════════
   1 ล็อต มี 6 ข้อ — ยิ่งครบ ยิ่งตอบผู้ตรวจ (GMP/BRC/ISO 22000) ได้เร็ว
   ═══════════════════════════════════════════════════════════════════════ */
export const CHAIN_CHECKS = [
  { key: 'batch', label: 'มีรหัสรุ่นวัตถุดิบ', test: m => !!m.batch_before },
  { key: 'intake', label: 'พบในระบบรับเข้า (ผู้ขาย)', test: m => !!m.intake },
  { key: 'time', label: 'มีเวลาเตรียม + บรรจุเสร็จ', test: m => !!(m.rmit_date && m.sc_pack_date) },
  { key: 'qc', label: 'มีผลตรวจ QC', test: m => !!(m.qccheck || m.mdcheck || m.defectcheck) },
  { key: 'ing', label: 'ผูกส่วนผสม (WO)', test: m => (m.ingredient_row_count || 0) > 0 },
  { key: 'pkg', label: 'ผูกบรรจุภัณฑ์', test: m => (m.packaging_count || 0) > 0 },
];

export const chainCompleteness = (materials = []) => {
  const items = CHAIN_CHECKS.map(c => {
    const ok = materials.filter(c.test).length;
    return { key: c.key, label: c.label, ok, total: materials.length, pct: materials.length ? Math.round((ok / materials.length) * 100) : 0 };
  });
  const score = items.length && materials.length
    ? Math.round(items.reduce((a, i) => a + i.pct, 0) / items.length) : 0;
  return { score, items };
};

/* ═══ ระดับความเสี่ยงของเอกสารผลิต ═════════════════════════════════════════ */
export const riskAssessment = (materials = []) => {
  const reasons = [];
  let pts = 0;
  const add = (n, w, text) => { if (n > 0) { pts += n * w; reasons.push(text); } };
  const over = materials.filter(m => buildDelay(m).anyOver).length;
  const qcFail = materials.filter(m => [m.qccheck, m.mdcheck, m.defectcheck].some(v => v && String(v).trim() !== 'ผ่าน')).length;
  const oos = materials.reduce((a, m) => a + (m.ingredient_out_of_spec || 0), 0);
  const defect = materials.filter(m => m.intake_defect).length;
  const noIntake = materials.filter(m => m.batch_before && !m.intake).length;
  add(qcFail, 5, `QC ไม่ผ่าน ${qcFail} ล็อต`);
  add(defect, 4, `ข้อบกพร่องตอนรับเข้า ${defect} ล็อต`);
  add(over, 3, `ดีเลย์เกินมาตรฐาน ${over} ล็อต`);
  add(oos, 1, `ส่วนผสมหลุดพิกัด ${oos} ครั้ง`);
  add(noIntake, 1, `ไม่พบในระบบรับเข้า ${noIntake} ล็อต`);
  const shelf = [...shelfLifeIssues(materials).values()].flat();
  const expired = shelf.filter((x) => x.kind === 'expired').length;
  const fefo = shelf.filter((x) => x.kind === 'fefo').length;
  add(expired, 5, `ใช้วัตถุดิบหลังหมดอายุ ${expired} ล็อต`);
  add(fefo, 2, `ผิดหลัก FEFO ${fefo} ล็อต`);
  const n = Math.max(materials.length, 1);
  const ratio = pts / n;
  const level = qcFail || defect || expired || ratio >= 2 ? 'high' : ratio >= 0.5 || over ? 'medium' : 'low';
  return {
    level,
    label: { high: 'สูง', medium: 'ปานกลาง', low: 'ต่ำ' }[level],
    points: pts,
    reasons,
  };
};

/* ═══ เส้นเวลา (Gantt) ของ 1 ล็อต — ช่วงต่อเนื่องจากจุดบันทึกเวลา ═══════════ */
export const lotSegments = (m) => {
  const d = buildDelay(m);
  const pts = Object.entries(d.mapped)
    .map(([k, v]) => ({ k, label: STAGE_LABEL[k], t: toDate(v) }))
    .filter(p => p.t)
    .sort((a, b) => a.t - b.t);
  const segs = [];
  for (let i = 1; i < pts.length; i++) {
    segs.push({ from: pts[i - 1], to: pts[i], minutes: Math.round((pts[i].t - pts[i - 1].t) / 60000) });
  }
  return { points: pts, segs, start: pts[0]?.t || null, end: pts[pts.length - 1]?.t || null };
};

/* ═══ โลโก้ i-Tail เป็น dataURL (ใช้ใน PDF) ═════════════════════════════════ */
const logoCache = {};
export const loadImageDataUrl = (url) => {
  if (!logoCache[url]) {
    logoCache[url] = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth; c.height = img.naturalHeight;
          c.getContext('2d').drawImage(img, 0, 0);
          resolve({ data: c.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight });
        } catch (e) {
          console.error('Traceback logo error:', e);
          resolve(null);
        }
      };
      img.onerror = () => { console.error('Traceback logo load failed:', url); resolve(null); };
      img.src = url;
    });
  }
  return logoCache[url];
};

/* ═══ ประวัติการสอบกลับล่าสุด (เก็บในเครื่องผู้ใช้) ══════════════════════════ */
const RECENT_KEY = 'pfcm_traceback_recent';
export const readRecent = () => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
};
export const pushRecent = (item) => {
  try {
    const key = `${item.kind}|${item.doc_no || ''}|${item.code || ''}|${item.type || ''}`;
    const next = [{ ...item, key, at: new Date().toISOString() }, ...readRecent().filter(r => r.key !== key)].slice(0, 12);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    return next;
  } catch { return readRecent(); }
};

export const currentUserName = () => {
  try {
    const n = [localStorage.getItem('first_name'), localStorage.getItem('last_name')].filter(Boolean).join(' ');
    return n || localStorage.getItem('user_id') || '';
  } catch { return ''; }
};

/* ═══ อายุการเก็บ / FEFO (First Expired, First Out) ═════════════════════════
   expired   ใช้หลังวันหมดอายุ (rmit_date > expiration_date)
   nearExp   ใช้ตอนเหลืออายุไม่ถึง NEAR_EXPIRY_DAYS วัน
   fefo      Mat เดียวกัน: ใช้ล็อตที่หมดอายุช้ากว่า ก่อนล็อตที่หมดอายุเร็วกว่า
   ═══════════════════════════════════════════════════════════════════════ */
export const NEAR_EXPIRY_DAYS = 7;
export const shelfLifeIssues = (materials = []) => {
  const out = new Map(); // mapping_id -> [{ kind, text }]
  const add = (m, kind, text) => { const k = m.mapping_id; if (!out.has(k)) out.set(k, []); out.get(k).push({ kind, text }); };
  materials.forEach((m) => {
    const exp = toDate(m.expiration_date);
    const use = toDate(m.rmit_date || m.sc_pack_date);
    if (!exp || !use) return;
    const left = (exp - use) / 86400000;
    if (left < 0) add(m, 'expired', `ใช้หลังหมดอายุ ${Math.ceil(-left)} วัน`);
    else if (left < NEAR_EXPIRY_DAYS) add(m, 'nearExp', `ใช้ตอนเหลืออายุ ${Math.floor(left)} วัน`);
  });
  const byMat = new Map();
  materials.forEach((m) => { if (m.mat && toDate(m.expiration_date) && toDate(m.rmit_date)) { if (!byMat.has(m.mat)) byMat.set(m.mat, []); byMat.get(m.mat).push(m); } });
  byMat.forEach((list) => {
    const sorted = [...list].sort((a, b) => toDate(a.rmit_date) - toDate(b.rmit_date));
    sorted.forEach((m, i) => {
      const later = sorted.slice(i + 1).find((x) => x.batch_before !== m.batch_before && toDate(x.expiration_date) < toDate(m.expiration_date));
      if (later) add(m, 'fefo', `ใช้ก่อนล็อต ${later.batch_before || later.mapping_id} ที่หมดอายุเร็วกว่า`);
    });
  });
  return out;
};

/* ═══ รายการข้อยกเว้นรวม (Exception list) ═════════════════════════════════ */
export const EXCEPTION_LABEL = {
  overDbs: 'ดีเลย์เกินมาตรฐาน', qcFail: 'QC ไม่ผ่าน', defect: 'ข้อบกพร่องตอนรับเข้า', noIntake: 'ไม่พบในระบบรับเข้า',
  noBatch: 'ไม่มีรหัสรุ่น', oos: 'ส่วนผสมหลุดพิกัด', expired: 'ใช้หลังหมดอายุ', nearExp: 'ใกล้หมดอายุ', fefo: 'ผิดหลัก FEFO',
  noIng: 'ยังไม่ผูกส่วนผสม', noPkg: 'ไม่พบบรรจุภัณฑ์',
};
export const EXCEPTION_SEVERITY = { expired: 3, qcFail: 3, defect: 3, overDbs: 2, fefo: 2, oos: 2, nearExp: 1, noIntake: 1, noBatch: 1, noIng: 0, noPkg: 0 };
export const exceptionList = (materials = []) => {
  const shelf = shelfLifeIssues(materials);
  const rows = [];
  materials.forEach((m) => {
    const push = (kind, detail) => rows.push({ m, kind, label: EXCEPTION_LABEL[kind], detail, severity: EXCEPTION_SEVERITY[kind] });
    const d = buildDelay(m);
    if (d.anyOver) push('overDbs', ['dbs1', 'dbs2', 'dbs3', 'dbs4'].filter((k) => d.over[k]).map((k) => `${k.toUpperCase()} ${fmtDur(d.value[k])} / ${fmtDur(d.std[k])}`).join(' · '));
    const qcBad = [m.qccheck, m.mdcheck, m.defectcheck].filter((v) => v && String(v).trim() !== 'ผ่าน');
    if (qcBad.length) push('qcFail', qcBad.join(' · '));
    if (m.intake_defect) push('defect', m.intake_defect);
    if (!m.batch_before) push('noBatch', '');
    else if (!m.intake) push('noIntake', m.batch_before);
    if (m.ingredient_out_of_spec) push('oos', `${m.ingredient_out_of_spec} ครั้ง`);
    if (!m.ingredient_row_count) push('noIng', '');
    if (!m.packaging_count) push('noPkg', '');
    (shelf.get(m.mapping_id) || []).forEach((x) => push(x.kind, x.text));
  });
  return rows.sort((a, b) => b.severity - a.severity);
};

/* ═══ ตัวแปรการค้นหาที่บันทึกไว้ (Search variants) ═════════════════════════ */
const VARIANT_KEY = 'pfcm_traceback_variants';
export const readVariants = () => { try { return JSON.parse(localStorage.getItem(VARIANT_KEY) || '[]'); } catch { return []; } };
export const saveVariants = (list) => { try { localStorage.setItem(VARIANT_KEY, JSON.stringify(list.slice(0, 30))); } catch (e) { console.error('save variants error:', e); } return list; };

/** CSV แบบไฟล์นำเข้า ERP (คั่นด้วย , มี BOM ให้ Excel อ่านภาษาไทยได้) */
export const downloadCsv = (filename, header, rows) => {
  const esc = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const text = [header.join(','), ...rows.map((r) => r.map(esc).join(','))].join('\r\n');
  const blob = new Blob(['﻿', text], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
};

/* ═══ ขอบเขตการสอบกลับตามตัวกรองของหน้าค้นหา (?scope=1&code=&batch=&line=...) ═══ */
export const SCOPE_KEYS = ['doc_no', 'code', 'batch', 'line', 'mat', 'mat_name', 'supplier', 'pack_from', 'pack_to', 'pack_status'];
/** อ่านขอบเขตจาก URL: คืน null ถ้าไม่ใช่โหมดตามตัวกรอง */
export const scopeFromParams = (params) => {
  if (params.get('scope') !== '1') return null;
  const out = { scope: true };
  SCOPE_KEYS.forEach((k) => { const v = params.get(k); if (v) out[k] = v; });
  return out;
};
/** แปลงขอบเขตเป็น query string params (ใช้ทั้ง URL และเรียก API) */
export const scopeToParams = (scope) => {
  const out = { scope: '1' };
  SCOPE_KEYS.forEach((k) => { if (scope?.[k]) out[k] = scope[k]; });
  return out;
};
/** ชื่อสั้นของขอบเขต เช่น "Code P688 · Batch CCSD5GJ3B" */
export const scopeTitle = (scope) => {
  const t = [];
  if (scope?.code) t.push(`Code ${scope.code}`);
  if (scope?.batch) t.push(`Batch ${scope.batch}`);
  if (!t.length && scope?.doc_no) t.push(scope.doc_no);
  if (!t.length) {
    if (scope?.line) t.push(`ไลน์ ${scope.line}`);
    if (scope?.mat_name || scope?.mat) t.push(`วัตถุดิบ ${scope.mat_name || scope.mat}`);
    if (scope?.supplier) t.push(`ผู้ขาย ${scope.supplier}`);
  }
  return t.join(' · ') || 'ตามตัวกรอง';
};

/**
 * The factory day starts at 05:30: 29/10 05:30 -> 30/10 05:30 is "day 29". ts = 'YYYY-MM-DD HH:mm[:ss]' (factory local time, as the server sends it).
 * Returns 'YYYY-MM-DD' of the factory day, or '' when ts is empty / not a date.
 */
export const FACTORY_DAY_START_MIN = 5 * 60 + 30;
export const factoryDay = (ts) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(ts || ''));
  if (!m) return '';
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - FACTORY_DAY_START_MIN * 60000;
  return new Date(t).toISOString().slice(0, 10);
};
/** 2026-10-29 -> 29/10/2569 (Buddhist year, like the rest of the page) */
export const fmtDay = (ymd) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
  return m ? `${m[3]}/${m[2]}/${+m[1] + 543}` : '—';
};
