import React, { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import {
  Box,
  Typography,
  CircularProgress,
} from "@mui/material";
import ScanTrolley from "../Asset/ScanTrolley";
import CheckTrolley from "../Asset/CheckTrolley";
import Header from "../../../Layout/Header";
import Buttom from "../../../Layout/Buttom";

const API_URL = import.meta.env.VITE_API_URL;

const ROOM_CONFIG = [
  { cs_id: 10, cs_name: "CSR5-6" },
  { cs_id: 11, cs_name: "CHILL 11" },
  { cs_id: 12, cs_name: "CSR 8" },
  { cs_id: 13, cs_name: "CSR 9" },
  { cs_id: 14, cs_name: "CSR 10" },
  { cs_id: 15, cs_name: "CSR 11" },
  { cs_id: 16, cs_name: "Freeze 5" },
  { cs_id: 17, cs_name: "Freeze 6" },
  { cs_id: 18, cs_name: "CHILL 8" },
  { cs_id: 19, cs_name: "CHILL 9" },
  { cs_id: 20, cs_name: "CHILL 10" },
  { cs_id: 21, cs_name: "CSR 14" },
  { cs_id: 22, cs_name: "AIR LOCK 2A2B" },
  { cs_id: 23, cs_name: "Ante 2B" },
  { cs_id: 24, cs_name: "Ante 2C" },
  { cs_id: 25, cs_name: "CSR 12A" },
  { cs_id: 26, cs_name: "CSR 12B" },
  { cs_id: 27, cs_name: "Freeze 11" },
  { cs_id: 28, cs_name: "Freeze 12" },
  { cs_id: 29, cs_name: "Ante 3A" },
  { cs_id: 30, cs_name: "Ante 3B" },
  { cs_id: 31, cs_name: "TUNA Line" },
  { cs_id: 32, cs_name: "ANTE 2A" },
  { cs_id: 33, cs_name: "CSR 4B" },
  { cs_id: 34, cs_name: "AIR LOCK 3A" },
  { cs_id: 35, cs_name: "Solar rooftop" },
  { cs_id: 36, cs_name: "ห้องเก็บเคมี WH" },
  { cs_id: 37, cs_name: "MDB room RF1" },
  { cs_id: 38, cs_name: "ห้องเก็บผัก" },
  { cs_id: 39, cs_name: "วัตถุดิบฟรีส11/1" },
  { cs_id: 40, cs_name: "วัตถุดิบฟรีส 11/2" },
  { cs_id: 41, cs_name: "วัตถุดิบฟรีส 11/3" },
  { cs_id: 42, cs_name: "วัตถุดิบฟรีส 11/4" },
  { cs_id: 43, cs_name: "วัตถุดิบฟรีส 12/1" },
  { cs_id: 44, cs_name: "วัตถุดิบฟรีส 12/2" },
  { cs_id: 45, cs_name: "วัตถุดิบฟรีส 12/3" },
  { cs_id: 46, cs_name: "วัตถุดิบฟรีส 12/4" },
];

const styles = {
  sectionWrapper: {
    maxWidth: "100%",
    margin: "0",
    padding: "8px 12px",
    width: "100%",
    boxSizing: "border-box",
  },
};

// ─── Room Selector Panel ──────────────────────────────────────────────────────
const RoomSelector = ({ selectedCsId, onSelect }) => {
  return (
    <Box
      sx={{
        background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
        borderRadius: "16px",
        border: "1px solid #e2e8f0",
        padding: "20px",
        mb: 2,
      }}
    >
      <Typography
        sx={{
          fontSize: "11px",
          fontWeight: 700,
          color: "#94a3b8",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          mb: 1.5,
        }}
      >
        เลือกห้องเย็น
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(128px, 1fr))",
          gap: "8px",
        }}
      >
        {ROOM_CONFIG.map((room) => {
          const isActive = selectedCsId === room.cs_id;
          return (
            <Box
              key={room.cs_id}
              onClick={() => onSelect(room.cs_id)}
              sx={{
                padding: "9px 10px",
                borderRadius: "10px",
                border: isActive
                  ? "2px solid #1552F0"
                  : "1.5px solid #e2e8f0",
                background: isActive
                  ? "linear-gradient(135deg, #1552F0 0%, #2563eb 100%)"
                  : "#ffffff",
                color: isActive ? "#ffffff" : "#374151",
                fontSize: "12px",
                fontWeight: isActive ? 700 : 500,
                cursor: "pointer",
                transition: "all 0.18s ease",
                textAlign: "center",
                userSelect: "none",
                boxShadow: isActive
                  ? "0 4px 12px rgba(59,130,246,0.3)"
                  : "0 1px 3px rgba(0,0,0,0.05)",
                lineHeight: 1.3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                "&:hover": {
                  boxShadow: isActive
                    ? "0 6px 16px rgba(59,130,246,0.4)"
                    : "0 3px 10px rgba(0,0,0,0.1)",
                  transform: "translateY(-1px)",
                  borderColor: isActive ? "#1552F0" : "#94a3b8",
                },
              }}
              title={`cs_id: ${room.cs_id} — ${room.cs_name}`}
            >
              <Typography
                sx={{
                  fontSize: "10px",
                  fontWeight: 500,
                  opacity: 0.75,
                  mb: 0.25,
                  color: "inherit",
                  lineHeight: 1,
                }}
              >
                #{room.cs_id}
              </Typography>
              {room.cs_name}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const UniversalColdStoragePage = () => {
  const [selectedCsId, setSelectedCsId] = useState(null);
  const [isScanTrolleyOpen, setIsScanTrolleyOpen] = useState(false);
  const [isCheckTrolleyOpen, setIsCheckTrolleyOpen] = useState(false);
  const [trolleyData, setTrolleyData] = useState(null);
  const [socket, setSocket] = useState(null);

  // ── Socket setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!API_URL) return;

    let isTabActive = true;
    let reconnectTimer = null;
    let reconnectDelay = 2000;
    const MAX_DELAY = 60000;

    const newSocket = io(API_URL, {
      transports: ["websocket"],
      reconnection: false,
      autoConnect: false,
    });

    const manualReconnect = () => {
      if (!newSocket.connected && isTabActive) {
        newSocket.connect();
        reconnectTimer = setTimeout(manualReconnect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, MAX_DELAY);
      }
    };

    const handleVisibilityChange = () => {
      isTabActive = !document.hidden;
      if (isTabActive && !newSocket.connected) manualReconnect();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    if (!document.hidden) newSocket.connect();

    newSocket.on("connect", () => {
      reconnectDelay = 2000;
    });

    newSocket.on("disconnect", () => {
      if (isTabActive) {
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(manualReconnect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, MAX_DELAY);
      }
    });

    newSocket.on("connect_error", () => {
      if (isTabActive) {
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(manualReconnect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, MAX_DELAY);
      }
    });

    setSocket(newSocket);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearTimeout(reconnectTimer);
      newSocket.off("connect");
      newSocket.off("disconnect");
      newSocket.off("connect_error");
      newSocket.disconnect();
    };
  }, []);

  // ✅ เลือกห้องเย็น → เปิด ScanTrolley ทันที
  const handleSelectRoom = (cs_id) => {
    setSelectedCsId(cs_id);
    setIsScanTrolleyOpen(true);
  };

  const closeScanTrolley = () => {
    setIsScanTrolleyOpen(false);
    setSelectedCsId(null); // ✅ reset ห้องด้วยเมื่อปิด
  };
  const handleScanConfirm = (data) => {
    setTrolleyData(data);
    setIsScanTrolleyOpen(false);
    setIsCheckTrolleyOpen(true);
  };

  const closeCheckTrolley = () => {
    setIsCheckTrolleyOpen(false);
    setTrolleyData(null);
  };

  const selectedRoom = ROOM_CONFIG.find((r) => r.cs_id === selectedCsId);

  return (
    <div
      style={{ backgroundColor: "#fff" }}
      className="flex-1 overflow-auto relative z-10"
    >
      {/* Header */}
      <div style={styles.sectionWrapper}>
        <Header title="ระบบจัดการห้องเย็น" />
      </div>

      {/* Room Selector */}
      <div style={styles.sectionWrapper}>
        <RoomSelector
          selectedCsId={selectedCsId}
          onSelect={handleSelectRoom}
        />
      </div>

      {/* Modals */}
      <ScanTrolley
        open={isScanTrolleyOpen}
        onClose={closeScanTrolley}
        selectedCsId={selectedCsId}
        selectedRoomName={selectedRoom?.cs_name}
      // ✅ ไม่ต้อง onNext แล้ว
      />

      <CheckTrolley
        open={isCheckTrolleyOpen}
        onClose={closeCheckTrolley}
        trolleyData={trolleyData}
        selectedCsId={selectedCsId}
      />

      {/* Footer */}
      <div style={styles.sectionWrapper}>
        <Buttom title="Copyright © 2025 i-Tail Corporation Public Company Limited. All right reserved" />
      </div>
    </div>
  );
};

export default UniversalColdStoragePage;