// print-agent/server.js
//
// Print Agent ตัวเล็กๆ รันบนคอมที่ต่อเครื่องพิมพ์ (เครื่องเดียวกับที่ลง driver EML-400L ไว้)
// รับคำสั่งพิมพ์จากหน้าเว็บผ่าน HTTP แล้วสั่งพิมพ์แบบ RAW เงียบๆ ไม่มี dialog
// ใช้ได้ทั้งเครื่องพิมพ์ที่ผูกกับ USB และ BLE เพราะสั่งผ่าน "printer share name" ของ Windows
// ไม่ได้คุยกับพอร์ตโดยตรง เลยไม่ต้องสนใจว่าตอนนี้ต่อผ่าน USB หรือ BLE
//
// วิธีทำงาน: เขียนไบต์ ESC/POS ลงไฟล์ temp แล้วสั่ง Windows `copy /b` ไปที่
// \\localhost\<ชื่อ share ของ printer> ซึ่งเป็นวิธีมาตรฐานของ Windows ในการส่ง raw data
// เข้าคิวพิมพ์โดยไม่ต้อง compile native module ใดๆ (ไม่ต้องมี node-gyp/Build Tools)
//
// ข้อกำหนดก่อนใช้งาน:
//   1) ต้องแชร์ปริ้นเตอร์ใน Windows ก่อน (คลิกขวาที่ปริ้นเตอร์ > Printer properties > Sharing
//      > Share this printer > ตั้งชื่อ share เช่น "EML400L_USB" หรือ "EML400L_BLE")
//   2) จดชื่อ share ไว้ แล้วใส่ให้ตรงใน PRINTER_SHARES ด้านล่าง (หรือส่งชื่อมาจาก frontend ก็ได้)

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { exec } = require("child_process");
const puppeteer = require("puppeteer");
const https = require("https");
const axios = require("axios");
const QRCode = require("qrcode");
const { printHtmlToNetworkPrinter } = require("./escposNetworkPrint");
const WEB_SERVER_URL = process.env.WEB_SERVER_URL || "http://172.48.0.115:3000";

// เซิร์ฟเวอร์ backend ใช้ self-signed cert เลยต้องปิดการเช็ค cert ตอนยิง request หากัน
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const app = express();
app.use(cors()); // อนุญาตให้หน้าเว็บ (คนละ origin) เรียก agent นี้ได้
app.use(express.json({ limit: "2mb" }));

const PORT = 9100; // เปลี่ยนได้ถ้าพอร์ตนี้ชนกับโปรแกรมอื่นในเครื่อง

// NEW: แก้ชื่อ share ให้ตรงกับที่ตั้งไว้จริงใน Windows (ดูวิธีตั้งชื่อ share ด้านบน)
// key ทางซ้ายต้องตรงกับค่า printerMode ที่ frontend ส่งมา ('usb' | 'ble')
const PRINTER_SHARES = {
  usb: "POS-80C", // TODO: เปลี่ยนให้ตรงกับชื่อ share จริงที่ตั้งไว้
  ble: "POS-80C", // TODO: เปลี่ยนให้ตรงกับชื่อ share จริงที่ตั้งไว้
};

app.get("/health", (req, res) => {
  res.json({ ok: true, port: PORT });
});

// รายชื่อปริ้นเตอร์ที่ Windows มองเห็น ใช้เช็คตอนตั้งค่าว่าชื่อ share ถูกต้องไหม
app.get("/printers", (req, res) => {
  exec(
    'powershell -Command "Get-Printer | Select-Object Name,ShareName | ConvertTo-Json"',
    (err, stdout) => {
      if (err) return res.status(500).json({ ok: false, error: err.message });
      try {
        const parsed = JSON.parse(stdout);
        res.json({ ok: true, printers: parsed });
      } catch {
        res.json({ ok: true, raw: stdout });
      }
    }
  );
});

app.post("/print", (req, res) => {
  const { mode, dataBase64 } = req.body || {};

  if (!dataBase64) {
    return res.status(400).json({ ok: false, error: "ไม่มี dataBase64 ส่งมา" });
  }

  const shareName = PRINTER_SHARES[mode];
  if (!shareName) {
    return res.status(400).json({
      ok: false,
      error: `ไม่รู้จักโหมด '${mode}' — ต้องเป็น 'usb' หรือ 'ble' และต้องตั้งชื่อ share ใน PRINTER_SHARES ก่อน`,
    });
  }

  let bytes;
  try {
    bytes = Buffer.from(dataBase64, "base64");
  } catch (err) {
    return res.status(400).json({ ok: false, error: "แปลง base64 ไม่สำเร็จ: " + err.message });
  }

  const tempFile = path.join(os.tmpdir(), `label_${Date.now()}.prn`);

  fs.writeFile(tempFile, bytes, (writeErr) => {
    if (writeErr) {
      return res.status(500).json({ ok: false, error: "เขียนไฟล์ temp ไม่สำเร็จ: " + writeErr.message });
    }

    // ส่ง raw bytes เข้าคิวพิมพ์ผ่าน printer share ของ Windows (ไม่มี dialog ขึ้น)
    const cmd = `copy /b "${tempFile}" "\\\\localhost\\${shareName}"`;

    exec(cmd, (execErr, stdout, stderr) => {
      fs.unlink(tempFile, () => {}); // ลบไฟล์ temp ทิ้งไม่ว่าจะสำเร็จหรือไม่

      if (execErr) {
        console.error("พิมพ์ไม่สำเร็จ:", stderr || execErr.message);
        return res.status(500).json({
          ok: false,
          error:
            "พิมพ์ไม่สำเร็จ — เช็คว่าแชร์ปริ้นเตอร์ชื่อ '" +
            shareName +
            "' ไว้ใน Windows แล้วหรือยัง (" +
            (stderr || execErr.message) +
            ")",
        });
      }

      console.log(`✅ พิมพ์สำเร็จผ่าน ${shareName}`);
      res.json({ ok: true, printedVia: shareName });
    });
  });
});

// ============================================================
// ส่วนพิมพ์สลิปอัตโนมัติ (เดิม fetch จาก fetchSlotRawMat)
// ============================================================
//
// ⭐ FIX: fetchSlotRawMat คืนเฉพาะรถเข็น "ที่ยังอยู่ในช่อง/slot ห้องเย็น" เท่านั้น
// ตอน checkout/export backend จะเอารถเข็นออกจากช่องไปแล้วก่อนเรียก /print-slip
// ทำให้ fetchTrolleyData หาไม่เจอ (404) — ตอนนี้ /print-slip รับ trolleyData
// แนบมาจาก frontend ได้เลย (frontend มีข้อมูลอยู่แล้วใน fetchedData) จึงไม่ต้อง
// พึ่งการ fetch สดจาก fetchSlotRawMat อีกต่อไปสำหรับ flow ที่ frontend ส่งมาให้
// (ฟังก์ชัน fetchTrolleyData ยังเก็บไว้เป็น fallback เผื่อ flow เก่าที่ไม่ได้ส่ง trolleyData มา)
// ============================================================

// ดึงข้อมูลรถเข็น (ทั้งวัตถุดิบปกติและแบบผสม) แล้วหาแถวที่ตรงกับ tro_id หรือ mapping_id ที่ส่งมา
// (fallback เท่านั้น — ใช้เมื่อ frontend ไม่ได้แนบ trolleyData มาด้วย)
async function fetchTrolleyData(identifier) {
  const [regularRes, mixedRes] = await Promise.all([
    axios.get(`${WEB_SERVER_URL}/api/coldstorage/export/fetchSlotRawMat`, { httpsAgent }),
    axios.get(`${WEB_SERVER_URL}/api/coldstorage/mix/export/fetchSlotRawMat`, { httpsAgent }),
  ]);

  const regular = (regularRes.data.success ? regularRes.data.data : []).map((d) => ({
    ...d,
    rawMatType: "regular",
  }));
  const mixed = (mixedRes.data.success ? mixedRes.data.data : []).map((d) => ({
    ...d,
    rawMatType: "mixed",
  }));
  const all = [...regular, ...mixed];

  return all.find(
    (item) =>
      String(item.tro_id) === String(identifier) ||
      String(item.mapping_id) === String(identifier) ||
      (item.materials || []).some((m) => String(m.mapping_id) === String(identifier))
  );
}

// ดึงประวัติเข้า-ออกห้องเย็นของวัตถุดิบแต่ละชิ้น (เหมือนที่ PrintModal.jsx เรียก)
async function fetchColdHistoryFor(mappingId) {
  try {
    const res = await axios.get(`${WEB_SERVER_URL}/api/coldstorage/history/${mappingId}`, {
      httpsAgent,
    });
    return res.data || {};
  } catch (err) {
    console.error(`ดึงประวัติห้องเย็นของ mapping_id=${mappingId} ไม่สำเร็จ:`, err.message);
    return {};
  }
}

// จัดรูปแบบวันเวลาแบบไทย (เหมือน formatThaiDateTime ใน PrintModal.jsx)
function formatThaiDateTime(dateStr) {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("th-TH", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "-";
  }
}

// สร้าง QR code เป็น data URI (base64 PNG) ฝังตรงใน HTML ได้เลย ไม่ต้องพึ่งไฟล์ภายนอก
async function buildQRDataUri(value) {
  return await QRCode.toDataURL(value, { margin: 1, width: 200 });
}

// ⭐ NEW: คำนวณ "สเกล" ของฟอนต์/QR/ระยะห่าง โดยอิงจากจำนวนวัตถุดิบในสลิป
// ยิ่งมีวัตถุดิบเยอะ (ข้อมูลเยอะ) ยิ่งลดขนาดลงอัตโนมัติ เพื่อให้สลิปไม่ยาวเกินไป
// โดยไม่ต้องไปกำหนดความสูงกระดาษตายตัว (ความสูงหน้ากระดาษยังคง auto ตาม @page อยู่แล้ว)
// scale จะลดลงทีละขั้นตามจำนวนวัตถุดิบ แต่ไม่ลดต่ำกว่า MIN_SCALE เพื่อไม่ให้อ่านไม่ออก
function calcAutoScale(materialCount) {
  const MIN_SCALE = 0.45;
  const STEP_PER_EXTRA_ITEM = 0.1; // ลดลงกี่ % ต่อวัตถุดิบที่เกินจาก 1 ชิ้น (เพิ่มจาก 0.07 → 0.1 ให้ย่อไวขึ้น)
  if (materialCount <= 1) return 1;
  const scale = 1 - (materialCount - 1) * STEP_PER_EXTRA_ITEM;
  return Math.max(MIN_SCALE, Math.round(scale * 100) / 100);
}

// สร้าง HTML ของสลิป 1 รถเข็น (mirror หน้าตาจาก PrintModal.jsx ในเวอร์ชันย่อสำหรับพิมพ์อัตโนมัติ)
async function buildSlipHTML(trolleyData) {
  const materials =
    trolleyData.materials && trolleyData.materials.length > 0
      ? trolleyData.materials
      : [
          {
            material_code: trolleyData.mat,
            materialName: trolleyData.mat_name,
            batch: trolleyData.batch,
            batch_before: trolleyData.batch_before,
            production: trolleyData.production,
            mapping_id: trolleyData.mapping_id,
            weight_RM: trolleyData.weight_RM,
            tray_count: trolleyData.tray_count,
            levelEu: trolleyData.level_eu,
          },
        ];

  // สเกลรวมของสลิปนี้ อิงจากจำนวนวัตถุดิบทั้งหมด (ยิ่งเยอะยิ่งย่อ)
  const scale = calcAutoScale(materials.length);
  const px = (base) => Math.round(base * scale);
  // ⭐ NEW: กระดาษ 80mm - container 60mm = เหลือ 20mm แบ่งซ้าย-ขวา ถ้า "เท่ากันเป๊ะ" คือฝั่งละ 10mm
  // แต่หัวพิมพ์จริงมักไม่ตรงกลางกระดาษ 100% เลยต้อง "เลื่อนซ้าย" แบบ manual ที่นี่
  // ปรับตัวเลขนี้ได้เลยถ้ายังไม่ตรง: ยิ่งน้อย = ยิ่งชิดซ้าย, ยิ่งมาก = ยิ่งชิดขวา
  const CONTAINER_WIDTH_MM = 60;
  const PAGE_WIDTH_MM = 80;
  const LEFT_MARGIN_MM = 5; // ลดจาก 10mm (กึ่งกลางเป๊ะ) เหลือ 5mm เพื่อเลื่อนเนื้อหาไปทางซ้าย
  // container กว้าง 60mm ≈ 227px (96dpi) — กัน QR ไม่ให้ใหญ่เกินความกว้างที่เหลือจริง
  const CONTAINER_MAX_PX = 210;
  const qrPx = Math.min(CONTAINER_MAX_PX, Math.max(80, px(160))); // กัน QR เล็กจนสแกนไม่ขึ้น แต่ก็ไม่ล้นขอบ

  const materialBlocks = await Promise.all(
    materials.map(async (item, idx) => {
      const history = await fetchColdHistoryFor(item.mapping_id);
      const rounds = history.history || [];
      const qrValue = [
        item.material_code || "-",
        item.batch || "-",
        item.batch_before || "-",
        item.mapping_id || "-",
        item.weight_RM || "-",
        "kg",
        "PFCM",
      ].join(" | ");
      const qrDataUri = await buildQRDataUri(qrValue);

      const roundsHtml = rounds
        .map(
          (r) => `
        <div class="row">เวลาเข้าห้องเย็น (ครั้งที่ ${r.round}): ${
            r.come_date ? formatThaiDateTime(r.come_date) + " น." : "-"
          }</div>
        ${
          r.out_date
            ? `<div class="row">เวลาออกห้องเย็น (ครั้งที่ ${r.round}): ${formatThaiDateTime(
                r.out_date
              )} น.</div>`
            : ""
        }
      `
        )
        .join("");

      return `
        <div class="material">
          <div class="material-title">วัตถุดิบที่ ${idx + 1}</div>
          <div class="row">รายการ: ${item.mapping_id ?? "-"}</div>
          <div class="row">Batch ป้าย Tag: ${item.batch_before ?? "-"} | Batch หลังเตรียม: ${
        item.batch ?? "-"
      }</div>
          <div class="row">Level EU: ${item.levelEu ?? "-"}</div>
          <div class="row">ชื่อวัตถุดิบ: ${item.materialName ?? "-"}</div>
          <div class="row">แผนการผลิต: ${item.production ?? "-"}</div>
          <div class="row">น้ำหนักวัตถุดิบ: ${item.weight_RM ?? "-"} | จำนวนถาด: ${
        item.tray_count ?? "-"
      }</div>
          ${roundsHtml}
          <div class="qr"><img src="${qrDataUri}" width="${qrPx}" height="${qrPx}" /></div>
        </div>
      `;
    })
  );

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8" />
    <style>
      /* ⭐ FIX 4: margin:auto / flex-center ยังไม่ตรงกับพื้นที่พิมพ์จริงของเครื่อง
         (หัวพิมพ์จริงมักไม่ครอบคลุมกระดาษแบบสมมาตร 100%) เปลี่ยนมาใช้ margin-left
         แบบกำหนดตายตัว (ปรับ LEFT_MARGIN_MM ด้านบนได้ถ้ายังไม่ตรง) แทนการ auto-center
         และตัด padding ด้านล่างของ container ออก (เหลือแค่ด้านบน) ลดช่องว่างท้ายสลิป */
      @page { size: ${PAGE_WIDTH_MM}mm auto; margin: 0mm; }
      * { box-sizing: border-box; }
      html, body {
        width: ${PAGE_WIDTH_MM}mm;
        margin: 0;
        padding: 0;
        overflow-x: hidden;
        font-family: "Tahoma", sans-serif;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .container {
        width: ${CONTAINER_WIDTH_MM}mm;
        max-width: ${CONTAINER_WIDTH_MM}mm;
        margin-left: ${LEFT_MARGIN_MM}mm;  /* เลื่อนซ้าย/ขวาแบบ manual แทน auto-center */
        margin-right: 0;
        padding: ${px(2)}mm 0mm 8mm 0mm;  /* เอา padding ด้านล่างออก ลดช่องว่างท้ายสลิป */
        overflow-wrap: break-word;
        word-break: break-word;
      }
      /* ⭐ NEW: ขนาดฟอนต์/ระยะห่างด้านล่างนี้คำนวณจาก scale (${scale})
         ซึ่งอิงจากจำนวนวัตถุดิบในสลิปนี้ (${materials.length} ชิ้น) — ยิ่งวัตถุดิบเยอะ
         ยิ่งย่อขนาดลงอัตโนมัติ เพื่อให้สลิปกระชับ ไม่ยาวเกินไปเวลาพิมพ์ */
      .header { text-align: center; font-size: ${px(20)}px; font-weight: bold; margin-bottom: ${px(6)}px; overflow-wrap: break-word; }
      .platebox { display: flex; border: 2px solid #000; border-radius: 4px; overflow: hidden; margin-bottom: ${px(6)}px; }
      .platebox div { flex: 1; min-width: 0; text-align: center; font-size: ${px(13)}px; padding: ${px(4)}px ${px(3)}px; overflow-wrap: break-word; }
      .platebox div:first-child { border-right: 2px solid #000; }
      .section { background: #f5f5f5; border-radius: 4px; padding: ${px(6)}px; font-size: ${px(15)}px; margin-bottom: ${px(6)}px; }
      .section-title { color: #2388d1; font-size: ${px(15)}px; font-weight: bold; margin-bottom: ${px(4)}px; }
      .row { font-size: ${px(14)}px; margin-bottom: ${px(3)}px; line-height: 1.3; overflow-wrap: break-word; }
      .material { border-top: 1px dashed #ccc; padding-top: ${px(6)}px; margin-top: ${px(6)}px; }
      .material-title { font-size: ${px(17)}px; font-weight: bold; margin-bottom: ${px(4)}px; }
      .qr { text-align: center; margin-top: ${px(6)}px; line-height: 0; }
      .qr img { width: ${qrPx}px; height: ${qrPx}px; max-width: 100%; display: inline-block; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">ข้อมูลรถเข็นวัตถุดิบ</div>
      <div class="platebox">
        <div>ป้ายทะเบียน: ${trolleyData.tro_id ?? "-"}</div>
        <div>สถานที่จัดส่ง: ${
          trolleyData.Location === "บรรจุ"
            ? trolleyData.rmm_line_name ?? "-"
            : trolleyData.Location ?? "-"
        }</div>
      </div>
      <div class="section">
        <div class="section-title">ข้อมูลทั่วไป</div>
        <div class="row">พื้นที่จอด: ${trolleyData.slot_id ?? "-"}</div>
        <div class="row">ผู้ดำเนินการ: ${trolleyData.operator ?? "-"}</div>
        <div class="row">สถานะรถเข็น: ${trolleyData.rm_cold_status ?? "-"}</div>
        <div class="row">สถานะวัตถุดิบ: ${trolleyData.rm_status ?? "-"}</div>
      </div>
      ${materialBlocks.join("")}
    </div>
  </body>
  </html>
  `;
}

// สั่งพิมพ์เงียบด้วย Puppeteer + kiosk-printing (พิมพ์ตรงไปที่เครื่องพิมพ์ default ของ Windows ทันที ไม่มี dialog)
async function silentPrintHTML(html) {
  const browser = await puppeteer.launch({
    headless: false, // kiosk-printing ต้องใช้คู่กับ headless: false ถึงจะพิมพ์ได้จริง บน Windows
    args: ["--kiosk-printing"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    // ⭐ ตั้งความสูงหน้าให้พอดีกับเนื้อหาจริง (วัดจาก scrollHeight ในหน่วย px แล้วแปลงเป็น mm)
    // เดิมใช้ @page { size: 80mm auto } ซึ่งจะพิมพ์เต็มความสูงหน้ากระดาษตายตัวของ driver
    // → เนื้อหาจบแต่ยังมีช่องว่างด้านล่างทั้งหน้า เปลืองกระดาษ มีการ์ดเหลืองๆ
    const heightMm = await page.evaluate(() => {
      const PX_PER_MM = 96 / 25.4;
      const contentHeightMm = Math.ceil(document.documentElement.scrollHeight / PX_PER_MM) + 2;
      const widthMm = 80; // ตรงกับ PAGE_WIDTH_MM ใน buildSlipHTML
      const style = document.createElement("style");
      style.textContent = `@page { size: ${widthMm}mm ${contentHeightMm}mm; margin: 0mm; }`;
      document.head.appendChild(style);
      return contentHeightMm;
    });
    console.log(`📏 ตั้งความสูงสลิป ${heightMm}mm ตามเนื้อหา`);

    await page.evaluate(() => window.print());
    // หน่วงเวลาเล็กน้อยให้ print job ถูกส่งเข้าคิวก่อนปิด browser
    await new Promise((r) => setTimeout(r, 3000));
  } finally {
    await browser.close();
  }
}

// Endpoint: รับ tro_id/mapping_id (+ trolleyData ถ้ามี) แล้วพิมพ์สลิปอัตโนมัติ
//
// ⭐ FIX: ถ้า frontend แนบ trolleyData มาด้วย (แนะนำ — โดยเฉพาะ flow checkout/export)
// จะใช้ข้อมูลนั้นทันที ไม่ไป fetch จาก fetchSlotRawMat ซ้ำ เพราะ endpoint นั้นคืนเฉพาะ
// รถเข็นที่ "ยังอยู่ในช่อง" ซึ่งพอ checkout เสร็จแล้วรถเข็นจะหลุดออกจากลิสต์นั้นทันที
// NEW: printerHost/printerShare (+ printerDotWidth ถ้ามี) ถ้าส่งมาจาก frontend (มาจาก
// RFIDReaderConfig.printer_host/printer_share ต่อ reader) → พิมพ์แบบ RAW ESC/POS ข้าม
// network ไปเครื่องปลายทางตรงๆ ไม่ต้องมี print-agent รันอยู่บนเครื่องนั้นเลย
// ถ้าไม่ส่งมา (ค่าว่าง) → fallback ไปวิธีเดิม (kiosk-printing ผ่าน default printer ของ
// เครื่องที่รัน print-agent นี้อยู่ — ใช้กับสถานีที่ยังรัน print-agent local แบบเดิม)
// ⭐ กันสลิปซ้ำที่ "จุดเดียวที่ทุกคำขอต้องผ่าน": หลายเบราว์เซอร์/หลายแท็บ (รวมถึงเครื่องที่ยังเปิดหน้าเว็บโค้ดเก่าค้างอยู่)
// อาจส่งคำขอพิมพ์ของการสแกนเดียวกันมาพร้อมกัน → ถ้ารถเข็นคันเดิมถูกสั่งพิมพ์ไปเครื่องพิมพ์เดิมภายใน PRINT_DEDUPE_SECONDS
// (ค่าเริ่มต้น 30 วินาที, ตั้ง 0 = ปิด) จะตอบ ok แต่ไม่พิมพ์ซ้ำ — reader มีดีเลย์กันสแกนซ้ำ ≥ 1 นาทีอยู่แล้ว จึงไม่กระทบการสแกนจริงรอบถัดไป
const PRINT_DEDUPE_MS = (Number(process.env.PRINT_DEDUPE_SECONDS) >= 0 && process.env.PRINT_DEDUPE_SECONDS !== undefined
  ? Number(process.env.PRINT_DEDUPE_SECONDS) : 30) * 1000;
const recentPrints = new Map(); // key -> เวลาที่รับคำขอล่าสุด

app.post("/print-slip", async (req, res) => {
  const { identifier, trolleyData: providedTrolleyData, printerHost, printerShare, printerDotWidth } = req.body || {};
  if (!identifier) {
    return res.status(400).json({ ok: false, error: "ไม่มี identifier (tro_id หรือ mapping_id) ส่งมา" });
  }

  const dedupeKey = `${printerHost || "local"}|${printerShare || ""}|${identifier}`;
  const who = `${req.ip} ${req.get("origin") || ""}`.trim(); // ดูใน log ว่าคำขอมาจากกี่เครื่อง
  const nowMs = Date.now();
  const lastMs = recentPrints.get(dedupeKey);
  if (PRINT_DEDUPE_MS > 0 && lastMs !== undefined && nowMs - lastMs < PRINT_DEDUPE_MS) {
    console.log(`⏭️ ข้ามคำขอพิมพ์ซ้ำ identifier=${identifier} (เพิ่งรับคำขอเดียวกันไป ${Math.round((nowMs - lastMs) / 1000)} วินาทีที่แล้ว) จาก ${who}`);
    return res.json({ ok: true, printed: identifier, deduped: true });
  }
  // จองก่อนเริ่ม render (ใช้เวลาหลายวินาที) — คำขอที่ตามมาติดๆ จะถูกกันตั้งแต่ตอนนี้
  recentPrints.set(dedupeKey, nowMs);
  if (recentPrints.size > 500) {
    for (const [k, t] of recentPrints) if (nowMs - t > 10 * 60 * 1000) recentPrints.delete(k);
  }
  console.log(`🖨️ รับคำขอพิมพ์ identifier=${identifier} จาก ${who}`);

  try {
    let trolleyData = providedTrolleyData;

    if (!trolleyData) {
      // ไม่มีข้อมูลแนบมา → fallback ไป fetch เอง (ใช้ได้กับ flow check-in ที่รถเข็นยังอยู่ในช่อง)
      trolleyData = await fetchTrolleyData(identifier);
    }

    if (!trolleyData) {
      return res.status(404).json({ ok: false, error: `ไม่พบข้อมูลรถเข็นสำหรับ identifier=${identifier}` });
    }

    const html = await buildSlipHTML(trolleyData);

    if (printerHost && printerShare) {
      const result = await printHtmlToNetworkPrinter(html, {
        printerHost,
        printerShare,
        dotWidth: printerDotWidth,
      });
      console.log(`✅ พิมพ์สลิปอัตโนมัติ (RAW ผ่าน network → ${result.target}) สำเร็จสำหรับ identifier=${identifier}`);
    } else {
      await silentPrintHTML(html);
      console.log(`✅ พิมพ์สลิปอัตโนมัติ (local kiosk-printing) สำเร็จสำหรับ identifier=${identifier}`);
    }

    res.json({ ok: true, printed: identifier });
  } catch (err) {
    console.error("พิมพ์สลิปอัตโนมัติไม่สำเร็จ:", err.message);
    recentPrints.delete(dedupeKey); // พิมพ์ไม่สำเร็จ → ให้ลองสั่งพิมพ์ซ้ำได้ทันที ไม่ต้องรอ
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🖨️  Print Agent กำลังทำงานที่ http://0.0.0.0:${PORT}`);
  console.log(`   ทดสอบ: http://localhost:${PORT}/health`);
  console.log(`   ดูรายชื่อปริ้นเตอร์: http://localhost:${PORT}/printers`);
});