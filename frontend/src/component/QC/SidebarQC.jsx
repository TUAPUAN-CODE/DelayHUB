import { ClipboardCheck, History, LogOut } from "lucide-react";
import AppSidebar from "../Layout/AppSidebar";

const SECTIONS = [
  {
    items: [
      { name: "ตรวจสอบคุณภาพ", icon: ClipboardCheck, href: "/qualitycontrol" },
      { name: "ประวัติการตรวจ", icon: History, href: "/qualitycontrol/HisCheck/HisCheckPage" },
      { name: "ออกจากระบบ", icon: LogOut, href: "/logout" },
    ],
  },
];

const SidebarQC = () => <AppSidebar title="DelayHUB" subtitle="ตรวจสอบคุณภาพ" sections={SECTIONS} />;

export default SidebarQC;
