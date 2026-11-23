// Dictionary: Thai source text -> [English, Burmese, Khmer]. "{x}" stands for any value the code puts in (see ../lookup.js).
// Supplier / customer page /sup/Supplier (Supervisor/Supplier) and its API /api/supplier (backend/routes/SupplierRoutes.js), data from WISEUP.
// English only for now: the Burmese / Khmer screens show the English text until someone adds the translations here.
export default {
  // sidebar + page bar
  "ผู้ขาย / ลูกค้า": ["Suppliers / customers"],
  "ลูกค้า (Customer)": ["Customers"],
  "ช่วงวันที่": ["Date range"],
  "1 ปี": ["1 year"],
  "ข้อมูลจาก WISEUP (อ่านอย่างเดียว)": ["Data from WISEUP (read-only)"],

  // supplier list
  "ค้นหารหัส / ชื่อผู้ขาย": ["Search supplier code / name"],
  "โหลดรายชื่อผู้ขายไม่สำเร็จ": ["Could not load the suppliers"],
  "ไม่พบผู้ขายที่ส่งของในช่วงนี้": ["No supplier delivered in this period"],
  "{x} ราย": ["{x} found"],
  "{x} ราย (แสดง {x} แรก)": ["{x} found (showing the first {x})"],

  // supplier detail
  "เลือกผู้ขายทางซ้ายเพื่อดูรายละเอียด": ["Pick a supplier on the left to see the details"],
  "โหลดข้อมูลผู้ขายไม่สำเร็จ": ["Could not load the supplier"],
  "{x} - {x} · รับเข้า {x} บรรทัด · วัตถุดิบ {x} ชนิด": ["{x} - {x} · {x} receipt lines · {x} materials"],
  "วัตถุดิบที่ส่ง": ["Materials delivered"],
  "รายการรับเข้า": ["Goods receipts"],
  "ผลตรวจรายหัวข้อ": ["Inspection results"],
  "หัวข้อที่ไม่ผ่านบ่อย": ["Most failed checks"],
  "แสดง {x} แถวล่าสุด — ย่อช่วงวันที่หรือเลือกวัตถุดิบเพื่อดูส่วนที่เหลือ": ["Showing the latest {x} rows — narrow the dates or pick a material to see the rest"],

  // overview
  "ชื่อทางการค้า": ["Trade name"],
  "ที่อยู่": ["Address"],
  "โทรศัพท์": ["Phone"],
  "เลขประจำตัวผู้เสียภาษี": ["Tax ID"],
  "แก้ไขล่าสุดใน WISEUP": ["Last changed in WISEUP"],
  "WISEUP เก็บเฉพาะรหัสและชื่อผู้ขาย — ที่อยู่ / โทรศัพท์ / เลขภาษี ต้องดูจาก SAP Vendor Master": ["WISEUP keeps only the supplier code and name — see the SAP vendor master for the address / phone / tax ID"],
  "การส่งของในช่วงวันที่": ["Deliveries in the date range"],
  "บรรทัดรับเข้า": ["Receipt lines"],
  "ใบรับสินค้า": ["Goods receipts"],
  "ชนิดวัตถุดิบ": ["Materials"],
  "ใบสั่งซื้อ (PO)": ["Purchase orders (PO)"],
  "รับครั้งแรก / ล่าสุด": ["First / last receipt"],
  "ผลตัดสินคุณภาพรับเข้า (Inspection Lot)": ["Incoming quality decisions (inspection lots)"],
  "Lot ทั้งหมด": ["All lots"],
  "ยอมรับแบบมีเงื่อนไข": ["Accepted with condition"],
  "ร้องเรียน": ["Complaint"],
  "ปฏิเสธ": ["Rejected"],
  "% ปฏิเสธ": ["% rejected"],
  "รอผล": ["Pending"],
  "จำนวน Lot": ["Lots"],
  "ไม่มี Inspection Lot ในช่วงนี้": ["No inspection lot in this period"],

  // materials / receipts / results / failing checks
  "กลุ่ม (SAP)": ["Group (SAP)"],
  "ครั้งที่รับ": ["Receipts"],
  "ปริมาณรวม": ["Total quantity"],
  "รับล่าสุด": ["Last received"],
  "ดูใบรับของวัตถุดิบนี้": ["See the receipts of this material"],
  "ไม่มีการรับวัตถุดิบในช่วงนี้": ["No material received in this period"],
  "รับเมื่อ": ["Received"],
  "Batch ผู้ขาย": ["Vendor batch"],
  "หมดอายุ": ["Expires"],
  "ไม่มีใบรับในช่วงนี้": ["No goods receipt in this period"],
  "หัวข้อตรวจ": ["Characteristic"],
  "ต่ำสุด / เป้า / สูงสุด": ["Min / target / max"],
  "ค่าที่วัด": ["Measured"],
  "ไม่มีผลตรวจในช่วงนี้": ["No inspection result in this period"],
  "รหัส (MIC)": ["Code (MIC)"],
  "จำนวนผลตรวจ": ["Results"],
  "% ไม่ผ่าน": ["% failed"],

  // inspection lot dialog
  "โหลดข้อมูล Inspection Lot ไม่สำเร็จ": ["Could not load the inspection lot"],
  "วันที่รับ": ["Received date"],
  "สร้าง Lot เมื่อ": ["Lot created"],
  "ตัดสินเมื่อ": ["Decided"],
  "จำนวนที่ปล่อย / กัก": ["Released / blocked quantity"],
  "ปล่อย": ["Released"],
  "กัก": ["Blocked"],
  "แผนตรวจ": ["Inspection plan"],
  "ไม่มีข้อมูลจุดตรวจ": ["No inspection point"],
  "ไม่มีผลตรวจ": ["No inspection result"],

  // customers
  "โหลดข้อมูลลูกค้าไม่สำเร็จ": ["Could not load the customers"],
  "ค้นหารหัส / ชื่อลูกค้า": ["Search customer code / name"],
  "รหัสลูกค้า": ["Customer code"],
  "ชื่อลูกค้า": ["Customer name"],
  "ประเทศ": ["Country"],
  "สินค้าทั้งหมด": ["All products"],
  "ใบสั่งผลิตในช่วงนี้": ["Production orders in this period"],
  "สินค้าที่ผลิตในช่วงนี้": ["Products made in this period"],
  "ผลิตล่าสุด": ["Last produced"],
  "ไม่พบลูกค้า": ["No customer found"],

  // API errors (backend/routes/SupplierRoutes.js)
  "ไม่สามารถเชื่อมต่อฐานข้อมูล WISEUP ได้": ["Cannot connect to the WISEUP database"],
  "ช่วงวันที่ยาวได้ไม่เกิน {x} วัน": ["The date range can be at most {x} days"],
  "รหัสผู้ขายไม่ถูกต้อง": ["Invalid supplier code"],
  "รหัสวัตถุดิบไม่ถูกต้อง": ["Invalid material code"],
  "เลข Inspection Lot ไม่ถูกต้อง": ["Invalid inspection lot number"],
  "ไม่พบ Inspection Lot นี้": ["Inspection lot not found"],
};
