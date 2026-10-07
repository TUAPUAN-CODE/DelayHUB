import { useMemo } from "react";
import { BarChart2, LogIn, FileWarning, MapPin, PackageCheck, Printer, LogOut, Table2 } from "lucide-react";
import AppSidebar from "../Layout/AppSidebar";

const allowedPositions = ["3", "4", "5", "6"];

const SidebarPack = () => {
  const canSeeDelayRM = allowedPositions.includes(localStorage.getItem("pos_id"));

  const sections = useMemo(() => [
    {
      items: [
        { name: "ตารางรวมวัตถุดิบ", icon: Table2, href: "/packaging/Sheet" },
        // หน้าเดียวสำหรับ ผสม · QC · ใส่รถเข็น · ส่งปลายทาง · ยืนยัน Delay
        { name: "รายงาน Delay", icon: FileWarning, href: "/packaging/ManageRawmatPack", exact: true },
        ...(canSeeDelayRM ? [{ name: "รายงาน Delay +RM", icon: FileWarning, href: "/packaging/managedelaymaster" }] : []),
        { name: "Check In", icon: LogIn, href: "/packaging/CheckInPagePack" },
        { name: "Report", icon: BarChart2, href: "/packaging/ReportRawmatPackuser" },
        { name: "เปลี่ยนสถานที่ทำงาน", icon: MapPin, href: "/packaging/User/LineSelectWP" },
        { name: "รายงานการใช้บรรจุภัณฑ์", icon: PackageCheck, href: "/packaging/UsePKG" },
        { name: "พิมพ์สลีป Android", icon: Printer, href: "/packaging/Printpackandroid" },
        { name: "ออกจากระบบ", icon: LogOut, href: "/logout" },
      ],
    },
  ], [canSeeDelayRM]);

  return <AppSidebar title="DelayHUB" subtitle="บรรจุภัณฑ์" sections={sections} />;
};

export default SidebarPack;
