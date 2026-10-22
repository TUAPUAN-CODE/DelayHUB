import { useMemo } from "react";
import { Fish, Rows3, ShoppingCart, Users, ScanEye, Timer, LogOut, Route as RouteIcon } from "lucide-react";
import AppSidebar from "../Layout/AppSidebar";

const SidebarSup = () => {
  const posId = parseInt(localStorage.getItem("pos_id"), 10);
  const canManageTrolley = [4, 6].includes(posId);   // "จัดการรถเข็น" and "เพิ่ม Line Type/Line name" are for pos 4 and 6 only

  const sections = useMemo(() => [
    {
      items: [
        {
          name: "วัตถุดิบ", icon: Fish,
          submenu: [
            { name: "ตารางวัตถุดิบ", href: "/sup/Rawmat" },
            { name: "ตารางประเภทวัตถุดิบ", href: "/sup/RawmatType" },
            { name: "ตารางกลุ่มเวลาวัตถุดิบ", href: "/sup/RawmatGroup" },
            { name: "ตารางการแปรรูป", href: "/sup/Processing" },
            // Production (Code) is bound to every Mat automatically, so the old "ตารางการผลิตวัตถุดิบ" (ProdRawmat) page is gone
            { name: "ตารางแผนการผลิต", href: "/sup/Production" },
          ],
        },
        ...(canManageTrolley ? [{
          name: "Line", icon: Rows3,
          submenu: [
            { name: "เพิ่ม Line Type", href: "/sup/AddLine" },
            { name: "เพิ่ม Line Name", href: "/sup/AddLineName" },
          ],
        }] : []),
        ...(canManageTrolley ? [{
          name: "รถเข็น", icon: ShoppingCart,
          submenu: [
            { name: "จัดการรถเข็น", href: "/sup/CartMange" },
            { name: "เคลียร์รถเข็น", href: "/sup/TrackTrolley" },
          ],
        }] : []),
        { name: "พนักงาน", icon: Users, href: "/sup/TableUserPage" },
        { name: "Metal Detector", icon: ScanEye, href: "/sup/MDmanage" },
        { name: "Report", icon: Timer, href: "/sup/Report" },
        { name: "Traceback", icon: RouteIcon, href: "/sup/Traceback" },
        { name: "ออกจากระบบ", icon: LogOut, href: "/logout" },
      ],
    },
  ], [canManageTrolley]);

  return <AppSidebar title="DelayHUB" subtitle="Supervisor" sections={sections} />;
};

export default SidebarSup;
