// src/utils/webSerialPrinter.js
//
// ใช้กับเครื่องพิมพ์ที่ต่อผ่าน USB (ปรากฏเป็น USB-Serial ต่อ OS)
// ต้องรันผ่าน HTTPS หรือ localhost เท่านั้น (ข้อจำกัดของ Web Serial API)
// รองรับเฉพาะ Chrome/Edge บน Desktop เท่านั้น (ไม่รองรับมือถือ)

let port = null;
let writer = null;

/**
 * ขอสิทธิ์เชื่อมต่อกับเครื่องพิมพ์ผ่าน Web Serial API
 * ⚠️ ต้องเรียกจาก user gesture (เช่น onClick ของปุ่ม "เชื่อมต่อปริ้นเตอร์") อย่างน้อยครั้งแรก
 * หลังจากนั้น browser จะจำ permission ไว้ และสามารถ auto-reconnect
 * ด้วย navigator.serial.getPorts() โดยไม่ต้องมี user gesture อีก (ดู tryAutoReconnect ด้านล่าง)
 */
export const connectPrinter = async (baudRate = 9600) => {
  if (!("serial" in navigator)) {
    throw new Error(
      "เบราว์เซอร์นี้ไม่รองรับ Web Serial API (ใช้ Chrome หรือ Edge บน Desktop เท่านั้น และต้องเป็น HTTPS หรือ localhost)"
    );
  }

  if (port && writer) {
    return { port, writer }; // เชื่อมต่ออยู่แล้ว
  }

  port = await navigator.serial.requestPort();
  await port.open({ baudRate });
  writer = port.writable.getWriter();

  return { port, writer };
};

/**
 * ลอง reconnect อัตโนมัติกับพอร์ตที่เคยได้รับ permission ไว้แล้ว
 * ไม่ต้องมี user gesture — ใช้ตอนโหลดหน้าใหม่ หรือก่อนพิมพ์อัตโนมัติจาก RFID scan
 * ถ้าไม่เคยมี permission มาก่อนเลย จะคืนค่า false (ต้องให้ผู้ใช้กดปุ่มเชื่อมต่อเองก่อน)
 */
export const tryAutoReconnect = async (baudRate = 9600) => {
  if (port && writer) return true;
  if (!("serial" in navigator)) return false;

  const ports = await navigator.serial.getPorts(); // เฉพาะพอร์ตที่เคย grant permission แล้ว
  if (ports.length === 0) return false;

  port = ports[0];
  try {
    await port.open({ baudRate });
    writer = port.writable.getWriter();
    return true;
  } catch (err) {
    // อาจ error ถ้าพอร์ตถูกเปิดใช้อยู่แล้วโดย tab/แอปอื่น
    port = null;
    writer = null;
    return false;
  }
};

/**
 * ส่งคำสั่ง TSPL (string) ไปพิมพ์ที่เครื่องพิมพ์
 * @param {string} tsplCommand - คำสั่ง TSPL ที่สร้างจาก buildTsplLabel
 */
export const printTSPL = async (tsplCommand) => {
  try {
    if (!port || !writer) {
      const reconnected = await tryAutoReconnect();
      if (!reconnected) await connectPrinter();
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(tsplCommand);

    await writer.write(data);
  } catch (error) {
    console.error("Print error:", error);
    await disconnectPrinter();
    throw error;
  }
};

/**
 * NEW: ส่ง raw bytes (Uint8Array) ตรงๆ ไปพิมพ์ — ใช้กับคำสั่ง ESC/POS
 * ที่ต้องคุมทุก byte เอง (รวมถึงข้อความไทยที่แปลงเป็น TIS-620 แล้วจาก escposLabel.js)
 * เทียบเท่ากับ printBytesBluetooth ใน bluetoothPrinter.js แต่ส่งผ่าน USB serial แทน BLE
 */
export const printBytesSerial = async (bytes, baudRate = 9600) => {
  try {
    if (!port || !writer) {
      const reconnected = await tryAutoReconnect(baudRate);
      if (!reconnected) {
        throw new Error(
          "ยังไม่ได้เชื่อมต่อเครื่องพิมพ์ USB — กรุณากดปุ่ม 'เชื่อมต่อเครื่องพิมพ์' อย่างน้อย 1 ครั้งก่อน"
        );
      }
    }

    await writer.write(bytes);
  } catch (error) {
    console.error("Print (serial) error:", error);
    await disconnectPrinter();
    throw error;
  }
};

export const isPrinterConnected = () => !!(port && writer);

/**
 * ปิดการเชื่อมต่อเครื่องพิมพ์
 */
export const disconnectPrinter = async () => {
  try {
    if (writer) {
      writer.releaseLock();
      writer = null;
    }
    if (port) {
      await port.close();
      port = null;
    }
  } catch (error) {
    console.error("Disconnect error:", error);
  }
};