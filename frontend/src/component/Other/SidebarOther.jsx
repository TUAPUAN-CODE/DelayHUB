import { useMemo } from "react";
import { Timer, Soup, LogOut } from "lucide-react";
import AppSidebar from "../Layout/AppSidebar";

const SidebarOther = () => {
  const sections = useMemo(() => [
    {
      items: [
        { name: "คุม Delay", icon: Timer, href: "/other/delay" },
        { name: "น้ำต้มไก่", icon: Soup, href: "/other/timestamp" },
        { name: "ออกจากระบบ", icon: LogOut, href: "/logout" },
      ],
    },
  ], []);
  return <AppSidebar title="DelayHUB" subtitle="Other" sections={sections} />;
};

export default SidebarOther;
