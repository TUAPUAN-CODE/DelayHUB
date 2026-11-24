// แถวของรายงานควบคุมเวลาการผลิต F3PFPF67 สำหรับระบบอื่น (DocHUB ดึงทุกวันผ่าน GET /api/export/f3pfpf67)
// คำนวณด้วยไฟล์เดียวกับหน้าเว็บ (frontend/.../delayReportCore.js, Sheet/Asset/fishBatch.js, shiftTime.js) → ตัวเลขตรงกับ PDF / Excel ของ DelayHUB เสมอ
// ไฟล์ของหน้าเว็บเป็น ES module: โหลดด้วย import() ครั้งเดียวต่อ process
const path = require("path");
const { pathToFileURL } = require("url");

const FRONT = path.resolve(__dirname, "../../frontend/src/component");
let modsPromise = null;
const loadMods = () => {
  if (!modsPromise) {
    const load = (p) => import(pathToFileURL(path.join(FRONT, p)).href);
    modsPromise = Promise.all([
      load("Pack/ReportRawmatNotEditTIME/Asset/delayReportCore.js"),
      load("Sheet/Asset/fishBatch.js"),
      load("Sheet/Asset/shiftTime.js"),
    ]).then(([core, fish, shift]) => ({ core, fish, shift }))
      .catch((err) => { modsPromise = null; throw err; });
  }
  return modsPromise;
};

const clean = (v) => (v === null || v === undefined || v === "-" ? null : String(v).trim() || null);
// "2026-11-17 10:05:00" / Date → "2026-11-17 10:05:00" (เวลาท้องถิ่นของ server เหมือนหน้าเว็บ)
const p2 = (n) => String(n).padStart(2, "0");
const dt = (v) => {
  if (v === null || v === undefined || v === "" || v === "-") return null;
  const d = v instanceof Date ? v : new Date(String(v).replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
};
const hours = (min) => (min === null || min === undefined || Number.isNaN(min) ? null : Math.round((min / 60) * 100) / 100);
const sensory = (v) => (typeof v === "boolean" ? (v ? "ผ่าน" : "ไม่ผ่าน") : clean(v));
const num = (v) => { if (v === null || v === undefined || v === "") return null; const n = Number(v); return Number.isFinite(n) ? n : null; };

/** 1 แถวของตาราง Done → 1 บรรทัดของแบบฟอร์ม F3PFPF67 (ค่าที่พิมพ์ลง PDF / Excel ครบทุกช่อง) */
const formLine = (row, { core, fish, shift }) => {
  const r = { ...row, production: row.doc_no ?? row.production ?? "", detail: row.qc_detail ?? row.detail ?? "" };
  const m = core.getRemappedRow(r);
  const sp = core.isSpecialGroup(r);
  const mins = [core.calcDBS1Minutes(m, r), core.calcDBS2Minutes(m, sp), core.calcDBS3Minutes(m, sp), core.calcDBS4Minutes(m, sp, r)];
  const std = [r.DBS1 ?? r.dbs1, r.DBS2 ?? r.dbs2, r.DBS3 ?? r.dbs3, r.DBS4 ?? r.dbs4].map(core.parseStandardDBSToMinutes);
  const over = mins.map((v, i) => (i === 1 || i === 2) && sp ? false : std[i] !== null && v !== null && v > std[i]);
  const text = [core.calculateDBS1FromMapped(m, r), core.calculateDBS2FromMapped(m, sp), core.calculateDBS3FromMapped(m, sp), core.calculateDBS4FromMapped(m, sp, r)];
  const packed = dt(m._F);
  return {
    mapping_id: r.mapping_id,
    work_day: packed ? shift.workDayOf(packed) || packed.slice(0, 10) : null,
    shift: packed ? shift.shiftOf(packed) || null : null,
    line: clean(r.rmm_line_name),
    code: clean(r.code),
    production: clean(r.production),
    mat: clean(r.mat),
    mat_name: clean(r.mat_name),
    batch: clean(r.batch_after),
    weight: num(r.weight_RM),
    group_no: clean(r.group_no),
    prep_date: dt(r.rmit_date),
    hist: clean(r.detail),
    color: sensory(r.qc_color ?? r.color),
    odor: sensory(r.qc_odor ?? r.odor),
    texture: sensory(r.qc_texture ?? r.texture),
    time_a: dt(m._A), time_b: dt(m._B), time_c: dt(m._C),
    time_d: sp ? null : dt(m._D), time_e: sp ? null : dt(m._E),
    time_f: packed,
    special: sp,
    dbs1: text[0], dbs2: text[1], dbs3: text[2], dbs4: text[3],
    dbs1_h: hours(mins[0]), dbs2_h: hours(mins[1]), dbs3_h: hours(mins[2]), dbs4_h: hours(mins[3]),
    std1_h: hours(std[0]), std2_h: hours(std[1]), std3_h: hours(std[2]), std4_h: hours(std[3]),
    over1: over[0], over2: over[1], over3: over[2], over4: over[3],
    over_any: over.some(Boolean),
    remark: clean(fish.reportRemark(r)),
    rm_group_id: num(r.rm_group_id),
  };
};

const toFormLines = async (rows) => {
  const mods = await loadMods();
  return rows.map((r) => formLine(r, mods));
};

module.exports = { toFormLines, loadMods, formLine };
