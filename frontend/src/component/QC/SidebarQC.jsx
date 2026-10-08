import { History, LogOut, Table2 } from "lucide-react";
import AppSidebar from "../Layout/AppSidebar";

const SECTIONS = [
  {
    items: [
      { name: "ตารางรวมวัตถุดิบ", icon: Table2, href: "/qualitycontrol/Sheet" },
      { name: "ประวัติการตรวจ", icon: History, href: "/qualitycontrol/HisCheck/HisCheckPage" },
      { name: "ออกจากระบบ", icon: LogOut, href: "/logout" },
    ],
  },
];

const SidebarQC = () => <AppSidebar title="DelayHUB" subtitle="ตรวจสอบคุณภาพ" sections={SECTIONS} />;

export default SidebarQC;
