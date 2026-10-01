// src/utils/bluetoothPrinter.js
//
// ⚠️ ใช้ได้เฉพาะปริ้นเตอร์ที่เป็น BLE (GATT) เท่านั้น — ไม่รองรับ Bluetooth Classic/SPP
// ต้องรันผ่าน HTTPS หรือ localhost เท่านั้น (ข้อจำกัดของ Web Bluetooth API)
//
// UUID ด้านล่างเป็นค่า default ของโมดูล UART แบบ ISSC/HM-10 ที่ปริ้นเตอร์ BLE ราคาประหยัด
// มักใช้กัน — ถ้าปริ้นเตอร์จริงใช้ UUID อื่น ให้เปลี่ยนค่าตรงนี้ (ดูได้จากคู่มือเครื่อง
// หรือเปิด chrome://bluetooth-internals ตอนจับคู่เพื่อดู service list จริง)

const DEFAULT_SERVICE_UUID = "49535343-fe7d-4ae5-8fa9-9fafd205e455";
const DEFAULT_WRITE_CHARACTERISTIC_UUID = "49535343-8841-43f4-a8d4-ecbe34729bb3";

// BLE write มักจำกัดขนาด payload ต่อครั้ง (MTU) — แบ่งส่งเป็นชิ้นเล็กๆ กันข้อมูลหาย
const CHUNK_SIZE = 20;
const CHUNK_DELAY_MS = 20;

let bleDevice = null;
let bleCharacteristic = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * เปิดหน้าต่างให้ผู้ใช้เลือกจับคู่ปริ้นเตอร์ BLE
 * ⚠️ ต้องเรียกจาก user gesture เท่านั้น (เช่น onClick ของปุ่ม "เชื่อมต่อปริ้นเตอร์")
 * เชื่อมต่อครั้งแรกแล้ว จะเก็บ device ไว้ใน memory เพื่อ reconnect อัตโนมัติ
 * โดยไม่ต้องมี user gesture ในครั้งถัดไป (print อัตโนมัติจาก socket event ได้)
 */
export const connectBluetoothPrinter = async (
  serviceUuid = DEFAULT_SERVICE_UUID,
  writeCharUuid = DEFAULT_WRITE_CHARACTERISTIC_UUID
) => {
  if (!navigator.bluetooth) {
    throw new Error(
      "เบราว์เซอร์นี้ไม่รองรับ Web Bluetooth API (ใช้ Chrome หรือ Edge บน Desktop/Android เท่านั้น และต้องเป็น HTTPS หรือ localhost)"
    );
  }

  bleDevice = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [serviceUuid],
  });

  bleDevice.addEventListener("gattserverdisconnected", onDisconnected);

  const server = await bleDevice.gatt.connect();
  const service = await server.getPrimaryService(serviceUuid);
  bleCharacteristic = await service.getCharacteristic(writeCharUuid);

  return bleDevice;
};

const onDisconnected = () => {
  console.warn("⚠️ ปริ้นเตอร์ Bluetooth หลุดการเชื่อมต่อ");
  bleCharacteristic = null;
};

/**
 * เชื่อมต่อใหม่แบบไม่ต้อง user gesture (ใช้ตอน auto-reconnect หลัง disconnect)
 * ใช้ได้เฉพาะกรณีที่เคยจับคู่ device (bleDevice) ไว้แล้วในเซสชันนี้
 */
const ensureConnected = async (serviceUuid, writeCharUuid) => {
  if (bleCharacteristic) return;

  if (!bleDevice) {
    throw new Error("ยังไม่ได้จับคู่ปริ้นเตอร์ — กรุณากดปุ่ม 'เชื่อมต่อปริ้นเตอร์' ก่อน");
  }

  const server = await bleDevice.gatt.connect();
  const service = await server.getPrimaryService(serviceUuid);
  bleCharacteristic = await service.getCharacteristic(writeCharUuid);
};

/**
 * ส่งคำสั่ง TSPL/ข้อความไปพิมพ์ที่ปริ้นเตอร์ BLE
 * แบ่งส่งเป็น chunk เล็กๆ ตาม BLE MTU
 * ⚠️ ใช้ TextEncoder (UTF-8 เสมอ) — ไม่เหมาะกับปริ้นเตอร์ที่ต้องการ single-byte
 * encoding แบบ TIS-620 สำหรับภาษาไทย (ดู printBytesBluetooth ด้านล่างแทน)
 */
export const printTSPLBluetooth = async (
  tsplCommand,
  serviceUuid = DEFAULT_SERVICE_UUID,
  writeCharUuid = DEFAULT_WRITE_CHARACTERISTIC_UUID
) => {
  await ensureConnected(serviceUuid, writeCharUuid);

  const encoder = new TextEncoder();
  const data = encoder.encode(tsplCommand);

  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    const chunk = data.slice(i, i + CHUNK_SIZE);
    try {
      await bleCharacteristic.writeValueWithoutResponse(chunk);
    } catch (err) {
      // บางปริ้นเตอร์ไม่รองรับ writeWithoutResponse ให้ fallback เป็น writeValue ปกติ
      await bleCharacteristic.writeValue(chunk);
    }
    await sleep(CHUNK_DELAY_MS);
  }
};

export const debugListGattServices = async () => {
  if (!bleDevice || !bleDevice.gatt.connected) {
    throw new Error("ยังไม่ได้เชื่อมต่อปริ้นเตอร์");
  }
  const server = bleDevice.gatt;
  const services = await server.getPrimaryServices();
  for (const service of services) {
    console.log("Service:", service.uuid);
    const chars = await service.getCharacteristics();
    chars.forEach((c) => {
      console.log("  Characteristic:", c.uuid, "properties:", c.properties);
    });
  }
};

// NEW: ส่ง raw bytes (Uint8Array) ตรงๆ ไปพิมพ์ — ใช้กับคำสั่ง ESC/POS
// ที่ต้องคุมทุก byte เอง (รวมถึง byte ที่แปลงเป็นภาษาไทยแบบ TIS-620 แล้ว)
// ต่างจาก printTSPLBluetooth ที่รับแค่ string แล้ว encode เป็น UTF-8 ให้อัตโนมัติ
// ซึ่งใช้กับภาษาไทยแบบ single-byte (TIS-620) ไม่ได้ — ใช้คู่กับ escposLabel.js
export const printBytesBluetooth = async (
  bytes, // Uint8Array
  serviceUuid = DEFAULT_SERVICE_UUID,
  writeCharUuid = DEFAULT_WRITE_CHARACTERISTIC_UUID
) => {
  await ensureConnected(serviceUuid, writeCharUuid);

  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.slice(i, i + CHUNK_SIZE);
    try {
      await bleCharacteristic.writeValueWithoutResponse(chunk);
    } catch (err) {
      await bleCharacteristic.writeValue(chunk);
    }
    await sleep(CHUNK_DELAY_MS);
  }
};

export const isPrinterConnected = () => !!bleCharacteristic;

export const disconnectPrinter = () => {
  if (bleDevice && bleDevice.gatt.connected) {
    bleDevice.gatt.disconnect();
  }
  bleCharacteristic = null;
};