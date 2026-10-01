// ─────────────────────────────────────────────────────────────────────────────
// tracebackDecoder.js
// อ่านตาราง Traceback_* ทั้งชุดมา cache ไว้ แล้วใช้ถอดรหัส mat / batch
// ใช้ร่วมกับ traceback.routes.js
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 นาที
let CACHE = null;
let CACHE_AT = 0;
let LOADING = null;

const DB = '[PFCMv2].[dbo]';

const TABLES = {
  matType: `SELECT material_type_code, material_type_name FROM ${DB}.[Traceback_Mat_Digit_MaterialType]`,
  matStruct: `SELECT material_type_code, digit_from, digit_to, attribute_name, note FROM ${DB}.[Traceback_Mat_Digit_CodeStructure]`,
  subType: `SELECT material_type_code, sub_type_code, sub_type_name FROM ${DB}.[Traceback_Mat_Digit_SubType]`,
  species: `SELECT material_type_code, sub_type_code, species_code, species_name FROM ${DB}.[Traceback_Mat_Digit_Species]`,
  size: `SELECT material_type_code, sub_type_code, size_code, size_name FROM ${DB}.[Traceback_Mat_Digit_Size]`,
  shrimpSize: `SELECT size_code, size_name FROM ${DB}.[Traceback_Mat_Digit_ShrimpSize]`,
  style: `SELECT material_type_code, sub_type_code, style_code, style_name FROM ${DB}.[Traceback_Mat_Digit_Style]`,
  grade: `SELECT sub_type_code, grade_code, grade_name FROM ${DB}.[Traceback_Mat_Digit_FishGrade]`,
  catchMethod: `SELECT material_type_code, sub_type_code, catch_method_code, catch_method_name FROM ${DB}.[Traceback_Mat_Digit_CatchMethod]`,
  certificate: `SELECT material_type_code, sub_type_code, certificate_code, certificate_name FROM ${DB}.[Traceback_Mat_Digit_Certificate]`,
  importLocal: `SELECT import_local_code, import_local_name FROM ${DB}.[Traceback_Mat_Digit_ImportLocal]`,
  running: `SELECT material_type_code, digit_from, digit_to, range_start, range_end FROM ${DB}.[Traceback_Mat_Digit_RunningFormat]`,
  matBatchMap: `SELECT id, material_type_code, sub_type_code, import_local_code, batch_type_code, confidence, note FROM ${DB}.[Traceback_Mat_Batch_Map]`,
  batchDigit: `SELECT batch_type_code, digit_from, digit_to, meaning_th FROM ${DB}.[Traceback_Batch_DigitMap]`,
  batchValue: `SELECT id, batch_type_code, attribute_name, code, description FROM ${DB}.[Traceback_Batch_CodeValue]`,
  batchStruct: `SELECT batch_type_code, document_no, sub_document_code, title_th, title_en, revision_no, approve_date, effective_date FROM ${DB}.[Traceback_Batch_StructureType]`,
  dayCode: `SELECT day_number, day_code_standard, day_code_rm FROM ${DB}.[Traceback_DateCode_Day]`,
  monthCode: `SELECT month_number, code, month_en, month_th FROM ${DB}.[Traceback_DateCode_Month]`,
};

/** โหลดตารางอ้างอิงทั้งหมดเข้าหน่วยความจำ */
async function loadRefs(pool) {
  const out = {};
  for (const [key, sqlText] of Object.entries(TABLES)) {
    try {
      const r = await pool.request().query(sqlText);
      out[key] = r.recordset;
    } catch (e) {
      console.error(`❌ [traceback decoder] โหลดตาราง ${key} ไม่สำเร็จ:`, e.message);
      out[key] = [];
    }
  }
  return out;
}

async function getRefs(pool, { force = false } = {}) {
  if (!force && CACHE && Date.now() - CACHE_AT < CACHE_TTL_MS) return CACHE;
  if (LOADING) return LOADING;
  LOADING = (async () => {
    const refs = await loadRefs(pool);
    CACHE = refs;
    CACHE_AT = Date.now();
    LOADING = null;
    return refs;
  })();
  return LOADING;
}

function clearCache() { CACHE = null; CACHE_AT = 0; }

// ── utils ───────────────────────────────────────────────────────────────────
const S = v => (v == null ? '' : String(v).trim());
const up = v => S(v).toUpperCase();

/** slice ตามตำแหน่งหลัก (1-based, รวมปลาย) */
function slice(code, from, to) {
  const c = S(code);
  const f = Number(from), t = Number(to);
  if (!c || !f) return '';
  return c.substring(f - 1, (t || f));
}

/** จับคู่ชื่อ attribute แบบหลวม รองรับทั้งไทยและอังกฤษ */
const ATTR_PATTERNS = [
  ['material_type', /material.?type|ชนิดวัตถุดิบ|ประเภทวัตถุดิบ/i],
  ['sub_type', /sub.?type|ชนิดย่อย|ประเภทย่อย|กลุ่มย่อย/i],
  ['species', /species|สายพันธุ์|ชนิดสัตว์|พันธุ์/i],
  ['grade', /grade|เกรด/i],
  ['size', /size|ขนาด|ไซ[สซ]/i],
  ['style', /style|สไตล์|รูปแบบ|ลักษณะ/i],
  ['catch_method', /catch|วิธีจับ|การจับ|เครื่องมือ/i],
  ['certificate', /cert|รับรอง|มาตรฐาน/i],
  ['import_local', /import|local|นำเข้า|ในประเทศ|แหล่ง/i],
  ['running', /running|ลำดับ|เลขวิ่ง|run/i],
  ['day', /วันที่|^วัน|\bday\b/i],
  ['month', /เดือน|month/i],
  ['year', /\bปี\b|year/i],
];

function classify(attrName) {
  const n = S(attrName);
  for (const [kind, re] of ATTR_PATTERNS) if (re.test(n)) return kind;
  return 'other';
}

// ── ถอดรหัส Mat ─────────────────────────────────────────────────────────────
/**
 * @returns {{material_type_code, sub_type_code, import_local_code, attributes:[], decoded:{}, note}}
 */
function decodeMat(matCode, refs) {
  const code = up(matCode);
  if (!code) return { note: 'ไม่มีรหัสวัตถุดิบ', attributes: [], decoded: {} };

  // 1) หา material_type_code จาก prefix ที่ยาวที่สุดที่ตรง
  const type = (refs.matType || [])
    .filter(t => code.startsWith(up(t.material_type_code)))
    .sort((a, b) => up(b.material_type_code).length - up(a.material_type_code).length)[0];

  if (!type) {
    return { note: `ไม่พบชนิดวัตถุดิบที่ตรงกับรหัส "${code}" ในตาราง Traceback_Mat_Digit_MaterialType`, attributes: [], decoded: {} };
  }

  const mtc = up(type.material_type_code);
  const struct = (refs.matStruct || [])
    .filter(s => up(s.material_type_code) === mtc)
    .sort((a, b) => a.digit_from - b.digit_from);

  if (!struct.length) {
    return {
      material_type_code: mtc,
      note: `ยังไม่มีโครงสร้างรหัสของชนิด ${mtc} ในตาราง Traceback_Mat_Digit_CodeStructure`,
      attributes: [{ attribute_name: 'ชนิดวัตถุดิบ', raw: mtc, resolved: type.material_type_name }],
      decoded: { material_type: type.material_type_name },
    };
  }

  // 2) รอบแรก: หาค่าที่ตัวอื่นต้องใช้อ้างอิง (sub_type, import_local)
  const raws = struct.map(s => ({
    attribute_name: s.attribute_name,
    note: s.note,
    digit_from: s.digit_from,
    digit_to: s.digit_to,
    kind: classify(s.attribute_name),
    raw: slice(code, s.digit_from, s.digit_to),
  }));

  const subTypeCode = up(raws.find(r => r.kind === 'sub_type')?.raw || '');
  const importLocalCode = up(raws.find(r => r.kind === 'import_local')?.raw || '');

  // 3) รอบสอง: resolve แต่ละ attribute
  const attributes = raws.map(r => ({ ...r, resolved: resolveMatAttr(r, { mtc, subTypeCode, importLocalCode, type }, refs) }));

  const decoded = { material_type: type.material_type_name };
  attributes.forEach(a => { if (a.resolved) decoded[a.attribute_name] = a.resolved; });

  return {
    material_type_code: mtc,
    material_type_name: type.material_type_name,
    sub_type_code: subTypeCode || null,
    import_local_code: importLocalCode || null,
    attributes: [
      { attribute_name: 'ชนิดวัตถุดิบ', raw: mtc, resolved: type.material_type_name, digit_from: 1, digit_to: mtc.length },
      ...attributes,
    ],
    decoded,
  };
}

function resolveMatAttr(r, ctx, refs) {
  const { mtc, subTypeCode } = ctx;
  const raw = up(r.raw);
  if (!raw) return null;
  const eq = (a, b) => up(a) === up(b);

  switch (r.kind) {
    case 'material_type':
      return (refs.matType || []).find(x => eq(x.material_type_code, raw))?.material_type_name || null;

    case 'sub_type':
      return (refs.subType || []).find(x => eq(x.material_type_code, mtc) && eq(x.sub_type_code, raw))?.sub_type_name || null;

    case 'species':
      return (refs.species || []).find(x => eq(x.material_type_code, mtc) && eq(x.sub_type_code, subTypeCode) && eq(x.species_code, raw))?.species_name
        || (refs.species || []).find(x => eq(x.material_type_code, mtc) && eq(x.species_code, raw))?.species_name
        || null;

    case 'grade':
      return (refs.grade || []).find(x => eq(x.sub_type_code, subTypeCode) && eq(x.grade_code, raw))?.grade_name
        || (refs.grade || []).find(x => eq(x.grade_code, raw))?.grade_name
        || null;

    case 'size':
      return (refs.size || []).find(x => eq(x.material_type_code, mtc) && eq(x.sub_type_code, subTypeCode) && eq(x.size_code, raw))?.size_name
        || (refs.size || []).find(x => eq(x.material_type_code, mtc) && eq(x.size_code, raw))?.size_name
        || (refs.shrimpSize || []).find(x => eq(x.size_code, raw))?.size_name
        || null;

    case 'style':
      return (refs.style || []).find(x => eq(x.material_type_code, mtc) && eq(x.sub_type_code, subTypeCode) && eq(x.style_code, raw))?.style_name
        || (refs.style || []).find(x => eq(x.material_type_code, mtc) && eq(x.style_code, raw))?.style_name
        || null;

    case 'catch_method':
      return (refs.catchMethod || []).find(x => eq(x.material_type_code, mtc) && eq(x.sub_type_code, subTypeCode) && eq(x.catch_method_code, raw))?.catch_method_name
        || (refs.catchMethod || []).find(x => eq(x.catch_method_code, raw))?.catch_method_name
        || null;

    case 'certificate':
      return (refs.certificate || []).find(x => eq(x.material_type_code, mtc) && eq(x.sub_type_code, subTypeCode) && eq(x.certificate_code, raw))?.certificate_name
        || (refs.certificate || []).find(x => eq(x.certificate_code, raw))?.certificate_name
        || null;

    case 'import_local':
      return (refs.importLocal || []).find(x => eq(x.import_local_code, raw))?.import_local_name || null;

    case 'running': {
      const fmt = (refs.running || []).find(x => eq(x.material_type_code, mtc) && x.digit_from === r.digit_from);
      const n = Number(raw);
      if (!fmt) return isNaN(n) ? raw : `ลำดับที่ ${n}`;
      const inRange = !isNaN(n) && (fmt.range_start == null || n >= Number(fmt.range_start)) && (fmt.range_end == null || n <= Number(fmt.range_end));
      return `ลำดับที่ ${raw}${inRange ? '' : ' (นอกช่วงที่กำหนด)'}`;
    }

    case 'day': return resolveDay(raw, refs);
    case 'month': return resolveMonth(raw, refs);
    case 'year': return resolveYear(raw);
    default: return null;
  }
}

// ── ถอดรหัสวันที่ ───────────────────────────────────────────────────────────
function resolveDay(raw, refs) {
  const r = up(raw);
  const row = (refs.dayCode || []).find(d => up(d.day_code_standard) === r || up(d.day_code_rm) === r);
  if (row) return `วันที่ ${row.day_number}`;
  const n = Number(r);
  return !isNaN(n) && n >= 1 && n <= 31 ? `วันที่ ${n}` : null;
}

function resolveMonth(raw, refs) {
  const r = up(raw);
  const row = (refs.monthCode || []).find(m => up(m.code) === r);
  if (row) return row.month_th || row.month_en;
  const n = Number(r);
  const byNum = (refs.monthCode || []).find(m => Number(m.month_number) === n);
  return byNum ? (byNum.month_th || byNum.month_en) : null;
}

function resolveYear(raw) {
  const r = S(raw);
  if (!r) return null;
  const now = new Date().getFullYear();
  if (/^\d{4}$/.test(r)) return `ปี ${r}`;
  if (/^\d{2}$/.test(r)) {
    const ce = 2000 + Number(r);
    return `ปี ${ce} (พ.ศ. ${ce + 543})`;
  }
  if (/^\d$/.test(r)) {
    // หลักเดียว → เทียบกับทศวรรษปัจจุบัน เลือกปีที่ใกล้ปัจจุบันที่สุด
    const base = Math.floor(now / 10) * 10;
    const cand = [base + Number(r), base + Number(r) - 10];
    const year = cand.reduce((a, b) => (Math.abs(b - now) < Math.abs(a - now) ? b : a));
    return `ปี ${year} (พ.ศ. ${year + 543})`;
  }
  return null;
}

// ── ถอดรหัส Batch ───────────────────────────────────────────────────────────
/**
 * @param batchCode  รหัส batch เช่น batch_before / batch_after
 * @param matInfo    ผลลัพธ์จาก decodeMat (ใช้เลือกโครงสร้าง batch)
 */
function decodeBatch(batchCode, matInfo, refs) {
  const code = up(batchCode);
  if (!code) return { note: 'ไม่มีรหัส batch' };
  if (!matInfo?.material_type_code) return { note: 'ถอดรหัส batch ไม่ได้เพราะยังระบุชนิดวัตถุดิบไม่ได้' };

  const mtc = up(matInfo.material_type_code);
  const stc = up(matInfo.sub_type_code || '');
  const ilc = up(matInfo.import_local_code || '');
  const maps = refs.matBatchMap || [];
  const eq = (a, b) => up(a) === up(b);

  const map =
    maps.find(m => eq(m.material_type_code, mtc) && eq(m.sub_type_code, stc) && eq(m.import_local_code, ilc)) ||
    maps.find(m => eq(m.material_type_code, mtc) && eq(m.sub_type_code, stc) && !S(m.import_local_code)) ||
    maps.find(m => eq(m.material_type_code, mtc) && eq(m.sub_type_code, stc)) ||
    maps.find(m => eq(m.material_type_code, mtc) && !S(m.sub_type_code)) ||
    maps.find(m => eq(m.material_type_code, mtc));

  if (!map) return { note: `ไม่พบโครงสร้าง batch สำหรับชนิด ${mtc}${stc ? '/' + stc : ''} ในตาราง Traceback_Mat_Batch_Map` };

  const btc = up(map.batch_type_code);
  const digits = (refs.batchDigit || [])
    .filter(d => up(d.batch_type_code) === btc)
    .sort((a, b) => a.digit_from - b.digit_from);

  const structure = (refs.batchStruct || []).find(s => up(s.batch_type_code) === btc) || null;

  if (!digits.length) {
    return { batch_type_code: btc, confidence: map.confidence, structure, note: `ยังไม่มีผังหลักของโครงสร้าง ${btc} ในตาราง Traceback_Batch_DigitMap` };
  }

  const values = (refs.batchValue || []).filter(v => up(v.batch_type_code) === btc);

  const decoded = digits.map(d => {
    const raw = slice(code, d.digit_from, d.digit_to);
    return {
      digit_from: d.digit_from,
      digit_to: d.digit_to,
      meaning: d.meaning_th,
      raw,
      resolved: resolveBatchDigit(d.meaning_th, raw, values, refs),
    };
  });

  return {
    batch_type_code: btc,
    confidence: map.confidence,
    map_note: map.note,
    structure,
    decoded,
  };
}

function resolveBatchDigit(meaning, raw, values, refs) {
  const r = up(raw);
  if (!r) return null;
  const kind = classify(meaning);

  // 1) ลองหาใน CodeValue โดยจับคู่ชื่อ attribute กับความหมายก่อน
  const sameKind = values.filter(v => classify(v.attribute_name) === kind && up(v.code) === r);
  if (sameKind.length) return sameKind[0].description;

  const sameMeaning = values.filter(v => S(v.attribute_name) === S(meaning) && up(v.code) === r);
  if (sameMeaning.length) return sameMeaning[0].description;

  // 2) วัน / เดือน / ปี
  if (kind === 'day') return resolveDay(r, refs);
  if (kind === 'month') return resolveMonth(r, refs);
  if (kind === 'year') return resolveYear(r);

  // 3) สุดท้าย: ถ้ามีรหัสนี้เพียงค่าเดียวในโครงสร้างนี้ ให้ใช้ค่านั้น
  const anyMatch = values.filter(v => up(v.code) === r);
  if (anyMatch.length === 1) return anyMatch[0].description;

  return null;
}

// ── API หลักของโมดูล ────────────────────────────────────────────────────────
/** ถอดรหัสทั้ง mat และ batch ในครั้งเดียว */
function decodePair(matCode, batchCode, refs) {
  const mat = decodeMat(matCode, refs);
  const batch = decodeBatch(batchCode, mat, refs);
  return { mat, batch };
}

module.exports = {
  getRefs,
  clearCache,
  decodeMat,
  decodeBatch,
  decodePair,
};