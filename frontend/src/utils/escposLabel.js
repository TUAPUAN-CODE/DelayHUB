// src/utils/escposLabel.js
//
// สร้างคำสั่ง ESC/POS สำหรับเครื่องพิมพ์ใบเสร็จความร้อน (เช่น Welltech WT80B)
// ใช้แทน tsplLabel.js เดิม (ซึ่งเป็นภาษาคำสั่งของ label printer ไม่ใช่เครื่องนี้)
//
// ⚠️ ต้องทดสอบก่อนว่า:
//   1) เครื่องเข้าใจ ESC/POS จริงไหม (ทดสอบด้วย escposTestPrint ก่อน)
//   2) ภาษาไทยต้องใช้ codepage ไหน (ทดสอบด้วย escposThaiCodepageTest)
// ทั้งสองฟังก์ชันทดสอบอยู่ท้ายไฟล์นี้

// ============================================================================
// ESC/POS control bytes พื้นฐาน
// ============================================================================
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

const CMD = {
  INIT: [ESC, 0x40],                    // ESC @  — reset เครื่องพิมพ์
  ALIGN_LEFT: [ESC, 0x61, 0x00],
  ALIGN_CENTER: [ESC, 0x61, 0x01],
  ALIGN_RIGHT: [ESC, 0x61, 0x02],
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  DOUBLE_SIZE_ON: [ESC, 0x21, 0x30],    // ตัวใหญ่ 2 เท่า (สูง+กว้าง)
  DOUBLE_SIZE_OFF: [ESC, 0x21, 0x00],
  FEED_LINE: [LF],
  CUT_FULL: [GS, 0x56, 0x00],           // ตัดกระดาษเต็ม (เครื่องต้องมีใบมีดตัดอัตโนมัติ)
  CUT_PARTIAL: [GS, 0x56, 0x01],
};

// ============================================================================
// NEW: แปลงข้อความไทย (Unicode) → TIS-620 / Windows-874 (single-byte)
// อาศัยหลักการที่ยูนิโค้ดช่วงภาษาไทย U+0E01–U+0E5B ถูกออกแบบให้ตรงกับ
// TIS-620 แบบ offset คงที่ (บวก 0xA0 - 0x0E00) — ใช้ได้กับ ASCII ปกติเหมือนเดิม
// ⚠️ ถ้าพิมพ์ออกมายังมั่วอยู่ แปลว่าเครื่องอาจใช้ codepage อื่นที่ไม่ใช่ TIS-620
// (ดูฟังก์ชัน escposThaiCodepageTest ท้ายไฟล์เพื่อไล่หา codepage ที่ถูกต้อง)
// ============================================================================
function encodeThaiTIS620(text) {
  const bytes = [];
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (code < 0x80) {
      bytes.push(code); // ASCII ปกติ ไม่ต้องแปลง
    } else if (code >= 0x0e01 && code <= 0x0e5b) {
      bytes.push(code - 0x0e00 + 0xa0); // ช่วงภาษาไทย
    } else {
      bytes.push(0x3f); // ตัวอักษรที่แปลงไม่ได้ ใส่ "?" แทน กันโปรแกรม crash
    }
  }
  return bytes;
}

function textLine(text, { bold = false, doubleSize = false, align = "left" } = {}) {
  const out = [];
  if (align === "center") out.push(...CMD.ALIGN_CENTER);
  else if (align === "right") out.push(...CMD.ALIGN_RIGHT);
  else out.push(...CMD.ALIGN_LEFT);

  if (bold) out.push(...CMD.BOLD_ON);
  if (doubleSize) out.push(...CMD.DOUBLE_SIZE_ON);

  out.push(...encodeThaiTIS620(text));
  out.push(LF);

  if (doubleSize) out.push(...CMD.DOUBLE_SIZE_OFF);
  if (bold) out.push(...CMD.BOLD_OFF);

  return out;
}

/**
 * สร้างคำสั่ง ESC/POS สำหรับพิมพ์สลิปรถเข็น (ใช้แทน buildTsplLabel เดิม)
 * @param {object} row - ข้อมูลรถเข็น (tro_id, production, trolleyStatus, materials, ...)
 * @param {object} options - { readerName }
 * @returns {Uint8Array} bytes พร้อมส่งให้ printBytesBluetooth
 */
export const buildEscPosLabel = (row, options = {}) => {
  const { readerName = "-" } = options;

  const now = new Date().toLocaleString("th-TH", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });

  const materials = row.materials || [];
  const totalWeight = materials.reduce((sum, m) => sum + (m.weight_RM || 0), 0);
  const totalTrays = materials.reduce((sum, m) => sum + (m.tray_count || 0), 0);

  let out = [...CMD.INIT];

  out.push(...textLine(`รถเข็น: ${row.tro_id || "-"}`, { bold: true, doubleSize: true, align: "center" }));
  out.push(...textLine(`แผนผลิต: ${row.production || "-"}`));
  out.push(...textLine(`สถานะ: ${row.trolleyStatus || "-"}`));
  out.push(...textLine(`น้ำหนักรวม: ${totalWeight.toFixed(2)} kg | ถาด: ${totalTrays}`));
  out.push(...textLine(`เครื่องอ่าน: ${readerName}`));
  out.push(...textLine(`พิมพ์เมื่อ: ${now}`));
  out.push(...textLine("--------------------------------"));

  materials.slice(0, 5).forEach((m) => {
    const line = `${m.batch || "-"} ${m.materialName || m.material_code || "-"} (${m.weight_RM || 0}kg)`;
    out.push(...textLine(line));
  });

  out.push(...CMD.FEED_LINE, ...CMD.FEED_LINE, ...CMD.FEED_LINE);
  out.push(...CMD.CUT_PARTIAL); // ถ้าเครื่องไม่มีใบมีดตัด ให้เอาบรรทัดนี้ออก

  return new Uint8Array(out);
};

// ============================================================================
// 🧪 STEP 1 — ทดสอบว่าเครื่องเข้าใจ ESC/POS หรือไม่ (ยังไม่มีภาษาไทย)
// เรียกจาก console ของเบราว์เซอร์ (ต้องเชื่อมต่อปริ้นเตอร์ไว้ก่อนแล้ว):
//   import { escposTestPrint } from './utils/escposLabel';
//   escposTestPrint(printBytesBluetooth);
// ถ้าออกมาเป็น "HELLO ESC/POS" ปกติ = เครื่องเข้าใจ ESC/POS แน่นอน ไปทำ STEP 2 ต่อ
// ถ้ายังมั่ว/ไม่ออกอะไรเลย = เครื่องอาจไม่ใช่ ESC/POS หรือ UUID/characteristic ผิด
// ============================================================================
export const buildEscPosTestPrint = () => {
  const out = [
    ...CMD.INIT,
    ...CMD.ALIGN_CENTER,
    ...CMD.BOLD_ON,
    ...Array.from("HELLO ESC/POS").map((c) => c.charCodeAt(0)),
    LF,
    ...CMD.BOLD_OFF,
    ...Array.from("1234567890").map((c) => c.charCodeAt(0)),
    LF, LF, LF,
  ];
  return new Uint8Array(out);
};

// ============================================================================
// 🧪 STEP 2 — ไล่หา codepage ภาษาไทยที่ถูกต้อง
// ถ้า STEP 1 ผ่านแล้ว (เครื่องเข้าใจ ESC/POS) แต่ข้อความไทยยังมั่วอยู่
// ให้ลองยิงชุดนี้ แล้วดูว่าบรรทัดไหนอ่านออกเป็น "สวัสดีครับ" ได้ถูกต้อง
// (เครื่องบางรุ่นต้องสั่ง ESC t n เลือก codepage ก่อนพิมพ์ไทย)
// ============================================================================
export const buildThaiCodepageTest = () => {
  const testText = "สวัสดีครับ";
  const candidates = [0, 16, 17, 18, 19, 20, 21, 255]; // ค่า n ที่พบบ่อยในเครื่องโคลนจีน
  let out = [...CMD.INIT];

  candidates.forEach((n) => {
    out.push(...Array.from(`CP${n}: `).map((c) => c.charCodeAt(0)));
    out.push(ESC, 0x74, n); // ESC t n — เลือก character code table
    out.push(...encodeThaiTIS620(testText));
    out.push(LF);
  });

  // เผื่อกรณีเครื่องรองรับ UTF-8 ตรงๆ โดยไม่ต้องแปลงเลย (เครื่องรุ่นใหม่บางตัวทำได้)
  out.push(...Array.from("UTF8: ").map((c) => c.charCodeAt(0)));
  out.push(...new TextEncoder().encode(testText));
  out.push(LF, LF, LF);

  return new Uint8Array(out);
};