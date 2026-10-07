import { ScanLine, Home, Fish, LogOut } from "lucide-react";
import AppSidebar from "../Layout/AppSidebar";

const SECTIONS = [
  {
    items: [
      { name: "หน้าหลัก", icon: Home, href: "/oven" },
      { name: "วัตถุดิบจากห้องเย็น", icon: ScanLine, href: "/oven/manageOven" },
      { name: "Scan SAP", icon: ScanLine, href: "/oven/products" },
      { name: "วัตถุดิบฝากห้องเย็น", icon: Fish, href: "/oven/sales" },
      { name: "ออกจากระบบ", icon: LogOut, href: "/logout" },
    ],
  },
];

const SidebarOven = () => <AppSidebar title="DelayHUB" subtitle="ต้ม / อบ" sections={SECTIONS} />;

export default SidebarOven;
