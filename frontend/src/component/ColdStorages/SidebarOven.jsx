import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, CheckCircle, AlertCircle, X } from "lucide-react";
import { GoHomeFill } from "react-icons/go";
import { LuScanBarcode } from "react-icons/lu";
import { PiFishLight } from "react-icons/pi";
import { VscHistory } from "react-icons/vsc";
import { TbLogout2 } from "react-icons/tb";
import { FaPeopleCarry } from 'react-icons/fa';
import { PiFishSimple } from "react-icons/pi";
import { PiFishSimpleFill } from "react-icons/pi";
import { RiArrowDownBoxLine } from "react-icons/ri";
import { RiArrowUpBoxLine } from "react-icons/ri";
import { PiThermometerColdThin } from "react-icons/pi";
import { PiThermometerColdBold } from "react-icons/pi";
import { BsFillCartXFill } from "react-icons/bs";
import { IoMove } from "react-icons/io5";

import axios from "axios";
axios.defaults.withCredentials = true;

const API_URL = import.meta.env.VITE_API_URL;

// คอมโพเนนต์ Toast
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

// Custom Hook สำหรับดึงข้อมูลวัตถุดิบ
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
    console.log("🚀 กำลังดึงรีเฟรชข้อมูลรถเข็น...");

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

      console.log("✅ รีเฟรชข้อมูลรถเข็นสำเร็จ:", results.length);
      if (onSuccess) onSuccess(results.length);
    } catch (error) {
      console.error("❌ รีเฟรชข้อมูลรถเข็นล้มเหลว:", error);
      if (onError) onError(error);
    } finally {
      isFetchingRef.current = false;
    }
  };

  return { fetchAllData };
};

const pos_id = localStorage.getItem("pos_id");
const allowedPositions = ["3", "4", "5", "6"];
const showWorkplaceSelector = allowedPositions.includes(pos_id);

// ─── SIDEBAR_SECTIONS (ไม่เปลี่ยน) ───────────────────────────────────────────
const SIDEBAR_SECTIONS = [
  {
    label: "RM ไม่แปรรูป",
    color: "#0d47a1",
    items: [
      { name: "0) วัตถุดิบแปรรูป",        href: "/coldStorages/table/rm" },
      { name: "1) รับเข้าไม่แปรรูป",  href: "/ColdStorages/Checkin/rm/in/line/not/inprocess" },
      { name: "2) เริ่มละลาย",         href: "/ColdStorages/ScanSAPPage/defrost" },
      { name: "3) ละลายเสร็จ",         href: "/ColdStorages/ScanSAPPageEDF/end/defrost" },
      { name: "4) จ่ายลงไลน์",         href: "/ColdStorages/products" },
      { name: "5) Monitor",         href: "/ColdStorages/RoomTableCS" },
      // { name: "Dashboard",      href: "/ColdStorages/dashboardrmoutprocess" },

    ],
  },
  {
    label: "RM แปรรูป",
    color: "#1b5e20",
    items: [
      // { name: "0) วัตถุดิบรับฝาก",      href: "/coldStorages/RoomTable/RoomTable" },
      { name: "0) Monitor",      href: "/coldStorages/RoomTable/RoomTable/send" },
      { name: "1) รับเข้า RM แปรรูป",     href: "/ColdStorages/CheckIn/rooms" },
      { name: "2) ส่งออก RM แปรรูป",      href: "/coldStorages/CheckOut/CheckOutPage" },
      // { name: "Dashboard",         href: "/ColdStorages/dashboardrminprocess" },

    ],
  },
  {
    label: null,
    color: null,
    items: [
      { name: "ออกจากระบบ", icon: TbLogout2, href: "/logout" },
    ],
  },
];

// ─── MenuItem ─────────────────────────────────────────────────────────────────
const MenuItem = ({ item, isSidebarOpen, active, hovered, onClick, onMouseEnter, onMouseLeave, accentColor }) => {
  const accent = accentColor || "#0d47a1";
  const isActive = active || hovered;

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "7px 10px",
        borderRadius: "8px",
        cursor: "pointer",
        backgroundColor: isActive ? accent : "transparent",
        color: isActive ? "#fff" : "#444",
        fontWeight: isActive ? 600 : 400,
        fontSize: "12px",
        transition: "all 0.15s ease",
        whiteSpace: "nowrap",
        overflow: "hidden",
        borderLeft: isActive ? `3px solid ${accent}` : "3px solid transparent",
      }}
    >
      {item.icon && <item.icon size={15} style={{ flexShrink: 0 }} />}
      {isSidebarOpen && <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</span>}
    </div>
  );
};

// ─── SidebarOven ──────────────────────────────────────────────────────────────
const SidebarOven = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const location = useLocation();
  const activeItem = location.pathname;
  const [hoveredItem, setHoveredItem] = useState(null);
  const [clickedItem, setClickedItem] = useState(localStorage.getItem("clickedItem") || null);
  const [expandedMenus, setExpandedMenus] = useState({});
  const [toast, setToast] = useState(null);
  const { fetchAllData } = useRawMatFetcher();

  const toggleSubmenu = (name) => {
    setExpandedMenus((prev) => {
      const next = {};
      Object.keys(prev).forEach((k) => { next[k] = false; });
      next[name] = !prev[name];
      return next;
    });
  };

  const showToast = (message, type) => setToast({ message, type });
  const hideToast = () => setToast(null);

  const handleRefresh = () => {
    showToast("กำลังรีเฟรชข้อมูลรถเข็น...", "info");
    fetchAllData(
      () => showToast("รีเฟรชข้อมูลรถเข็นสำเร็จ!", "success"),
      (err) => showToast(`รีเฟรชล้มเหลว: ${err.message}`, "error")
    );
  };

  const handleClick = (href, item) => {
    if (item?.type === "action") {
      if (item.href === "#refresh") handleRefresh();
      return;
    }
    if (!item?.submenu) {
      setClickedItem(href);
      localStorage.setItem("clickedItem", href);
    }
  };

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      <div
        style={{
          width: isSidebarOpen ? "180px" : "52px",
          flexShrink: 0,
          transition: "width 0.2s ease",
          backgroundColor: "#ffffff",
          borderRight: "1px solid #e0e0e0",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          zIndex: 10,
        }}
      >
        {/* Toggle */}
        <div style={{ padding: "14px 12px 8px", borderBottom: "1px solid #f0f0f0" }}>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#555", padding: "4px", borderRadius: "6px",
              display: "flex", alignItems: "center",
            }}
          >
            <Menu size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: "auto", padding: "8px 8px", scrollbarWidth: "none" }}>
          <style>{`nav::-webkit-scrollbar { display: none; }`}</style>

          {SIDEBAR_SECTIONS.map((section, sectionIndex) => (
            <div key={sectionIndex} style={{ marginBottom: "8px" }}>

              {/* Divider ระหว่าง section */}
              {sectionIndex > 0 && (
                <div style={{ height: "1px", backgroundColor: "#e8e8e8", margin: "6px 0 10px" }} />
              )}

              {/* Section Label */}
              {section.label && isSidebarOpen && (
                <div style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  color: "#fff",
                  backgroundColor: section.color,
                  borderRadius: "6px",
                  padding: "3px 8px",
                  marginBottom: "4px",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}>
                  {section.label}
                </div>
              )}

              {/* ไม่มี label แต่ sidebar ปิด → แสดงเส้นแบ่ง */}
              {section.label && !isSidebarOpen && (
                <div style={{
                  width: "28px", height: "3px",
                  backgroundColor: section.color,
                  borderRadius: "4px",
                  margin: "0 auto 4px",
                }} />
              )}

              {/* Items */}
              <div style={{
                backgroundColor: section.color ? `${section.color}10` : "transparent",
                border: section.color ? `1px solid ${section.color}30` : "none",
                borderRadius: "8px",
                padding: "4px",
              }}>
                {section.items.map((item) => (
                  <div key={item.href || item.name} style={{ marginBottom: "2px" }}>
                    {item.type === "action" ? (
                      <MenuItem
                        item={item}
                        isSidebarOpen={isSidebarOpen}
                        active={activeItem === item.href || clickedItem === item.href}
                        hovered={hoveredItem === (item.href || item.name)}
                        accentColor={section.color || "#e53935"}
                        onClick={() => handleClick(item.href, item)}
                        onMouseEnter={() => setHoveredItem(item.href || item.name)}
                        onMouseLeave={() => setHoveredItem(null)}
                      />
                    ) : (
                      <Link to={item.submenu ? "#" : item.href} style={{ textDecoration: "none" }}>
                        <MenuItem
                          item={item}
                          isSidebarOpen={isSidebarOpen}
                          active={activeItem === item.href || clickedItem === item.href}
                          hovered={hoveredItem === (item.href || item.name)}
                          accentColor={section.color || "#0d47a1"}
                          onClick={(e) => {
                            if (item.submenu) { e.preventDefault(); toggleSubmenu(item.name); }
                            else handleClick(item.href, item);
                          }}
                          onMouseEnter={() => setHoveredItem(item.href || item.name)}
                          onMouseLeave={() => setHoveredItem(null)}
                        />
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </>
  );
};

export default SidebarOven;