// src/utils/tsplLabel.js

/**
 * สร้างคำสั่ง TSPL สำหรับพิมพ์ label ของรถเข็น
 * @param {object} row - ข้อมูลรถเข็น (tro_id, production, trolleyStatus, materials, ...)
 * @param {object} options - { readerName }
 * @returns {string} คำสั่ง TSPL
 */
export const buildTsplLabel = (row, options = {}) => {
  const { readerName = "-" } = options;

  const now = new Date().toLocaleString("th-TH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const materials = row.materials || [];
  const totalWeight = materials.reduce((sum, m) => sum + (m.weight_RM || 0), 0);
  const totalTrays = materials.reduce((sum, m) => sum + (m.tray_count || 0), 0);

  let commands = "";

  // ตั้งค่าขนาด label (ปรับตามเครื่องพิมพ์จริง หน่วย mm)
  commands += "SIZE 100 mm, 75 mm\r\n";
  commands += "GAP 2 mm, 0 mm\r\n";
  commands += "DIRECTION 1\r\n";
  commands += "CLS\r\n";

  // หัว label
  commands += `TEXT 20,20,"3",0,1,1,"รถเข็น: ${row.tro_id || "-"}"\r\n`;
  commands += `TEXT 20,60,"2",0,1,1,"แผนผลิต: ${row.production || "-"}"\r\n`;
  commands += `TEXT 20,90,"2",0,1,1,"สถานะ: ${row.trolleyStatus || "-"}"\r\n`;
  commands += `TEXT 20,120,"1",0,1,1,"น้ำหนักรวม: ${totalWeight.toFixed(2)} kg | ถาด: ${totalTrays}"\r\n`;
  commands += `TEXT 20,150,"1",0,1,1,"เครื่องอ่าน: ${readerName}"\r\n`;
  commands += `TEXT 20,170,"1",0,1,1,"พิมพ์เมื่อ: ${now}"\r\n`;

  // บาร์โค้ดของ tro_id
  commands += `BARCODE 20,200,"128",60,1,0,2,2,"${row.tro_id || ""}"\r\n`;

  // รายการวัตถุดิบ (ถ้าพื้นที่พอ แสดงแค่ไม่กี่รายการแรก)
  let y = 280;
  materials.slice(0, 5).forEach((m) => {
    const line = `${m.batch || "-"} ${m.materialName || m.material_code || "-"} (${m.weight_RM || 0}kg)`;
    commands += `TEXT 20,${y},"1",0,1,1,"${line}"\r\n`;
    y += 20;
  });

  commands += "PRINT 1,1\r\n";

  return commands;
};