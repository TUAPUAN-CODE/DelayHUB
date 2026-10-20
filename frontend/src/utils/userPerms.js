// สิทธิ์พิเศษรายบัญชี: Supervisor/Master ตั้งในหน้าการจัดการพนักงาน → backend ส่งมาตอน login → เก็บที่ localStorage.perms
// manual_trolley = คีย์เลขรถเข็นเองใน modal Scan รถเข็น (ปกติสแกนได้อย่างเดียว)
export const hasPerm = (key) => {
  try {
    return JSON.parse(localStorage.getItem("perms") || "[]").includes(key);
  } catch {
    return false;
  }
};

export const canTypeTrolley = () => hasPerm("manual_trolley");
