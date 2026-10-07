import { BarChart2, LogOut } from "lucide-react";
import AppSidebar from "../Layout/AppSidebar";

const SECTIONS = [
  {
    items: [
      { name: "Report", icon: BarChart2, href: "/Master/Report" },
      { name: "ออกจากระบบ", icon: LogOut, href: "/logout" },
    ],
  },
];

const SidebarPack = () => <AppSidebar title="DelayHUB" subtitle="Master" sections={SECTIONS} />;

export default SidebarPack;
