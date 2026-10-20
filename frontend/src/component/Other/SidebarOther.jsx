import { useMemo } from "react";
import { Timer, Soup, LogOut, History } from "lucide-react";
import { Search as MappingSearchIcon } from "lucide-react";
import AppSidebar from "../Layout/AppSidebar";

const SidebarOther = () => {
  const sections = useMemo(() => [
    {
      items: [
        { name: "คุม Delay", icon: Timer, href: "/other/delay" },
        { name: "ประวัติ Delay (History)", icon: History, href: "/other/history" },
        { name: "น้ำต้มไก่", icon: Soup, href: "/other/timestamp" },
        { name: "ค้นหา mapping_id", icon: MappingSearchIcon, href: "/other/Mapping" }, { name: "ออกจากระบบ", icon: LogOut, href: "/logout" },
      ],
    },
  ], []);
  return <AppSidebar title="DelayHUB" subtitle="Other" sections={sections} />;
};

export default SidebarOther;
