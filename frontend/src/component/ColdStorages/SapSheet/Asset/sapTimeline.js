// Time Stamp logic of SAP_Receive rows (one row = one HU of raw material that is NOT processed).
// Everything here is display/hint logic — the server decides whether a stamp is really allowed.

const SUFFIX = ["", "_two", "_three", "_four"];
const field = (base, i) => `${base}${SUFFIX[i]}`;

export const EVENTS = {
  withdraw: { label: "จ่ายลงไลน์", rounds: 4 },
  start_defrost: { label: "เริ่มละลาย", rounds: 4 },
  end_defrost: { label: "ละลายเสร็จ", rounds: 4 },
  input_pd: { label: "ไลน์รับเข้า", rounds: 3 },
  output_pd: { label: "ไลน์ส่งคืน", rounds: 3 },
  input_cd: { label: "รับเข้าห้องเย็น", rounds: 3 },
};

export const parseTime = (v) => {
  if (!v) return null;
  const d = new Date(String(v).replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
};

export const formatTime = (v) => {
  const d = v instanceof Date ? v : parseTime(v);
  if (!d) return "-";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const year = d.getFullYear() !== new Date().getFullYear() ? `/${d.getFullYear()}` : "";
  return `${dd}/${mm}${year} ${hh}:${mi} น.`;
};

/** times of one event type, per round: [{round, at, raw}] (rounds without a time are skipped) */
export const eventTimes = (row, type) => {
  const out = [];
  for (let i = 0; i < EVENTS[type].rounds; i += 1) {
    const raw = row[field(type === "withdraw" ? "withdraw_date" : `${type}_date`, i)];
    const at = parseTime(raw);
    if (at) out.push({ round: i + 1, at, raw });
  }
  return out;
};

const get = (row, type, round) => parseTime(row[field(type === "withdraw" ? "withdraw_date" : `${type}_date`, round - 1)]);

export const STATUS = {
  pending: { label: "รอรับเข้าห้องเย็น", color: "#B45309", bg: "#FEF3C7" },
  incold: { label: "อยู่ในห้องเย็น", color: "#6A1B9A", bg: "#F3E5F5" },
  thawing: { label: "กำลังละลาย", color: "#0277BD", bg: "#E1F2FB" },
  thawed: { label: "ละลายเสร็จแล้ว", color: "#047857", bg: "#D1FAE5" },
  dispatched: { label: "จ่ายลงไลน์แล้ว", color: "#1552F0", bg: "#EAF0FF" },
  online: { label: "อยู่ที่ไลน์", color: "#2E7D32", bg: "#E8F5E9" },
  new: { label: "ยังไม่มีความเคลื่อนไหว", color: "#6B7489", bg: "#F1F3F8" },
};

/** latest event of the row (by time) */
const latestEvent = (row) => {
  let best = null;
  Object.keys(EVENTS).forEach((type) => {
    eventTimes(row, type).forEach((e) => {
      if (!best || e.at > best.at) best = { type, ...e };
    });
  });
  return best;
};

export const pendingRounds = (row) => {
  const rounds = [];
  for (let r = 1; r <= 3; r += 1) {
    if (get(row, "output_pd", r) && !get(row, "input_cd", r)) rounds.push(r);
  }
  return rounds;
};

export const analyzeRow = (row) => {
  const pending = pendingRounds(row);
  const latest = latestEvent(row);
  let key = "new";
  if (pending.length) key = "pending";
  else if (latest) {
    key = {
      input_cd: "incold",
      start_defrost: "thawing",
      end_defrost: "thawed",
      withdraw: "dispatched",
      input_pd: "online",
      output_pd: "pending",
    }[latest.type];
  }
  return { statusKey: key, status: STATUS[key], latest, pending };
};

// ───────────── what a stamp would do + friendly reason when it can't ─────────────
const ordinal = (n) => `รอบที่ ${n}`;
const when = (row, type, round) => formatTime(get(row, type, round));

/** @returns {{ok:boolean, round?:number, reason?:string}} */
export const planStamp = (kind, row) => {
  if (!row) return { ok: true, round: 1 };

  if (kind === "start") {
    for (let r = 1; r <= 4; r += 1) {
      if (get(row, "start_defrost", r)) continue;
      if (r === 1) return { ok: true, round: 1 };
      const prevIn = get(row, "input_cd", r - 1);
      if (!prevIn) {
        return {
          ok: false,
          reason: `เริ่มละลาย${ordinal(r - 1)} ไปแล้วเมื่อ ${when(row, "start_defrost", r - 1)} ต้องรับเข้าห้องเย็น${ordinal(r - 1)} ก่อน จึงจะเริ่มละลาย${ordinal(r)} ได้`,
        };
      }
      return { ok: true, round: r };
    }
    return { ok: false, reason: `ครบ 4 รอบแล้ว (เริ่มละลายรอบสุดท้ายเมื่อ ${when(row, "start_defrost", 4)}) สแกนเพิ่มไม่ได้` };
  }

  if (kind === "end") {
    for (let r = 1; r <= 4; r += 1) {
      if (get(row, "start_defrost", r) && !get(row, "end_defrost", r)) return { ok: true, round: r };
    }
    const lastEnd = [4, 3, 2, 1].find((r) => get(row, "end_defrost", r));
    if (lastEnd) return { ok: false, reason: `ละลายเสร็จไปแล้วเมื่อ ${when(row, "end_defrost", lastEnd)} ถ้าจะละลายอีกครั้งต้องเริ่มละลายรอบใหม่ก่อน` };
    return { ok: false, reason: "ยังไม่ได้เริ่มละลาย ต้องบันทึก \"เริ่มละลาย\" ก่อน จึงจะบันทึก \"ละลายเสร็จ\" ได้" };
  }

  if (kind === "dispatch") {
    for (let r = 1; r <= 4; r += 1) {
      if (get(row, "withdraw", r)) continue;
      if (r === 1) return { ok: true, round: 1 };
      if (!get(row, "input_cd", r - 1)) {
        return {
          ok: false,
          reason: `จ่ายลงไลน์${ordinal(r - 1)} ไปแล้วเมื่อ ${when(row, "withdraw", r - 1)} ต้องรับเข้าห้องเย็น${ordinal(r - 1)} ก่อน จึงจะจ่ายลงไลน์${ordinal(r)} ได้`,
        };
      }
      return { ok: true, round: r };
    }
    return { ok: false, reason: `ครบ 4 รอบแล้ว (จ่ายลงไลน์รอบสุดท้ายเมื่อ ${when(row, "withdraw", 4)}) สแกนเพิ่มไม่ได้` };
  }

  if (kind === "checkin") {
    const pending = pendingRounds(row);
    if (pending.length) return { ok: true, round: pending[0] };
    const lastIn = [3, 2, 1].find((r) => get(row, "input_cd", r));
    if (lastIn) return { ok: false, reason: `รับเข้าห้องเย็นไปแล้วเมื่อ ${when(row, "input_cd", lastIn)} (${ordinal(lastIn)})` };
    return { ok: false, reason: "ไลน์ยังไม่ได้ส่งคืนวัตถุดิบ (ยังไม่มีเวลา \"ไลน์ส่งคืน\") จึงยังรับเข้าห้องเย็นไม่ได้" };
  }

  return { ok: true, round: 1 };
};

/** server message -> plain Thai (used when we have no row data to explain with) */
export const simplifyServerMessage = (message) => {
  const m = String(message || "").trim();
  if (!m) return "ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง";
  const table = [
    [/Missing or invalid required fields/i, "ข้อมูลจากป้ายไม่ครบ (ต้องมีรหัสวัตถุดิบ, Batch และ HU — การเริ่ม/จบละลายต้องมีน้ำหนักด้วย)"],
    [/ไม่พบข้อมูล HU/, "ไม่พบ HU นี้ในระบบ (ยังไม่เคยสแกนเริ่มละลาย/จ่ายลงไลน์)"],
    [/ครบ 4 รอบแล้ว/, "HU นี้ทำครบ 4 รอบแล้ว สแกนเพิ่มไม่ได้"],
    [/ยังไม่มีการรับเข้าห้องเย็น(รอบ ?(\d))?/, "ยังไม่ได้รับเข้าห้องเย็นรอบก่อนหน้า จึงยังทำรอบถัดไปไม่ได้"],
    [/ยังไม่มีการเริ่มละลาย/, "ยังไม่ได้เริ่มละลายรอบก่อนหน้า"],
    [/ไม่พบรอบที่รอ end_defrost/, "ไม่มีรอบที่กำลังละลายอยู่ (ยังไม่ได้เริ่มละลาย หรือละลายเสร็จไปแล้ว)"],
    [/ไม่พบข้อมูล HU นี้/, "ไม่พบ HU นี้ในระบบ"],
  ];
  const hit = table.find(([re]) => re.test(m));
  return hit ? hit[1] : m;
};

/** parse the tag content "mat|batch|hu|weight" */
export const parseTag = (text) => {
  const parts = String(text || "").split("|").map((p) => p.trim());
  if (parts.length < 3) return { error: "รูปแบบป้ายไม่ถูกต้อง (ต้องเป็น รหัสวัตถุดิบ|Batch|HU|น้ำหนัก)" };
  const mat = parts[0];
  const batch = parts[1].slice(0, 10).toUpperCase();
  const hu = parts[2].slice(0, 9);
  if (!mat) return { error: "ไม่พบรหัสวัตถุดิบในป้าย" };
  if (batch.length !== 10) return { error: `Batch ต้องมี 10 ตัวอักษร (อ่านได้ ${batch.length} ตัว)` };
  if (hu.length !== 9) return { error: `HU ต้องมี 9 หลัก (อ่านได้ ${hu.length} หลัก)` };
  let weight = null;
  if (parts.length > 3) {
    const n = parseFloat(parts[3].replace(/[^0-9.]/g, ""));
    weight = Number.isNaN(n) ? null : n;
  }
  return { mat, batch, hu, weight };
};
