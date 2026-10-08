import { useMemo } from "react";
import { BarChart2, PackageCheck, Printer, LogOut, Table2 } from "lucide-react";
import AppSidebar from "../Layout/AppSidebar";

const SidebarPack = () => {
  const sections = useMemo(() => [
    {
      items: [
        // หน้าเดียวสำหรับ ผสม · QC · ใส่รถเข็น · ส่งปลายทาง · ยืนยัน Delay · เพิ่ม RM · Check In
        { name: "ตารางรวมวัตถุดิบ", icon: Table2, href: "/packaging/Sheet" },
        { name: "Report", icon: BarChart2, href: "/packaging/ReportRawmatPackuser" },
        { name: "รายงานการใช้บรรจุภัณฑ์", icon: PackageCheck, href: "/packaging/UsePKG" },
        { name: "พิมพ์สลีป Android", icon: Printer, href: "/packaging/Printpackandroid" },
        { name: "ออกจากระบบ", icon: LogOut, href: "/logout" },
      ],
    },
  ], []);

  return <AppSidebar title="DelayHUB" subtitle="บรรจุภัณฑ์" sections={sections} />;
};

export default SidebarPack;
