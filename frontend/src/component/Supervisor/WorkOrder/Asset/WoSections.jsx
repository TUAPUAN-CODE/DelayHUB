import DataTable from "../../ProductRecipe/Asset/DataTable";
import { countsOf, fmtDate, fmtDateTime, fmtNum, fmtTime, groupBy, mixTypeLabel } from "./woFormat";

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

const COUNT_LABELS = [
  ["baskets", "ตะกร้า"], ["ingredients", "รายการสูตร"], ["mixSequences", "ขั้นตอนผสม"], ["solutions", "สารละลาย"],
  ["toppings", "Topping"], ["hours", "ชั่วโมง"], ["fwChecks", "ชั่ง FW"], ["nwChecks", "ชั่ง NW"],
  ["inspections", "ผลตรวจ"], ["log", "ประวัติ"], ["pallets", "Pallet"], ["rejects", "ของเสีย"],
];

export const OverviewTab = ({ detail }) => {
  const h = detail.header[0];
  const counts = countsOf(detail.overview);
  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Info label="เลข WO" value={h.woNo} />
        <Info label="เลข WO บรรจุ" value={h.packWoNo} />
        <Info label="PO" value={h.poNo} />
        <Info label="วันที่ผลิต / กะ" value={`${fmtDate(h.prodDate)} / ${h.shift ?? "-"}`} />
        <Info label="รหัสสินค้า" value={h.productCode} />
        <Info label="ลูกค้า" value={h.customer} />
        <Info label="ตลาด" value={h.market} />
        <Info label="บรรจุภัณฑ์" value={[h.package, h.packageName].filter(Boolean).join(" / ")} />
        <Info label="สายผลิต" value={[h.lineNo, h.bu].filter(Boolean).join(" · ")} />
        <Info label="สถานะ" value={h.status} />
        <Info label="Target NW / FW" value={`${fmtNum(h.targetNW)} / ${fmtNum(h.targetFW)}`} />
        <Info label="Label NW" value={fmtNum(h.labelNW)} />
        <Info label="สร้างเมื่อ" value={fmtDateTime(h.createDate)} />
        <Info label="จบล่าสุด" value={fmtDateTime(h.finishLastTime)} />
        <Info label="Revision สูตร" value={h.revision} />
        <Info label="จำนวนตามแผน" value={fmtNum(h.planQty)} />
      </div>
      <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {COUNT_LABELS.map(([key, label]) => (
          <div key={key} className={`rounded-lg px-3 py-2 ${counts[key] ? "bg-blue-50" : "bg-slate-50"}`}>
            <div className="text-xs text-slate-500">{label}</div>
            <div className={`text-lg font-semibold tabular-nums ${counts[key] ? "text-blue-700" : "text-slate-300"}`}>{(counts[key] ?? 0).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </>
  );
};

const batchSizeColumns = [
  { key: "mix", label: "ประเภท" },
  { key: "batchSize", label: "ขนาด Batch", align: "right" },
  { key: "batchCount", label: "จำนวน Batch", align: "right" },
  { key: "base", label: "น้ำฐาน", align: "center" },
];

const formulaColumns = [
  { key: "seq", label: "#", align: "center" },
  { key: "ingdntCode", label: "รหัส" },
  { key: "ingdntName", label: "วัตถุดิบ" },
  { key: "stdWt", label: "Std", align: "right" },
  { key: "minWt", label: "Min", align: "right" },
  { key: "maxWt", label: "Max", align: "right" },
  { key: "percentage", label: "%", align: "right" },
];

export const FormulaTab = ({ detail }) => (
  <>
    <Block title="ขนาด Batch ที่ตั้งไว้">
      <DataTable
        columns={batchSizeColumns}
        rows={detail.batchSizes.map((b) => ({
          mix: mixTypeLabel(b.mixType), batchSize: fmtNum(b.batchSize), batchCount: b.batchCount ?? "-", base: b.isBaseWater ? "✓" : "",
        }))}
        empty="ยังไม่ได้ตั้งขนาด Batch"
      />
    </Block>
    {detail.formula.length ? (
      groupBy(detail.formula, "mixType").map(([mixType, rows]) => (
        <Block key={mixType} title={mixTypeLabel(mixType)}>
          <DataTable
            columns={formulaColumns}
            rows={rows.map((r) => ({
              seq: r.seq, ingdntCode: r.ingdntCode || "-", ingdntName: r.ingdntName || "-",
              stdWt: fmtNum(r.stdWt, 4), minWt: fmtNum(r.minWt, 4), maxWt: fmtNum(r.maxWt, 4), percentage: r.percentage ? fmtNum(r.percentage) : "-",
            }))}
          />
        </Block>
      ))
    ) : (
      <DataTable columns={[]} rows={[]} empty="ใบสั่งผลิตนี้ยังไม่มีสูตร" />
    )}
    {detail.mixSequences.length > 0 &&
      groupBy(detail.mixSequences, "mixType").map(([mixType, rows]) => (
        <Block key={`s${mixType}`} title={`ลำดับการผสม · ${mixTypeLabel(mixType)}`}>
          <ol className="space-y-1.5">
            {rows.map((r, i) => (
              <li key={i} className="flex gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">{i + 1}</span>
                <span className="text-slate-700">{[r.description, r.alternateMaterialName && `ทดแทน: ${r.alternateMaterialName}`].filter(Boolean).join(" ")}</span>
              </li>
            ))}
          </ol>
        </Block>
      ))}
  </>
);

const extraColumns = [
  { key: "kind", label: "ชนิด" },
  { key: "name", label: "รายการ" },
  { key: "quantity", label: "ปริมาณ", align: "right" },
  { key: "range", label: "ช่วงที่ยอมรับ", align: "right" },
  { key: "target", label: "เป้าหมาย", align: "right" },
  { key: "note", label: "หมายเหตุ" },
];

export const ExtrasTab = ({ detail }) => (
  <DataTable
    columns={extraColumns}
    rows={detail.solutionsToppings.map((r) => ({
      kind: r.kind === "solution" ? "สารละลาย" : "Topping",
      name: r.name || "-",
      quantity: fmtNum(r.quantity),
      range: Number(r.minVal) || Number(r.maxVal) ? `${fmtNum(r.minVal)} – ${fmtNum(r.maxVal)}` : "-",
      target: fmtNum(r.target),
      note: r.isNotUse ? "ไม่ใช้" : "",
    }))}
    empty="ใบสั่งผลิตนี้ไม่มีสารละลายหรือ Topping"
  />
);

const weightColumns = [
  { key: "kind", label: "ชนิด" },
  { key: "round", label: "รอบ", align: "center" },
  { key: "n", label: "จำนวนครั้ง", align: "right" },
  { key: "minW", label: "ต่ำสุด", align: "right" },
  { key: "maxW", label: "สูงสุด", align: "right" },
  { key: "avgW", label: "เฉลี่ย", align: "right" },
  { key: "firstAt", label: "ครั้งแรก" },
  { key: "lastAt", label: "ครั้งล่าสุด" },
];

const hourColumns = [
  { key: "hourNo", label: "ชั่วโมงที่", align: "center" },
  { key: "start", label: "เริ่ม", align: "center" },
  { key: "finish", label: "จบ", align: "center" },
];

export const WeightsTab = ({ detail }) => (
  <>
    <Block title="น้ำหนักที่ชั่ง (ไม่รวมที่ถูกลบ)">
      <DataTable
        columns={weightColumns}
        rows={detail.weights.map((r) => ({
          kind: r.kind, round: r.round, n: r.n, minW: fmtNum(r.minW), maxW: fmtNum(r.maxW), avgW: fmtNum(r.avgW), firstAt: fmtDateTime(r.firstAt), lastAt: fmtDateTime(r.lastAt),
        }))}
        empty="ยังไม่มีการชั่งน้ำหนัก"
      />
    </Block>
    <Block title="รายชั่วโมง">
      <DataTable
        columns={hourColumns}
        rows={detail.hours.map((r) => ({ hourNo: r.hourNo, start: fmtTime(r.hourStart), finish: fmtTime(r.hourFinish) }))}
        empty="ไม่มีข้อมูลรายชั่วโมง"
      />
    </Block>
  </>
);

const inspectColumns = [
  { key: "round", label: "รอบ", align: "center" },
  { key: "item", label: "รายการตรวจ" },
  { key: "input", label: "ค่าที่กรอก" },
  { key: "result", label: "ผล" },
];

const logColumns = [
  { key: "time", label: "เวลา" },
  { key: "user", label: "ผู้ใช้" },
  { key: "description", label: "รายการ" },
];

export const InspectTab = ({ detail }) => {
  const inspectors = detail.inspections.filter((r) => r.kind === "inspector" && r.item).map((r) => r.item);
  const specials = detail.inspections.filter((r) => r.kind === "special");
  return (
    <>
      <Block title="ผู้ตรวจ">
        {inspectors.length ? (
          <div className="flex flex-wrap gap-2">
            {inspectors.map((name, i) => (
              <span key={i} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">{name}</span>
            ))}
          </div>
        ) : (
          <div className="text-sm text-slate-400">ยังไม่มีผู้ตรวจ</div>
        )}
      </Block>
      <Block title="ผลตรวจพิเศษ">
        <DataTable
          columns={inspectColumns}
          rows={specials.map((r) => ({ round: r.round ?? "-", item: (r.item || "").trim() || "-", input: r.input || "-", result: r.result || "-" }))}
          empty="ไม่มีผลตรวจพิเศษ"
        />
      </Block>
      <Block title="ประวัติการแก้ไขใบสั่งผลิต">
        <DataTable
          columns={logColumns}
          rows={detail.log.map((r) => ({ time: fmtDateTime(r.logTime), user: r.user || "-", description: r.description }))}
          empty="ไม่มีประวัติ"
        />
      </Block>
    </>
  );
};
