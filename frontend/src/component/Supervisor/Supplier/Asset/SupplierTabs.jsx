import { useEffect, useState } from "react";
import axios from "axios";
import { Loader2 } from "lucide-react";
import DataTable from "../../ProductRecipe/Asset/DataTable";
import DecisionBadge from "./DecisionBadge";
import { TONE_CLASS, decisionTone, fmtDate, fmtDateTime, fmtInt, fmtNum, resultTone } from "./supFormat";

const API_URL = import.meta.env.VITE_API_URL;

const Block = ({ title, children }) => (
  <div className="mb-6">
    <h4 className="mb-2 text-sm font-semibold text-slate-700">{title}</h4>
    {children}
  </div>
);

const Info = ({ label, value }) => (
  <div>
    <div className="text-xs text-slate-500">{label}</div>
    <div className="break-words text-sm font-semibold text-slate-800">{value || "-"}</div>
  </div>
);

const Tile = ({ label, value, tone }) => (
  <div className={`rounded-lg px-3 py-2 ${tone ? TONE_CLASS[tone] : "bg-slate-50 text-slate-800"}`}>
    <div className="text-xs opacity-80">{label}</div>
    <div className="text-lg font-semibold tabular-nums">{value}</div>
  </div>
);

const LotLink = ({ lot, onOpenLot }) =>
  lot ? (
    <button onClick={() => onOpenLot(lot)} className="font-medium text-blue-700 hover:underline">
      {lot}
    </button>
  ) : (
    "-"
  );

/** Loads rows of one supplier from a list endpoint (receipts / inspection results) when the tab opens or a filter changes. */
const useSupplierRows = (endpoint, supplierId, range, material) => {
  const [state, setState] = useState({ rows: [], limit: 0, loading: true, error: "" });
  useEffect(() => {
    const ctrl = new AbortController();
    const load = async () => {
      setState((s) => ({ ...s, loading: true, error: "" }));
      try {
        const res = await axios.get(`${API_URL}/api/supplier/${endpoint}`, {
          params: { supplierId, from: range.from, to: range.to, material: material || undefined },
          signal: ctrl.signal,
        });
        setState({ rows: res.data.data ?? [], limit: res.data.limit ?? 0, loading: false, error: "" });
      } catch (err) {
        if (axios.isCancel(err)) return;
        console.error(`${endpoint} error:`, err);
        setState({ rows: [], limit: 0, loading: false, error: err.response?.data?.error || "โหลดข้อมูลไม่สำเร็จ" });
      }
    };
    load();
    return () => ctrl.abort();
  }, [endpoint, supplierId, range.from, range.to, material]);
  return state;
};

const RowsState = ({ state, children }) => {
  if (state.loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }
  if (state.error) return <div className="py-6 text-sm text-red-600">{state.error}</div>;
  return (
    <>
      {state.limit > 0 && state.rows.length >= state.limit && (
        <div className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {`แสดง ${state.limit} แถวล่าสุด — ย่อช่วงวันที่หรือเลือกวัตถุดิบเพื่อดูส่วนที่เหลือ`}
        </div>
      )}
      {children}
    </>
  );
};

// ───────────────────────────────────────────── ภาพรวม
export const OverviewTab = ({ detail }) => {
  const h = detail.header || {};
  const s = detail.stats || {};
  const totals = { accept: 0, condition: 0, complaint: 0, reject: 0, pending: 0, other: 0 };
  detail.decisions.forEach((d) => {
    totals[decisionTone(d.code, d.ar)] += d.lots;
  });
  const lots = Object.values(totals).reduce((a, b) => a + b, 0);
  const decided = lots - totals.pending;
  const rejectPct = decided ? `${((100 * totals.reject) / decided).toFixed(2)}%` : "-";
  const noContact = !h.address && !h.phone1 && !h.fiscalNumber;

  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Info label="รหัสผู้ขาย" value={h.supplierId} />
        <Info label="ชื่อ" value={h.name || h.receiptName} />
        <Info label="ชื่อทางการค้า" value={h.commercialName} />
        <Info label="ประเภท" value={h.type} />
        <Info label="ที่อยู่" value={[h.address, h.city, h.postalCode].filter(Boolean).join(" ")} />
        <Info label="โทรศัพท์" value={[h.phone1, h.phone2].filter(Boolean).join(", ")} />
        <Info label="เลขประจำตัวผู้เสียภาษี" value={h.fiscalNumber || h.vatRegNumber} />
        <Info label="แก้ไขล่าสุดใน WISEUP" value={fmtDateTime(h.modifiedDate)} />
      </div>
      {noContact && (
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          WISEUP เก็บเฉพาะรหัสและชื่อผู้ขาย — ที่อยู่ / โทรศัพท์ / เลขภาษี ต้องดูจาก SAP Vendor Master
        </div>
      )}

      <Block title="การส่งของในช่วงวันที่">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Tile label="บรรทัดรับเข้า" value={fmtInt(s.grLines)} />
          <Tile label="ใบรับสินค้า" value={fmtInt(s.grDocs)} />
          <Tile label="ชนิดวัตถุดิบ" value={fmtInt(s.materials)} />
          <Tile label="ใบสั่งซื้อ (PO)" value={fmtInt(s.purchaseOrders)} />
          <Tile label="Batch" value={fmtInt(s.batches)} />
          <Tile label="รับครั้งแรก / ล่าสุด" value={`${fmtDate(s.firstReceipt)} / ${fmtDate(s.lastReceipt)}`} />
        </div>
      </Block>

      <Block title="ผลตัดสินคุณภาพรับเข้า (Inspection Lot)">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          <Tile label="Lot ทั้งหมด" value={fmtInt(lots)} />
          <Tile label="ยอมรับ" value={fmtInt(totals.accept + totals.other)} tone="accept" />
          <Tile label="ยอมรับแบบมีเงื่อนไข" value={fmtInt(totals.condition)} tone="condition" />
          <Tile label="ร้องเรียน" value={fmtInt(totals.complaint)} tone="complaint" />
          <Tile label="ปฏิเสธ" value={fmtInt(totals.reject)} tone="reject" />
          <Tile label="รอผล" value={fmtInt(totals.pending)} tone="pending" />
          <Tile label="% ปฏิเสธ" value={rejectPct} tone={totals.reject ? "reject" : undefined} />
        </div>
        <div className="mt-3">
          <DataTable
            columns={[
              { key: "decision", label: "ผลตัดสิน" },
              { key: "lots", label: "จำนวน Lot", align: "right" },
            ]}
            rows={detail.decisions.map((d) => ({
              decision: <DecisionBadge code={d.code} description={d.description} ar={d.ar} />,
              lots: fmtInt(d.lots),
            }))}
            empty="ไม่มี Inspection Lot ในช่วงนี้"
          />
        </div>
      </Block>
    </>
  );
};

// ───────────────────────────────────────────── วัตถุดิบที่ส่ง
export const MaterialsTab = ({ detail, onPickMaterial }) => (
  <DataTable
    columns={[
      { key: "code", label: "รหัสวัตถุดิบ" },
      { key: "name", label: "ชื่อวัตถุดิบ" },
      { key: "group", label: "กลุ่ม (SAP)" },
      { key: "receipts", label: "ครั้งที่รับ", align: "right" },
      { key: "qty", label: "ปริมาณรวม", align: "right" },
      { key: "unit", label: "หน่วย" },
      { key: "batches", label: "Batch", align: "right" },
      { key: "last", label: "รับล่าสุด" },
    ]}
    rows={detail.materials.map((m) => ({
      code: (
        <button onClick={() => onPickMaterial(m.materialCode)} className="font-medium text-blue-700 hover:underline" title="ดูใบรับของวัตถุดิบนี้">
          {m.materialCode}
        </button>
      ),
      name: [m.descriptionEN, m.descriptionTH].filter(Boolean).join(" / ") || "-",
      group: [m.materialType, m.materialGroup].filter(Boolean).join(" · ") || "-",
      receipts: fmtInt(m.receipts),
      qty: fmtNum(m.totalQty, 3),
      unit: m.unit || "-",
      batches: fmtInt(m.batches),
      last: fmtDate(m.lastReceipt),
    }))}
    empty="ไม่มีการรับวัตถุดิบในช่วงนี้"
  />
);

// ───────────────────────────────────────────── ใบรับเข้า
export const ReceiptsTab = ({ supplierId, range, material, onOpenLot }) => {
  const state = useSupplierRows("fetchReceipts", supplierId, range, material);
  return (
    <RowsState state={state}>
      <DataTable
        columns={[
          { key: "at", label: "รับเมื่อ" },
          { key: "gr", label: "ใบรับสินค้า" },
          { key: "po", label: "PO" },
          { key: "material", label: "วัตถุดิบ" },
          { key: "batch", label: "Batch" },
          { key: "vendorBatch", label: "Batch ผู้ขาย" },
          { key: "qty", label: "จำนวน", align: "right" },
          { key: "exp", label: "หมดอายุ" },
          { key: "lot", label: "Inspection Lot" },
          { key: "ud", label: "ผลตัดสิน" },
        ]}
        rows={state.rows.map((r) => ({
          at: fmtDateTime(r.receivedAt),
          gr: `${r.grDocument}/${r.grLine}`,
          po: r.poNumber ? `${r.poNumber}/${r.poLine ?? ""}` : "-",
          material: (
            <div>
              <div className="font-medium">{r.materialCode}</div>
              <div className="text-xs text-slate-500">{r.materialName || ""}</div>
            </div>
          ),
          batch: r.batch || "-",
          vendorBatch: r.vendorBatch || "-",
          qty: `${fmtNum(r.quantity, 3)} ${r.unit || ""}`,
          exp: fmtDate(r.expirationDate),
          lot: <LotLink lot={r.inspectionLot} onOpenLot={onOpenLot} />,
          ud: r.inspectionLot ? <DecisionBadge code={r.udCode} description={r.udDescription} ar={r.udAR} /> : "-",
        }))}
        empty="ไม่มีใบรับในช่วงนี้"
      />
    </RowsState>
  );
};

// ───────────────────────────────────────────── ผลตรวจรายหัวข้อ
const limitsText = (r) => {
  const parts = [r.lowerLimit, r.target, r.upperLimit].map((v) => (v === null || v === undefined ? "" : fmtNum(v, 3)));
  return parts.some(Boolean) ? parts.map((p) => p || "-").join(" / ") : "-";
};

export const ResultsTab = ({ supplierId, range, material, onOpenLot }) => {
  const state = useSupplierRows("fetchInspectionResults", supplierId, range, material);
  return (
    <RowsState state={state}>
      <DataTable
        columns={[
          { key: "lot", label: "Inspection Lot" },
          { key: "at", label: "รับเมื่อ" },
          { key: "material", label: "วัตถุดิบ / Batch" },
          { key: "feature", label: "หัวข้อตรวจ" },
          { key: "limits", label: "ต่ำสุด / เป้า / สูงสุด", align: "right" },
          { key: "value", label: "ค่าที่วัด", align: "right" },
          { key: "result", label: "ผล" },
          { key: "remark", label: "หมายเหตุ" },
        ]}
        rows={state.rows.map((r) => ({
          lot: <LotLink lot={r.inspectionLot} onOpenLot={onOpenLot} />,
          at: fmtDate(r.receivedAt),
          material: (
            <div>
              <div className="font-medium">{r.materialCode}</div>
              <div className="text-xs text-slate-500">{r.batch || ""}</div>
            </div>
          ),
          feature: (
            <div>
              <div>{r.characteristicTH || r.characteristic || r.featureCode}</div>
              <div className="text-xs text-slate-400">{r.featureCode}{r.unit ? ` · ${r.unit}` : ""}</div>
            </div>
          ),
          limits: limitsText(r),
          value: r.measuredValue ? `${r.measuredValue}` : "-",
          result: r.resultText ? (
            <span className={`rounded-full px-2 py-0.5 text-xs ${TONE_CLASS[resultTone(r.resultAR)]}`}>{r.resultText}</span>
          ) : (
            "-"
          ),
          remark: r.remark || "",
        }))}
        empty="ไม่มีผลตรวจในช่วงนี้"
      />
    </RowsState>
  );
};

// ───────────────────────────────────────────── หัวข้อที่ไม่ผ่านบ่อย
export const FailingTab = ({ detail }) => (
  <DataTable
    columns={[
      { key: "feature", label: "หัวข้อตรวจ" },
      { key: "code", label: "รหัส (MIC)" },
      { key: "results", label: "จำนวนผลตรวจ", align: "right" },
      { key: "rejects", label: "ไม่ผ่าน", align: "right" },
      { key: "pct", label: "% ไม่ผ่าน", align: "right" },
    ]}
    rows={detail.features.map((f) => ({
      feature: f.characteristicTH || f.characteristic || "-",
      code: f.featureCode,
      results: fmtInt(f.results),
      rejects: f.rejects ? <span className="font-semibold text-red-600">{fmtInt(f.rejects)}</span> : "0",
      pct: f.results ? `${((100 * f.rejects) / f.results).toFixed(1)}%` : "-",
    }))}
    empty="ไม่มีผลตรวจในช่วงนี้"
  />
);
