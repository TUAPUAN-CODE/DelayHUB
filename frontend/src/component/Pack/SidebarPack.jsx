import { useMemo } from "react";
import { BarChart2, ClipboardList, Download, LogIn, Blend, Truck, FileWarning, FileBarChart, History, MapPin, PackageCheck, Printer, LogOut } from "lucide-react";
import AppSidebar from "../Layout/AppSidebar";

const allowedPositions = ["3", "4", "5", "6"];

const SidebarPack = () => {
  const canSeeDelayRM = allowedPositions.includes(localStorage.getItem("pos_id"));

  const sections = useMemo(() => [
    {
      items: [
        { name: "ติดตามรถเข็น", icon: Truck, href: "/packaging/TrackTrolley" },
        { name: "ดึงข้อมูลวัตถุดิบ", icon: Download, href: "/packaging/CheckOut" },
        { name: "Check In", icon: LogIn, href: "/packaging/CheckInPagePack" },
        { name: "ผสมวัตถุดิบ", icon: Blend, href: "/packaging/IncludeRawmatPagePack" },
        { name: "จัดการรถเข็น", icon: ClipboardList, href: "/packaging/PackTro/PackTroPage" },
        { name: "รายงาน Delay", icon: FileWarning, href: "/packaging/ManageRawmatPack" },
        ...(canSeeDelayRM ? [{ name: "รายงาน Delay +RM", icon: FileWarning, href: "/packaging/managedelaymaster" }] : []),
        { name: "Report", icon: BarChart2, href: "/packaging/ReportRawmatPackuser" },
        { name: "ประวัติ Report", icon: FileBarChart, href: "/packaging/ReportPull" },
        { name: "เปลี่ยนสถานที่ทำงาน", icon: MapPin, href: "/packaging/User/LineSelectWP" },
        { name: "ประวัติ", icon: History, href: "/packaging/History/HistoryPage" },
        { name: "รายงานการใช้บรรจุภัณฑ์", icon: PackageCheck, href: "/packaging/UsePKG" },
        { name: "พิมพ์สลีป Android", icon: Printer, href: "/packaging/Printpackandroid" },
        { name: "ออกจากระบบ", icon: LogOut, href: "/logout" },
      ],
    },
  ], [canSeeDelayRM]);

  return <AppSidebar title="DelayHUB" subtitle="บรรจุภัณฑ์" sections={sections} />;
};

export default SidebarPack;
