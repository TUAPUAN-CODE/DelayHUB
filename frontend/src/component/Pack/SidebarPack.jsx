import { useMemo } from "react";
import { BarChart2, PackageCheck, Printer, LogOut, Table2, CheckCircle2 } from "lucide-react";
import AppSidebar from "../Layout/AppSidebar";

const SidebarPack = () => {
  const sections = useMemo(() => [
    {
      items: [
        // หน้าเดียวสำหรับ ผสม · QC · ใส่รถเข็น · ส่งปลายทาง · ยืนยัน Delay · เพิ่ม RM · Check In
        { name: "กำลังดำเนินการ", icon: Table2, href: "/packaging/Sheet" },
      { name: "ดำเนินการเสร็จสิ้น", icon: CheckCircle2, href: "/packaging/Sheet?view=done" },
        { name: "Report", icon: BarChart2, href: "/packaging/ReportRawmatPackuser" },
        { name: "ใช้บรรจุภัณฑ์", icon: PackageCheck, href: "/packaging/UsePKG" },
        { name: "สลีป Android", icon: Printer, href: "/packaging/Printpackandroid" },
        { name: "ออกจากระบบ", icon: LogOut, href: "/logout" },
      ],
    },
  ], []);

  return <AppSidebar title="DelayHUB" subtitle="บรรจุภัณฑ์" sections={sections} />;
};

export default SidebarPack;
