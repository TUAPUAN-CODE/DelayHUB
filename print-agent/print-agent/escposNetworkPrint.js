// print-agent/escposNetworkPrint.js
//
// ระบบพิมพ์สลิปแบบ "RAW ESC/POS จากส่วนกลาง" — แทนที่การรัน print-agent แยกทุกเครื่อง
//
// แนวคิด: render HTML สลิป (ใช้ฟังก์ชันเดิมจาก server.js) เป็น "ภาพ" ด้วย Puppeteer
// (ไม่ใช้ kiosk-printing/default printer แล้ว) แปลงภาพเป็นบิตแมปขาวดำ ห่อด้วยคำสั่ง
// ESC/POS raster image (GS v 0) แล้วส่ง byte ดิบไปที่เครื่องพิมพ์ปลายทางผ่าน Windows
// network share (\\<printer_host>\<printer_share>) — เครื่องปลายทางแค่ต้อง "แชร์
// เครื่องพิมพ์ไว้ใน Windows" เท่านั้น ไม่ต้องลง/รันโค้ดอะไรเพิ่มเลย
//
// ข้อดี: ไม่ต้องกังวลเรื่องฟอนต์ไทยในเครื่องพิมพ์ (พิมพ์เป็นภาพทั้งแผ่น ไม่ใช่ข้อความ)
// ข้อควรระวัง: ต้องทดสอบพิมพ์จริงกับเครื่องพิมพ์จริงก่อนใช้งานจริง เพื่อปรับ
// printer_dot_width ให้พอดีกับความกว้างกระดาษ/หัวพิมพ์ของรุ่นนั้นๆ (ค่ามาตรฐาน
// เครื่องพิมพ์ความร้อน 80mm ที่ 203dpi คือ 576 dots)

const fs = require("fs");
const os = require("os");
const path = require("path");
const { exec } = require("child_process");
const puppeteer = require("puppeteer");
const Jimp = require("jimp");

const DEFAULT_DOT_WIDTH = 576; // 80mm @ 203dpi มาตรฐาน — ปรับต่อเครื่องผ่าน printer_dot_width ได้
const CSS_PX_PER_MM = 96 / 25.4;
const PAGE_WIDTH_MM = 80; // ต้องตรงกับ PAGE_WIDTH_MM ใน buildSlipHTML (server.js)

// แปลง HTML สลิป → ภาพ PNG (ถ่ายเฉพาะ .container ไม่เอาพื้นที่ว่างรอบๆ)
async function renderHtmlToPngBuffer(html, dotWidth) {
  const pageWidthCssPx = PAGE_WIDTH_MM * CSS_PX_PER_MM; // ~302px ที่ scale 1
  const deviceScaleFactor = dotWidth / pageWidthCssPx;

  const browser = await puppeteer.launch({ headless: "new" });
  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: Math.ceil(pageWidthCssPx),
      height: 100, // แค่ค่าเริ่มต้น จะถูกแทนที่ด้วยความสูงจริงของ .container ตอน screenshot
      deviceScaleFactor,
    });
    await page.setContent(html, { waitUntil: "networkidle0" });

    const container = await page.$(".container");
    if (!container) {
      throw new Error("ไม่พบ .container ใน HTML ที่ render (ตรวจสอบ buildSlipHTML)");
    }
    return await container.screenshot({ type: "png" });
  } finally {
    await browser.close();
  }
}

// แปลง PNG buffer → บิตแมปขาวดำ 1bpp แบบ ESC/POS raster (GS v 0)
// คืนค่าเป็น Buffer ที่พร้อมส่งเข้าเครื่องพิมพ์ตรงๆ (รวม header คำสั่งแล้ว)
async function pngToEscPosRaster(pngBuffer, dotWidth) {
  const image = await Jimp.read(pngBuffer);

  // ย่อ/ขยายให้กว้างพอดี dotWidth เสมอ (กันกรณี deviceScaleFactor ปัดเศษไม่ตรงเป๊ะ)
  image.resize(dotWidth, Jimp.AUTO);
  image.greyscale();

  const width = image.bitmap.width;
  const height = image.bitmap.height;
  const bytesPerRow = Math.ceil(width / 8);

  const raster = Buffer.alloc(bytesPerRow * height);
  const THRESHOLD = 200; // ค่าสว่างต่ำกว่านี้ถือเป็น "จุดดำ" — ปรับได้ถ้าพิมพ์จริงแล้วเข้ม/จางเกินไป

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = image.getPixelIndex(x, y);
      const grey = image.bitmap.data[idx]; // R=G=B หลัง greyscale()
      const isBlack = grey < THRESHOLD;
      if (isBlack) {
        const byteIndex = y * bytesPerRow + (x >> 3);
        const bitMask = 0x80 >> (x & 7);
        raster[byteIndex] |= bitMask;
      }
    }
  }

  // GS v 0 m xL xH yL yH d1...dk (ESC/POS raster bit image, normal mode)
  const GS = 0x1d, v = 0x76, zero = 0x30, m = 0x00;
  const xL = bytesPerRow & 0xff;
  const xH = (bytesPerRow >> 8) & 0xff;
  const yL = height & 0xff;
  const yH = (height >> 8) & 0xff;

  const header = Buffer.from([GS, v, zero, m, xL, xH, yL, yH]);
  const init = Buffer.from([0x1b, 0x40]); // ESC @ (initialize printer)

  return Buffer.concat([init, header, raster]);
}

// ส่ง byte ดิบไปเครื่องพิมพ์ปลายทางผ่าน Windows network share
// (เหมือน copy /b ที่ใช้กับ \\localhost\<share> ใน server.js แต่ระบุเครื่องปลายทางได้)
function sendRawBytesToShare(bytes, printerHost, printerShare) {
  return new Promise((resolve, reject) => {
    const tempFile = path.join(os.tmpdir(), `slip_${Date.now()}.prn`);
    fs.writeFile(tempFile, bytes, (writeErr) => {
      if (writeErr) return reject(new Error("เขียนไฟล์ temp ไม่สำเร็จ: " + writeErr.message));

      const target = `\\\\${printerHost}\\${printerShare}`;
      const cmd = `copy /b "${tempFile}" "${target}"`;

      exec(cmd, (execErr, stdout, stderr) => {
        fs.unlink(tempFile, () => {});
        if (execErr) {
          return reject(new Error(
            `ส่งพิมพ์ไป ${target} ไม่สำเร็จ — เช็คว่าแชร์เครื่องพิมพ์ไว้แล้ว และเซิร์ฟเวอร์นี้มีสิทธิ์เข้าถึง share นั้น (${stderr || execErr.message})`
          ));
        }
        resolve({ target });
      });
    });
  });
}

// ฟังก์ชันรวม: HTML → พิมพ์ผ่าน network ไปเครื่องปลายทาง
async function printHtmlToNetworkPrinter(html, { printerHost, printerShare, dotWidth }) {
  const width = Number(dotWidth) > 0 ? Number(dotWidth) : DEFAULT_DOT_WIDTH;
  const pngBuffer = await renderHtmlToPngBuffer(html, width);
  const escposBytes = await pngToEscPosRaster(pngBuffer, width);
  return await sendRawBytesToShare(escposBytes, printerHost, printerShare);
}

module.exports = { printHtmlToNetworkPrinter };
