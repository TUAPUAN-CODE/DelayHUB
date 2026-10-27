import axios from "axios";
import { io } from "socket.io-client";

axios.defaults.withCredentials = true;
const API_URL = import.meta.env.VITE_API_URL;

/** Rooms of the cold storage module (cs_id of table Slot). */
export const ROOM_NAMES = { 1: "CSR 3", 2: "Chill 2", 3: "Chill 4", 4: "Chill 5", 5: "Chill 6", 6: "4C", 7: "Ante", 8: "LargeRoom" };
export const roomName = (cs_id) => ROOM_NAMES[cs_id] ?? `ห้อง ${cs_id}`;
/** rooms not offered in the slot layout of /coldStorage: 4C (cs_id 6) and ห้อง 10 - 46 (rooms of the v2 module /ColdStorages) */
export const isHiddenRoom = (cs_id) => Number(cs_id) === 6 || (Number(cs_id) >= 10 && Number(cs_id) <= 46);

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

/** FIFO: what entered the cold rooms before this trolley — { list: [] } when it is FIFO (see FifoNotice; a warning only) */
const fifoInFlight = new Map(); // tro_id -> promise: a double click / a second screen asking for the same trolley shares one (heavy) query
export function fetchFifoBlockers(tro_id) {
  if (fifoInFlight.has(tro_id)) return fifoInFlight.get(tro_id);
  const promise = axios.get(`${API_URL}/api/coldstorage/fifo-check`, { params: { tro_id } })
    .then((res) => ({ list: res.data?.data ?? [], message: res.data?.message ?? "" }))
    .finally(() => fifoInFlight.delete(tro_id));
  fifoInFlight.set(tro_id, promise);
  return promise;
}

/** Every slot of every room (the move flow needs all of them to find a slot id that exists in more than one room) */
export async function fetchSlots() {
  const res = await axios.get(`${API_URL}/api/coldstorage/room`);
  return res.data?.slot ?? [];
}

/**
 * Slots for the slot picker: the server already leaves out the rooms the picker does not offer (?picker=1) and does not wait for locks.
 * The last answer is kept so the picker opens with it at once and refreshes in the background (a slot taken meanwhile is refused by reserveSlot);
 * the same request in flight is shared, so a prefetch and the picker opening together send one query.
 */
const PICKER_SHOW_MAX_AGE_MS = 120000; // an older answer is not shown: wait for the fresh one
const pickerSlots = { at: 0, data: null, inflight: null };
export function peekPickerSlots() {
  return pickerSlots.data && Date.now() - pickerSlots.at < PICKER_SHOW_MAX_AGE_MS ? pickerSlots.data : null;
}
export function fetchPickerSlots({ maxAgeMs = 3000 } = {}) {
  if (pickerSlots.inflight) return pickerSlots.inflight;
  if (pickerSlots.data && Date.now() - pickerSlots.at < maxAgeMs) return Promise.resolve(pickerSlots.data);
  pickerSlots.inflight = axios.get(`${API_URL}/api/coldstorage/room`, { params: { picker: 1 } })
    .then((res) => {
      pickerSlots.data = res.data?.slot ?? [];
      pickerSlots.at = Date.now();
      return pickerSlots.data;
    })
    .finally(() => { pickerSlots.inflight = null; });
  return pickerSlots.inflight;
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
/** come_cold_at: the entry time picked on the page ("YYYY-MM-DD HH:mm:ss"), null = now */
export async function checkinTrolley({ tro_id, cs_id, slot_id, selectedOption, come_cold_at = null }) {
  try {
    await axios.get(`${API_URL}/api/cold/checkin/check/Trolley`, { params: { tro_id, cs_id, slot_id, selectedOption } });
  } catch (err) {
    throw new Error(apiMessage(err, "ตรวจสอบรถเข็นไม่ผ่าน"));
  }
  try {
    const res = await axios.put(`${API_URL}/api/cold/checkin/update/Trolley`, { tro_id, cs_id, slot_id, selectedOption, come_cold_at });
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
