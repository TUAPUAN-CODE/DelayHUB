import { useEffect, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { SLIP_PRINTER_ENABLE_KEY } from "../../../../services/localStorageUtil";
import { slipHtml, sendSlipHtml } from "../../../../services/slipPrint";

const API_URL = import.meta.env.VITE_API_URL;

// Print Agent อยู่เครื่องเดียวกับ API server เสมอ (รันผ่าน ecosystem.config.js เดียวกัน)
// แก้ host 'localhost/127.0.0.1' -> host ของ API เพื่อให้เปิดเว็บจากเครื่องอื่นแล้วไปหา server ได้ถูก
const AGENT_PORT = 9100;
export const DEFAULT_PRINT_AGENT_URL = (() => {
  try {
    const u = new URL(API_URL);
    return `${u.protocol}//${u.hostname}:${AGENT_PORT}`;
  } catch {
    return `http://localhost:${AGENT_PORT}`;
  }
})();

export const resolveAgentUrl = (configured) => {
  try {
    const u = new URL(configured || DEFAULT_PRINT_AGENT_URL);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "0.0.0.0") {
      u.hostname = new URL(DEFAULT_PRINT_AGENT_URL).hostname;
    }
    return u.toString().replace(/\/$/, "");
  } catch {
    return DEFAULT_PRINT_AGENT_URL;
  }
};

// ============================================
// สวิตช์ "เบราว์เซอร์นี้เป็นเครื่องพิมพ์สลิป" (เก็บใน localStorage ของเบราว์เซอร์นั้น)
// ============================================
const ENABLE_KEY = SLIP_PRINTER_ENABLE_KEY;
const LEADER_KEY = "pfcm_rfid_slip_printer_leader";
const CHANGE_EVENT = "pfcm-rfid-slip-printer-changed";
export const SLIP_PRINT_STATUS_EVENT = "pfcm-rfid-slip-print-status";

const LEADER_HEARTBEAT_MS = 2000;
const LEADER_STALE_MS = 6000;
const CONFIG_REFRESH_MS = 5 * 60 * 1000;

export const isSlipPrinterEnabled = () => {
  try {
    return localStorage.getItem(ENABLE_KEY) === "1";
  } catch {
    return false;
  }
};

export const setSlipPrinterEnabled = (enabled) => {
  try {
    if (enabled) localStorage.setItem(ENABLE_KEY, "1");
    else localStorage.removeItem(ENABLE_KEY);
  } catch (err) {
    console.error("บันทึกสวิตช์พิมพ์สลิปไม่สำเร็จ:", err);
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
};

export const useSlipPrinterEnabled = () => {
  const [enabled, setEnabled] = useState(isSlipPrinterEnabled);
  useEffect(() => {
    const sync = () => setEnabled(isSlipPrinterEnabled());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return enabled;
};

const emitStatus = (detail) => {
  window.dispatchEvent(new CustomEvent(SLIP_PRINT_STATUS_EVENT, { detail }));
};

// รวมแถวข้อมูล (1 แถว = 1 mapping_id) ของรถเข็นแบบปกติ + แบบผสม ให้เป็น 1 รายการต่อ tro_id
// โดยใส่วัตถุดิบทุกตัวบนรถไว้ใน materials[] (print-agent พิมพ์ทุกตัวลงสลิปใบเดียว และย่อขนาดตามจำนวน)
// — เหมือนที่หน้า CheckOut (Table.jsx) จัดกลุ่มตาม tro_id ก่อนส่งไปพิมพ์
export const indexByTrolley = (regular, mixed) => {
  const rows = [
    ...(regular || []).map((i) => ({ ...i, rawMatType: "regular" })),
    ...(mixed || []).map((i) => ({ ...i, rawMatType: "mixed" })),
  ];
  const map = new Map();
  rows.forEach((item) => {
    const key = String(item.tro_id);
    if (!map.has(key)) map.set(key, { ...item, materials: [] });
    const group = map.get(key);
    if (group.materials.some((m) => m.mapping_id === item.mapping_id)) return;
    // the whole row goes into the slip (QC / remark / date fields too): the slip is the same component as the one after a check-out on screen
    const mixed = item.rawMatType === "mixed";
    group.materials.push({
      ...item,
      material_code: mixed ? item.mix_code : item.mat,
      materialName: mixed ? `Mixed: ${item.mix_code}` : item.mat_name,
      levelEu: item.level_eu,
    });
  });
  return map;
};

// The slip is rendered off screen by the SAME PrintModal that is shown after a check-out on screen (headless mode), then its HTML goes to the Print Agent
// (/print-html) — so the slip of an RFID scan has the same design, fields and layout as every other check-out slip. Rejects after 25 s.
export const renderSlipHtml = async (trolleyData) => {
  const [{ createRoot }, { ThemeProvider }, themeModule, modalModule] = await Promise.all([
    import("react-dom/client"),
    import("@mui/material/styles"),
    import("../../../../theme/dochubTheme"),
    import("../../RoomTableSupervisor/Asset/checkout/PrintModal"),
  ]);
  const PrintModal = modalModule.default;
  const theme = themeModule.default;
  const first = trolleyData.materials?.[0] || {};
  const data = { ...trolleyData, material_code: first.material_code, materialName: first.materialName, level_eu: trolleyData.level_eu ?? first.levelEu };
  return new Promise((resolve, reject) => {
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "position:fixed;left:-10000px;top:0;width:520px;visibility:hidden;pointer-events:none;";
    document.body.appendChild(host);
    const root = createRoot(host);
    let timer = 0;
    const cleanup = () => {
      clearTimeout(timer);
      try { root.unmount(); } catch { /* already gone */ }
      host.remove();
    };
    timer = setTimeout(() => { cleanup(); reject(new Error("สร้างสลิปไม่ทันเวลา")); }, 25000);
    const onReady = (el) => {
      try { const html = slipHtml(el); cleanup(); resolve(html); } catch (err) { cleanup(); reject(err); }
    };
    root.render(
      <ThemeProvider theme={theme}>
        <PrintModal headless open data={data} onClose={() => {}} onReady={onReady} />
      </ThemeProvider>
    );
  });
};

// ============================================
// Service: ทำงานเบื้องหลังทุกหน้า (mount ใน App.jsx) — ไม่แสดงผลอะไร
// สั่งพิมพ์สลิปเมื่อ reader สแกนรถเข็น โดยไม่ต้องเปิดหน้า RFIDCSCheckOutPage ค้างไว้
// ============================================
const RFIDSlipPrintService = () => {
  useEffect(() => {
    let cleanup = null;

    const start = () => {
      if (cleanup || !API_URL || !isSlipPrinterEnabled()) return;

      const tabId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      let isLeader = false;
      let readerConfigs = [];
      // เก็บ snapshot ล่าสุดของรถเข็นแต่ละคัน ไม่ทิ้งตอน refresh — เพราะตอนออกห้องเย็น
      // backend เอารถออกจาก slot ก่อน ข้อมูลสดจะหาไม่เจอแล้ว (ดู comment ใน print-agent/server.js)
      const trolleyCache = new Map();
      const printing = new Set();

      // เลือก tab เดียวต่อเบราว์เซอร์เป็นคนพิมพ์ (กันเปิดหลายแท็บแล้วพิมพ์ซ้ำ)
      const heartbeat = () => {
        try {
          const now = Date.now();
          const cur = JSON.parse(localStorage.getItem(LEADER_KEY) || "null");
          if (!cur || cur.id === tabId || now - cur.ts > LEADER_STALE_MS) {
            localStorage.setItem(LEADER_KEY, JSON.stringify({ id: tabId, ts: now }));
            isLeader = true;
          } else {
            isLeader = false;
          }
        } catch {
          isLeader = true;
        }
      };
      heartbeat();
      const heartbeatTimer = setInterval(heartbeat, LEADER_HEARTBEAT_MS);

      const fetchConfigs = async () => {
        try {
          const res = await axios.get(`${API_URL}/api/coldstorage/rfid/config`);
          if (res.data.success) readerConfigs = res.data.data;
        } catch (err) {
          console.error("RFIDSlipPrintService: ดึง reader config ไม่สำเร็จ:", err.message);
        }
      };

      const fetchTrolleys = async () => {
        try {
          const [reg, mix] = await Promise.all([
            axios.get(`${API_URL}/api/coldstorage/export/fetchSlotRawMat`),
            axios.get(`${API_URL}/api/coldstorage/mix/export/fetchSlotRawMat`),
          ]);
          const fresh = indexByTrolley(
            reg.data.success ? reg.data.data : [],
            mix.data.success ? mix.data.data : []
          );
          fresh.forEach((v, k) => trolleyCache.set(k, v));
        } catch (err) {
          console.error("RFIDSlipPrintService: ดึงข้อมูลรถเข็นไม่สำเร็จ:", err.message);
        }
      };

      fetchConfigs();
      fetchTrolleys();
      const configTimer = setInterval(fetchConfigs, CONFIG_REFRESH_MS);

      const socket = io(API_URL, {
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      socket.on("ping", () => socket.emit("pong"));
      socket.on("connect", () => {
        fetchConfigs();
        fetchTrolleys();
      });
      socket.on("connect_error", (err) => {
        console.error("RFIDSlipPrintService socket error:", err.message);
      });
      // server (idle timeout 20 นาที) ตัดการเชื่อมต่อเอง → socket.io จะไม่ต่อกลับให้อัตโนมัติ ต้องสั่งเอง
      socket.on("disconnect", (reason) => {
        console.warn("RFIDSlipPrintService socket disconnected:", reason);
        if (reason === "io server disconnect") socket.connect();
      });

      // ข้อมูลเปลี่ยน → อัปเดต snapshot (ไม่ลบรถที่หายไป)
      socket.on("dataUpdated", fetchTrolleys);

      socket.on("readerScanUpdate", async (payload) => {
        const { readerId, tro_id } = payload || {};
        if (!readerId || !tro_id || !isLeader) return;

        // รหัสประจำการสแกนครั้งนี้ (RFIDc1.js ส่ง scanId มาให้) — ห้ามใช้ updatedAt เพราะ server สร้างใหม่ทุกครั้งที่ส่ง event
        // ทำให้ไม่เคยซ้ำ กันพิมพ์ซ้ำไม่ได้เลย; ถ้า RFIDc1.js ยังเป็นรุ่นเก่า (ไม่มี scanId) ใช้ reader+รถเข็น+นาทีเดียวกันแทน
        // (reader มีดีเลย์กันสแกนซ้ำ ≥ 1 นาทีอยู่แล้ว จึงไม่ชนกับการสแกนจริงครั้งถัดไป)
        const dedupeKey = payload.scanId || `${readerId}:${tro_id}:${Math.floor(Date.now() / 60000)}`;
        if (printing.has(dedupeKey)) return;
        printing.add(dedupeKey);

        // หลายเบราว์เซอร์/หลายเครื่องอาจเปิดสวิตช์พิมพ์พร้อมกัน → ให้ server เลือกตัวเดียวที่ได้พิมพ์ (กันสลิปออกซ้ำหลายใบ)
        try {
          const claim = await axios.post(`${API_URL}/api/coldstorage/rfid/print-claim`, { scanId: dedupeKey, claimedBy: tabId });
          if (claim.data && claim.data.claimed === false) {
            setTimeout(() => printing.delete(dedupeKey), 30000);
            return; // เครื่องอื่นพิมพ์ไปแล้ว
          }
        } catch (err) {
          // จองไม่ได้ (เช่น ยังไม่ได้รัน migration) → พิมพ์ต่อดีกว่าสลิปหาย
          console.warn("RFIDSlipPrintService: จองสิทธิ์พิมพ์ไม่ได้ พิมพ์ต่อ:", err.message);
        }

        const readerConfig = readerConfigs.find((c) => c.reader_no === readerId);
        const printAgentUrl = resolveAgentUrl(readerConfig?.printer_agent_url);
        const trolleyData = trolleyCache.get(String(tro_id));
        if (!trolleyData) {
          console.warn(`⚠️ RFIDSlipPrintService: ไม่พบ tro_id=${tro_id} ใน cache`);
        }

        emitStatus({ readerId, status: "printing" });
        try {
          // 1) the same slip as on screen → /print-html (same printer settings of the reader)
          if (trolleyData) {
            try {
              const html = await renderSlipHtml(trolleyData);
              const err = await sendSlipHtml(html, tro_id, {
                agentUrl: printAgentUrl,
                printerHost: readerConfig?.printer_host,
                printerShare: readerConfig?.printer_share,
                printerDotWidth: readerConfig?.printer_dot_width,
              });
              if (err) throw new Error(err);
              emitStatus({ readerId, status: "done" });
              return;
            } catch (renderErr) {
              // the slip still has to come out: fall back to the Print Agent's own (older) layout
              console.warn("RFIDSlipPrintService: พิมพ์สลิปแบบเดียวกับหน้าเว็บไม่สำเร็จ ใช้แบบสำรอง:", renderErr.message);
            }
          }
          // 2) fallback: the Print Agent builds its own slip
          const res = await fetch(`${printAgentUrl}/print-slip`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              identifier: tro_id,
              trolleyData,
              printerHost: readerConfig?.printer_host || undefined,
              printerShare: readerConfig?.printer_share || undefined,
              printerDotWidth: readerConfig?.printer_dot_width || undefined,
            }),
          });
          const result = await res.json();
          if (!result.ok) throw new Error(result.error || "พิมพ์ไม่สำเร็จ");
          emitStatus({ readerId, status: "done" });
        } catch (err) {
          console.error("พิมพ์สลิปไม่สำเร็จ:", err);
          emitStatus({
            readerId,
            status: "error",
            error: String(err.message).includes("fetch")
              ? `เชื่อมต่อ Print Agent (${printAgentUrl}) ไม่ได้`
              : err.message,
          });
        } finally {
          setTimeout(() => printing.delete(dedupeKey), 30000);
        }
      });

      cleanup = () => {
        clearInterval(heartbeatTimer);
        clearInterval(configTimer);
        socket.off();
        socket.disconnect();
        try {
          const cur = JSON.parse(localStorage.getItem(LEADER_KEY) || "null");
          if (cur?.id === tabId) localStorage.removeItem(LEADER_KEY);
        } catch {
          /* ignore */
        }
        cleanup = null;
      };
    };

    const sync = () => {
      if (isSlipPrinterEnabled()) start();
      else if (cleanup) cleanup();
    };

    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
      if (cleanup) cleanup();
    };
  }, []);

  return null;
};

export default RFIDSlipPrintService;
