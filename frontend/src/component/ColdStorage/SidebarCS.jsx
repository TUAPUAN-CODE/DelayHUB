import { Table2, CheckCircle2, Radio, History, LogOut } from "lucide-react";
import AppSidebar from "../Layout/AppSidebar";

const SECTIONS = [
  {
    items: [
      { name: "กำลังดำเนินการ", icon: Table2, href: "/coldStorage/Sheet" },
      { name: "ดำเนินการเสร็จสิ้น", icon: CheckCircle2, href: "/coldStorage/Sheet?view=done" },
      { name: "ส่งออก RFID", icon: Radio, href: "/coldStorage/EmptyTrolley/RFIDCSCheckOutPage" },
      { name: "ประวัติ", icon: History, href: "/coldStorage/HisInput/HisInputPage" },
      { name: "ออกจากระบบ", icon: LogOut, href: "/logout" },
    ],
  },
];

const SidebarCS = () => <AppSidebar title="DelayHUB" subtitle="ห้องเย็น" sections={SECTIONS} />;

export default SidebarCS;
