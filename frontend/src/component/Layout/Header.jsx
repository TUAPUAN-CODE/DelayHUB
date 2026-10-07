import { useEffect, useState } from "react";
const API_URL = import.meta.env.VITE_API_URL;

const Header = ({ title }) => {
  const [user, setUser] = useState(null);
  const [position, setPosition] = useState(""); // state สำหรับเก็บ pos_name
  const [workplace, setWorkplace] = useState(""); // state สำหรับเก็บ wp_name
  const [rawmatType, setRawmatType] = useState(""); // state สำหรับเก็บ wp_name

  useEffect(() => {
    // ดึงข้อมูลจาก localStorage
    const userData = {
      name: `${
        localStorage.getItem("first_name") || "ไม่พบรายชื่อ"
      } ${localStorage.getItem("last_name")}`,
      role: `ตำแหน่ง ID: ${
        localStorage.getItem("pos_id") || "Administrator"
      } | จุดทำงาน ID: ${localStorage.getItem("wp_id") || "ไม่พบสถานที่ทำงาน"}`,
    };

    setUser(userData);

    // ดึง pos_id จาก localStorage
    const pos_id = localStorage.getItem("pos_id");

    // ส่ง pos_id ไปที่ API
    if (pos_id) {
      fetch(`${API_URL}/api/header/pos/${pos_id}`, { credentials: "include" })
        .then((response) => response.json())
        .then((data) => {
          if (data.position) {
            setPosition(data.position.pos_name); // นำ pos_name มาใช้
          }
        })
        .catch((error) => console.error("Error fetching position:", error));
    }

    // ดึง wp_id จาก localStorage
    const wp_id = localStorage.getItem("wp_id");

    // ส่ง wp_id ไปที่ API
    if (wp_id) {
      fetch(`${API_URL}/api/header/wp/${wp_id}`, { credentials: "include" })
        .then((response) => response.json())
        .then((data) => {
          if (data.workplace) {
            setWorkplace(data.workplace.wp_name); // นำ wp_name มาใช้
          }
        })
        .catch((error) => console.error("Error fetching workplace:", error));
    }

    // ดึง rm_type_id จาก localStorage
    // const rm_type_id = localStorage.getItem("rm_type_id");

    // if (rm_type_id && rm_type_id !== "1") {
    //   // ตรวจสอบว่าไม่ใช่ rm_type_id = 1
    //   fetch(`${API_URL}/api/rawmat/${rm_type_id}`, { credentials: "include" })
    //     .then((response) => response.json())
    //     .then((data) => {
    //       if (data.rawMaterial) {
    //         // แก้ให้ตรงกับ key ของ API
    //         setRawmatType(data.rawMaterial.rm_type_name); // ตั้งค่า rm_type_name
    //       }
    //     })
    //     .catch((error) => console.error("Error fetching raw material:", error));
    // }
  }, []);

  const initial = (user?.name || "").trim().charAt(0).toUpperCase() || "?";
  return (
    <header
      className="header-container"
      style={{
        backgroundColor: "#fff",
        color: "#1B2333",
        marginTop: 10,
        borderRadius: 14,
        minHeight: 52,
        border: "1px solid #E3E8F2",
        boxShadow: "0 1px 2px rgba(16,24,40,.05), 0 1px 3px rgba(16,24,40,.07)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "6px 14px",
      }}
    >
      {/* Title */}
      <h6
        className="header-title"
        style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: ".1px", display: "flex", alignItems: "center", gap: 10 }}
      >
        <span style={{ width: 4, height: 20, borderRadius: 4, background: "#1552F0", display: "inline-block" }} />
        {title}
      </h6>

      {/* User Card */}
      <div
        className="user-card"
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 10px", borderRadius: 12, background: "#F5F8FF", fontSize: 11, color: "#6B7489" }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #4D7BF5, #1552F0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: 600,
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          {initial}
        </div>
        <div style={{ whiteSpace: "nowrap", lineHeight: 1.3 }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 12, color: "#1B2333" }}>{user?.name || "ไม่พบรายชื่อ"}</p>
          <p style={{ margin: 0 }}>
            {position || "ตำแหน่งไม่พบ"} | {workplace || "จุดทำงานไม่พบ"} {rawmatType || ""}
          </p>
        </div>
      </div>
    </header>
  );
};

export default Header;
