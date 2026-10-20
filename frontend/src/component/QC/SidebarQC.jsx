import { History, LogOut, Table2, CheckCircle2 } from "lucide-react";
import { Search as MappingSearchIcon } from "lucide-react";
import AppSidebar from "../Layout/AppSidebar";

const SECTIONS = [
  {
    items: [
      { name: "กำลังดำเนินการ", icon: Table2, href: "/qualitycontrol/Sheet" },
      { name: "ดำเนินการเสร็จสิ้น", icon: CheckCircle2, href: "/qualitycontrol/Sheet?view=done" },
      { name: "ประวัติการตรวจ", icon: History, href: "/qualitycontrol/HisCheck/HisCheckPage" },
      { name: "ค้นหา mapping_id", icon: MappingSearchIcon, href: "/qualitycontrol/Mapping" }, { name: "ออกจากระบบ", icon: LogOut, href: "/logout" },
    ],
  },
];

const SidebarQC = () => <AppSidebar title="DelayHUB" subtitle="ตรวจสอบคุณภาพ" sections={SECTIONS} />;

export default SidebarQC;
