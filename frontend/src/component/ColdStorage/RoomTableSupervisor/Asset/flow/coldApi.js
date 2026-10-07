import axios from "axios";
import { io } from "socket.io-client";

axios.defaults.withCredentials = true;
const API_URL = import.meta.env.VITE_API_URL;

/** Rooms of the cold storage module (cs_id of table Slot). */
export const ROOM_NAMES = { 1: "CSR 3", 2: "Chill 2", 3: "Chill 4", 4: "Chill 5", 5: "Chill 6", 6: "4C", 7: "Ante", 8: "LargeRoom" };
export const roomName = (cs_id) => ROOM_NAMES[cs_id] ?? `ห้อง ${cs_id}`;

/**
 * Check-in option of the existing API (/cold/checkin/check/Trolley) for the rm_status of the trolley's material.
 * Same table as the "statusMap" of that API.
 */
const OPTION_BY_STATUS = {
  QcCheck: "วัตถุดิบตรง",
  "รอแก้ไข": "วัตถุดิบรอแก้ไข",
  "QcCheck รอกลับมาเตรียม": "วัตถุดิบรับฝาก",
  "QcCheck รอ MD": "วัตถุดิบรับฝาก",
  "รอ Qc": "วัตถุดิบรับฝาก",
  "รอกลับมาเตรียม": "วัตถุดิบรับฝาก",
  "เหลือจากไลน์ผลิต": "เหลือจากไลน์ผลิต",
};
export const checkinOptionOf = (rmStatus) => OPTION_BY_STATUS[rmStatus] ?? null;

export async function fetchSlots() {
  const res = await axios.get(`${API_URL}/api/coldstorage/room`);
  return res.data?.slot ?? [];
}

/** Tell the other open cold-room pages that a slot changed (they listen to "reserveSlot"). */
export function announceSlot(slot) {
  try {
    const socket = io(API_URL, { transports: ["websocket"], reconnection: false });
    socket.on("connect", () => {
      socket.emit("reserveSlot", { slot_id: slot.slot_id, cs_id: slot.cs_id });
      setTimeout(() => socket.disconnect(), 300);
    });
    socket.on("connect_error", () => socket.disconnect());
  } catch (err) {
    console.error("แจ้งการเปลี่ยนช่องจอดไม่สำเร็จ:", err);
  }
}

const apiMessage = (err, fallback) => err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;

/** Hold the slot while the user confirms (same as clicking a slot on the old check-in pages). */
export async function reserveSlot({ cs_id, slot_id }) {
  const res = await fetch(`${API_URL}/api/coldstorage/update-rsrv-slot`, {
    method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slot_id, cs_id }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.message || "ไม่สามารถจองช่องจอดได้");
}

export async function releaseSlot({ cs_id, slot_id }) {
  try {
    await fetch(`${API_URL}/api/clodstorage/update-NULL-slot`, {
      method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slot_id, cs_id }),
    });
  } catch (err) {
    console.error("คืนช่องจอดที่จองไว้ไม่สำเร็จ:", err);
  }
}

/** Checks of the existing check-in API, then the check-in itself. Throws Error(message) in Thai when refused. */
export async function checkinTrolley({ tro_id, cs_id, slot_id, selectedOption }) {
  try {
    await axios.get(`${API_URL}/api/cold/checkin/check/Trolley`, { params: { tro_id, cs_id, slot_id, selectedOption } });
  } catch (err) {
    throw new Error(apiMessage(err, "ตรวจสอบรถเข็นไม่ผ่าน"));
  }
  try {
    const res = await axios.put(`${API_URL}/api/cold/checkin/update/Trolley`, { tro_id, cs_id, slot_id, selectedOption });
    return res.data;
  } catch (err) {
    throw new Error(apiMessage(err, "รับเข้าห้องเย็นไม่สำเร็จ"));
  }
}

export async function moveTrolley({ tro_id, new_slot_id }) {
  try {
    const res = await axios.put(`${API_URL}/api/coldstorage/moveTrolley`, { tro_id, new_slot_id });
    if (res.data?.success === false) throw new Error(res.data.message || "ย้ายรถเข็นไม่สำเร็จ");
    return res.data;
  } catch (err) {
    throw new Error(apiMessage(err, "ย้ายรถเข็นไม่สำเร็จ"));
  }
}
