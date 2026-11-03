// สิทธิ์พิเศษรายบัญชี: Supervisor/Master ตั้งในหน้าการจัดการพนักงาน → backend ส่งมาตอน login → เก็บที่ localStorage.perms
// manual_trolley = คีย์เลขรถเข็นเองใน modal Scan รถเข็น (ปกติสแกนได้อย่างเดียว)
export const hasPerm = (key) => {
  try {
    return JSON.parse(localStorage.getItem("perms") || "[]").includes(key);
  } catch {
    return false;
  }
};

// scan_sap_only = ปุ่ม "สแกนป้าย SAP": ห้ามพิมพ์เอง ต้องมาจากกล้อง / เครื่องสแกนเท่านั้น (ค่าเริ่มต้น = พิมพ์ได้ทุกบัญชี)
export const mustScanSap = () => hasPerm("scan_sap_only");

export const canTypeTrolley = () => hasPerm("manual_trolley");
