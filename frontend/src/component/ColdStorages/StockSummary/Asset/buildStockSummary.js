// Stock of the large cold rooms (ห้องเย็นใหญ่), summed from the same rows as the /ColdStorages/LargeRooms table:
// - in-room rows   : GET /api/coldstorages/incold/fetchSlotRawMatsend (trolley parked in a slot)
// - in-transit rows: GET /api/coldstorages/pending/checkin (sent to the large room, no slot yet)
import { calculateCSDelayTime } from "../../RoomMonitor/Asset/csDelay";

export const DEST_RECEIVED = "ในห้องเย็นใหญ่";

// Where the trolley came from: the cold-room checkout (PUT /coldstorage/outcoldstorage) sets stay_place 'ออกห้องเย็น'
// and History.cold_dest = the destination; a flow group sent straight from the preparation keeps stay_place 'จุดเตรียม'.
export const SOURCE_COLD = "cold";
export const SOURCE_PREP = "prep";
export const SOURCE_LABEL = { [SOURCE_COLD]: "จากห้องเย็น", [SOURCE_PREP]: "จากจุดเตรียม" };

export const getSource = (row) =>
  row.stay_place === "ออกห้องเย็น" || row.cold_dest === "ห้องเย็นใหญ่" ? SOURCE_COLD : SOURCE_PREP;

// transit = sent but not received into the room yet (no slot, or in a slot still waiting for check-in)
export const isInTransit = (row) => !!row.isPending || row.dest !== DEST_RECEIVED;

// the same colours as the hourglass of the LargeRooms table
export const STATUS_KEYS = ["green", "orange", "red", "nodcs", "wait"];
export const STATUS_META = {
  green: { label: "ยังอยู่ในเวลา", color: "#16A34A", bg: "#DCFCE7" },
  orange: { label: "ใกล้ครบกำหนด", color: "#D97706", bg: "#FEF3C7" },
  red: { label: "เลยกำหนด", color: "#DC2626", bg: "#FEE2E2" },
  nodcs: { label: "ไม่คำนวณ DCS", color: "#475569", bg: "#E2E8F0" },
  wait: { label: "รอดำเนินการ", color: "#64748B", bg: "#F1F5F9" },
};

const getStatusKey = (row) => {
  const { color, noDcs } = calculateCSDelayTime(row);
  if (noDcs) return "nodcs";
  if (color === "red" || color === "orange" || color === "green") return color;
  return "wait";
};

const toNumber = (v) => {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const emptyBucket = () => ({
  rows: 0,
  trolleys: new Set(),
  weight: 0,
  trays: 0,
  transitTrolleys: new Set(),
  roomTrolleys: new Set(),
  bySource: { [SOURCE_COLD]: 0, [SOURCE_PREP]: 0 },
  status: { green: 0, orange: 0, red: 0, nodcs: 0, wait: 0 },
});

const addRow = (bucket, row) => {
  const w = toNumber(row.weight_RM);
  bucket.rows += 1;
  bucket.weight += w;
  bucket.trays += toNumber(row.tray_count);
  if (row.tro_id) {
    bucket.trolleys.add(row.tro_id);
    (row.inTransit ? bucket.transitTrolleys : bucket.roomTrolleys).add(row.tro_id);
  }
  bucket.bySource[row.source] += w;
  bucket.status[row.statusKey] += 1;
};

const finish = (bucket) => ({
  ...bucket,
  trolleys: bucket.trolleys.size,
  transitTrolleys: bucket.transitTrolleys.size,
  roomTrolleys: bucket.roomTrolleys.size,
});

export const TRANSIT_ROOM = "กำลังส่ง (ยังไม่เข้าช่องจอด)";

// rows -> { total, bySourceTotal, materials[], rooms[] }; sourceFilter = "all" | SOURCE_COLD | SOURCE_PREP
export const buildStockSummary = (rawRows, sourceFilter = "all") => {
  const rows = rawRows
    .map((r) => ({ ...r, source: getSource(r), inTransit: isInTransit(r), statusKey: getStatusKey(r) }))
    .filter((r) => sourceFilter === "all" || r.source === sourceFilter);

  const total = emptyBucket();
  const bySourceTrolleys = { [SOURCE_COLD]: new Set(), [SOURCE_PREP]: new Set() };
  const materials = new Map();
  const rooms = new Map();

  rows.forEach((r) => {
    addRow(total, r);
    if (r.tro_id) bySourceTrolleys[r.source].add(r.tro_id);

    const matKey = r.mat || "-";
    if (!materials.has(matKey)) materials.set(matKey, { ...emptyBucket(), mat: matKey, mat_name: r.mat_name || "-" });
    addRow(materials.get(matKey), r);

    const roomKey = r.cs_name || TRANSIT_ROOM;
    if (!rooms.has(roomKey)) rooms.set(roomKey, { ...emptyBucket(), cs_id: r.cs_id ?? null, cs_name: roomKey });
    addRow(rooms.get(roomKey), r);
  });

  const byWeight = (a, b) => b.weight - a.weight || b.rows - a.rows;
  return {
    total: finish(total),
    trolleysBySource: {
      [SOURCE_COLD]: bySourceTrolleys[SOURCE_COLD].size,
      [SOURCE_PREP]: bySourceTrolleys[SOURCE_PREP].size,
    },
    materials: [...materials.values()].map(finish).sort(byWeight),
    // rooms by cs_id; the in-transit group last
    rooms: [...rooms.values()].map(finish).sort((a, b) => {
      if (a.cs_id == null) return 1;
      if (b.cs_id == null) return -1;
      return Number(a.cs_id) - Number(b.cs_id);
    }),
  };
};

export const formatKg = (n) =>
  Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
