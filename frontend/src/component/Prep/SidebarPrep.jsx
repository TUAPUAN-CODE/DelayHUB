import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, CheckCircle, AlertCircle, X } from "lucide-react";
import { GoHomeFill } from "react-icons/go";
import { LuScanBarcode } from "react-icons/lu";
import { PiFishSimple } from "react-icons/pi";
import { PiFishLight } from "react-icons/pi";
import { VscHistory } from "react-icons/vsc";
import { TbLogout2 } from "react-icons/tb";
import { PiFishFill } from "react-icons/pi";
import { FaPeopleCarry } from 'react-icons/fa';
import axios from "axios";
axios.defaults.withCredentials = true;

const API_URL = import.meta.env.VITE_API_URL;

const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === "success" ? "bg-green-100" : type === "info" ? "bg-blue-100" : "bg-red-100";
  const textColor = type === "success" ? "text-green-800" : type === "info" ? "text-blue-800" : "text-red-800";
  const borderColor = type === "success" ? "border-green-400" : type === "info" ? "border-blue-400" : "border-red-400";
  const IconComponent = type === "success" ? CheckCircle : AlertCircle;

  return (
    <div className={`fixed top-4 right-4 z-50 max-w-md ${bgColor} ${textColor} ${borderColor} border px-4 py-3 rounded shadow-md flex items-center`}>
      <IconComponent size={20} className="mr-2" />
      <div className="flex-grow">{message}</div>
      <button onClick={onClose} className="ml-4">
        <X size={16} />
      </button>
    </div>
  );
};

const useRawMatFetcher = () => {
  const isFetchingRef = useRef(false);

  const allLineIds = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
    31, 32, 33, 34, 35, 36, 37, 38, 39, 40,
    41, 42, 44, 45, 46, 47, 48, 49, 50,
    51, 52, 53, 54, 55
  ];

  const fetchAllData = async (onSuccess, onError) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const CONCURRENT_LIMIT = 5;
      const results = [];

      for (let i = 0; i < allLineIds.length; i += CONCURRENT_LIMIT) {
        const chunk = allLineIds.slice(i, i + CONCURRENT_LIMIT);
        const chunkPromises = chunk.map((lineId) =>
          axios
            .get(`${API_URL}/api/auto-fetch/pack/main/fetchRawMat/${lineId}`)
            .then((res) => (res.data.success ? res.data.data : []))
            .catch(() => [])
        );
        const chunkResults = await Promise.all(chunkPromises);
        results.push(...chunkResults.flat());
        await new Promise((r) => setTimeout(r, 200));
      }

      if (onSuccess) onSuccess(results.length);
    } catch (error) {
      if (onError) onError(error);
    } finally {
      isFetchingRef.current = false;
    }
  };

  return { fetchAllData };
};

const MenuItem = ({
  item,
  isSidebarOpen,
  active,
  hovered,
  onClick,
  onMouseEnter,
  onMouseLeave,
}) => {
  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      className="relative flex flex-col cursor-pointer"
    >
      <div
        style={{
          background: active || hovered
            ? "#f9f9f9"
            : "linear-gradient(to right, #4aaaec 0%, #2288d1 100%)",
        }}
      >
        <div
          style={{
            height: "10px",
            borderBottomRightRadius: "20px",
            background: "linear-gradient(to right, #4aaaec 0%, #2288d1 100%)",
          }}
        />
      </div>

      <div
        className="flex items-center p-3 text-xs font-normal"
        style={{
          backgroundColor: active || hovered ? "#fff" : "transparent",
          color: active || hovered ? "#4aaaec" : "#fff",
        }}
      >
        {item.icon && <item.icon size={18} style={{ width: "36px" }} />}
        {isSidebarOpen && <span className="ml-2 whitespace-nowrap">{item.name}</span>}
      </div>

      <div
        style={{
          background: active || hovered
            ? "#f9f9f9"
            : "linear-gradient(to right, #4aaaec 0%, #2288d1 100%)",
        }}
      >
        <div
          style={{
            height: "10px",
            borderTopRightRadius: "20px",
            background: "linear-gradient(to right, #4aaaec 0%, #2288d1 100%)",
          }}
        />
      </div>
    </div>
  );
};

const Sidebar = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const location = useLocation();
  const activeItem = location.pathname;
  const [hoveredItem, setHoveredItem] = useState(null);
  const [clickedItem, setClickedItem] = useState(localStorage.getItem("clickedItem") || null);
  const [expandedMenus, setExpandedMenus] = useState({});
  const { fetchAllData } = useRawMatFetcher();
  const sidebarRef = useRef(null);
  const lastScrollPosition = useRef(0);
  const [toast, setToast] = useState(null);

  const showToast = (message, type) => setToast({ message, type });
  const hideToast = () => setToast(null);

  useEffect(() => {
    const savedScrollPosition = localStorage.getItem("sidebarScrollPosition");
    if (savedScrollPosition && sidebarRef.current) {
      sidebarRef.current.scrollTop = parseInt(savedScrollPosition, 10);
      lastScrollPosition.current = parseInt(savedScrollPosition, 10);
    }
  }, []);

  const handleScroll = (e) => {
    const scrollPosition = e.target.scrollTop;
    lastScrollPosition.current = scrollPosition;
    localStorage.setItem("sidebarScrollPosition", scrollPosition.toString());
  };

  const handleRefresh = () => {
    showToast("กำลังรีเฟรชข้อมูลรถเข็น...", "info");
    fetchAllData(
      (count) => showToast(`รีเฟรชข้อมูลสำเร็จ!`, "success"),
      (error) => showToast(`รีเฟรชข้อมูลล้มเหลว: ${error.message}`, "error")
    );
  };

  const pos_id = localStorage.getItem("pos_id");
  const allowedPositions = ["3", "4", "5", "6"];
  const showWorkplaceSelector = allowedPositions.includes(pos_id);

  // ✅ ตรวจสอบ rm_type_id จาก localStorage
  // ซ่อน "Scan SAP" เมื่อ rm_type_id มีค่า 2 หรือ 3 อยู่ใน array
  const rmTypeIds = JSON.parse(localStorage.getItem("rm_type_id") || "[]");
  const showScanSAP = !rmTypeIds.some((id) => id === 998 || id === 999);

  const SIDEBAR_ITEMS = [
    { name: "หน้าหลัก", icon: GoHomeFill, href: "/prep" },
    { name: "หน้าห้องเย็น", icon: PiFishFill, href: "/prep/ColdCheck" },
    { name: "Time Stamp น้ำต้มไก่", icon: PiFishFill, href: "/prep/timestamp" },
  
    { name: "1) บันทึกเวลารับวัตถุดิบ", href: "/prep/managepreps" },
    { name: "2) บันทึกเวลาต้มอบเสร็จ", href: "/prep/manageprep" },
    { name: "3) บันทึกเวลาส่งคืนวัตถุดิบ",  href: "/prep/pd/checkout" },
   
   
    // ✅ แสดงเฉพาะเมื่อ rm_type_id ไม่มีค่า 2 หรือ 3
    ...(showScanSAP
      ? [{ name: "Scan SAP", icon: LuScanBarcode, href: "/prep/ScanSAP/ScanSAPPage" }]
      : []),

    { name: "ผสมวัตถุดิบ", icon: PiFishSimple, href: "/prep/Emulsions" },
    { name: "ผสม Batch", icon: PiFishSimple, href: "/prep/BatchMIX" },
    { name: "ผสมเตรียม", icon: PiFishSimple, href: "/prep/IncludeRawmat" },
    { name: "จัดการวัตถุดิบ", icon: PiFishSimple, href: "/prep/MatManage/MatManagePage" },
    { name: "วัตถุดิบรอแก้ไข", icon: PiFishLight, href: "/prep/MatRework/MatReworkPage" },
    { name: "กลับมาเตรียม", icon: PiFishFill, href: "/prep/MatImport/MatImportPage" },
    { name: "ผสมวัตถุดิบ loaf สุก", icon: PiFishFill, href: "/prep/IncludeRawmatPageotherplant" },
    { name: "รายการผสมวัตถุดิบ", icon: PiFishFill, href: "/prep/RM_EMU" },
    { name: "รายการ", icon: PiFishFill, href: "/prep/RMInclude" },
    { name: "ตรวจสอบ HU", icon: PiFishFill, href: "/prep/TraceBack_HU" },
    { name: "ประวัติ", icon: PiFishFill, href: "/prep/history" },
    { name: "ออกจากระบบ", icon: TbLogout2, href: "/logout" },
  ];

  const handleClick = (href, itemName) => {
    const clickedMenuItem = SIDEBAR_ITEMS.find((item) => item.name === itemName);

    if (clickedMenuItem?.type === "action" && clickedMenuItem?.action) {
      clickedMenuItem.action();
      return;
    }

    setClickedItem(href);
    localStorage.setItem("clickedItem", href);
    setExpandedMenus({});

    if (clickedMenuItem?.submenu) {
      setExpandedMenus((prev) => ({ ...prev, [itemName]: !prev[itemName] }));
    }
  };

  const toggleSubmenu = (name) => {
    setExpandedMenus((prev) => {
      const newExpandedMenus = { ...prev };
      Object.keys(newExpandedMenus).forEach((key) => {
        if (key !== name) newExpandedMenus[key] = false;
      });
      newExpandedMenus[name] = !newExpandedMenus[name];
      return newExpandedMenus;
    });
  };

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      <div
        className={`relative z-10 flex-shrink-0 ${isSidebarOpen ? "w-35" : "w-16"}`}
        style={{
          transition: "width 0.2s ease-in-out",
          backgroundColor: "#fff",
          width: isSidebarOpen ? "159px" : "60px",
          height: "100vh",
        }}
      >
        <style>
          {`
            .sidebar-nav::-webkit-scrollbar { display: none; }
            .sidebar-nav { -ms-overflow-style: none; scrollbar-width: none; }
          `}
        </style>
        <div
          className="h-full flex flex-col"
          style={{
            background: "linear-gradient(to right, #4aaaec 0%, #2288d1 100%)",
            color: "#fff",
          }}
        >
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1 rounded-full text-white transition-colors max-w-fit sticky top-0 z-20"
            style={{
              color: "#E0F2FE",
              borderRadius: "8px",
              marginLeft: "17px",
              marginTop: "20px",
            }}
          >
            <Menu size={20} />
          </button>

          <nav
            ref={sidebarRef}
            onScroll={handleScroll}
            className="mt-4 flex-grow overflow-y-auto sidebar-nav"
            style={{ maxHeight: "calc(100vh - 60px)" }}
          >
            {SIDEBAR_ITEMS.map((item) => (
              <div key={item.name}>
                <Link to={item.href !== "#" ? item.href : "#"}>
                  <MenuItem
                    item={item}
                    isSidebarOpen={isSidebarOpen}
                    active={activeItem === item.href || clickedItem === item.href}
                    hovered={hoveredItem === item.name}
                    onClick={(e) => {
                      if (item.submenu) {
                        e.preventDefault();
                        toggleSubmenu(item.name);
                      } else {
                        handleClick(item.href, item.name);
                      }
                    }}
                    onMouseEnter={() => setHoveredItem(item.name)}
                    onMouseLeave={() => setHoveredItem(null)}
                  />
                </Link>

                {item.submenu && expandedMenus[item.name] && (
                  <div className={`flex flex-col ${isSidebarOpen ? "ml-0" : "items-center"}`}>
                    {item.submenu.map((subitem) => (
                      <Link key={subitem.href} to={subitem.href}>
                        <MenuItem
                          item={{
                            ...subitem,
                            icon: isSidebarOpen ? subitem.icon : item.icon,
                          }}
                          isSidebarOpen={isSidebarOpen}
                          active={activeItem === subitem.href || clickedItem === subitem.href}
                          hovered={hoveredItem === subitem.name}
                          onClick={() => handleClick(subitem.href, item.name)}
                          onMouseEnter={() => setHoveredItem(subitem.name)}
                          onMouseLeave={() => setHoveredItem(null)}
                        />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>
      </div>
    </>
  );
};

export default Sidebar;