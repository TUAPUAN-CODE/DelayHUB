// ============================================================
// ส่วนที่ต้องเพิ่มเข้าไปใน RFIDc1_toggle_mode.js
// ============================================================
// เป้าหมาย: ตอนสแกนออกห้องเย็นสำเร็จ (processColdRoomExit ทำงานเสร็จ)
// ให้ยิงคำขอพิมพ์ไปที่ print-agent (endpoint /print-slip ที่เพิ่งสร้าง)
// ============================================================

// ---------- เพิ่ม require นี้ไว้บนสุดของไฟล์ (ใต้ require เดิม) ----------
// const axios = require("axios"); // ถ้ายังไม่มีอยู่แล้ว
//
// URL ของ print-agent (เครื่อง Windows ที่ต่อเครื่องพิมพ์)
// ถ้า RFIDc1_toggle_mode.js รันอยู่เครื่องเดียวกับ print-agent ใช้ localhost ได้เลย
// ถ้าคนละเครื่อง ต้องเปลี่ยนเป็น IP ของเครื่องนั้น เช่น http://192.168.1.xxx:9100
// const PRINT_AGENT_URL = process.env.PRINT_AGENT_URL || "http://localhost:9100";
// --------------------------------------------------------------------------

// ฟังก์ชันเรียกพิมพ์สลิป ไม่ throw error ออกไปข้างนอก กัน printer ล่มแล้วกระทบ flow หลัก
async function printExitSlip(identifier) {
  try {
    const axios = require("axios");
    const PRINT_AGENT_URL = process.env.PRINT_AGENT_URL || "http://localhost:9100";
    const res = await axios.post(
      `${PRINT_AGENT_URL}/print-slip`,
      { identifier },
      { timeout: 15000 }
    );
    console.log(`🖨️  สั่งพิมพ์สลิปตอนออกห้องเย็นสำหรับ ${identifier} สำเร็จ`);
  } catch (err) {
    // แค่ log ไว้ ไม่ให้กระทบ flow หลักของการอัพเดตสถานะออกห้องเย็น
    console.error(`⚠️  พิมพ์สลิปตอนออกห้องเย็นสำหรับ ${identifier} ไม่สำเร็จ:`, err.message);
  }
}

// ---------- ตรงจุดที่เรียก processColdRoomExit(...) สำเร็จแล้ว ให้เพิ่มบรรทัดเรียก printExitSlip ----------
//
// ตัวอย่าง (ปรับชื่อตัวแปรให้ตรงกับโค้ดจริงของคุณ):
//
//   if (hasOpenRegularRound(hist_id)) {
//     await processColdRoomExit(pool, hist_id, tro_id, mapping_id /* ฯลฯ */);
//
//     // <<< เพิ่มบรรทัดนี้ตรงนี้ >>>
//     printExitSlip(tro_id); // ไม่ต้อง await ก็ได้ ให้พิมพ์แบบ fire-and-forget ไม่บล็อก flow หลัก
//
//     await logRealtimeStatus(pool, hist_id);
//   }
//
// -------------------------------------------------------------------------------------------------
