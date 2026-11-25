import DataTable from "../../ProductRecipe/Asset/DataTable";
import { fmtNum } from "../../Supplier/Asset/supFormat";
import RangeBar from "./RangeBar";

const Tile = ({ label, value, tone }) => (
  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
    <div className="text-xs text-slate-500">{label}</div>
    <div className={`text-lg font-bold tabular-nums ${tone || "text-slate-900"}`}>{value}</div>
  </div>
);

// NetWt outside [MinWt, MaxWt] — when a limit is empty it is not checked
const isOutOfRange = (r) => {
  const net = Number(r.netWt);
  if (r.netWt === null || r.netWt === undefined || !Number.isFinite(net)) return false;
  const min = r.minWt === null || r.minWt === "" ? NaN : Number(r.minWt);
  const max = r.maxWt === null || r.maxWt === "" ? NaN : Number(r.maxWt);
  return (Number.isFinite(min) && net < min) || (Number.isFinite(max) && net > max);
};

// What was really weighed (view vw_ngdnt_listNgdnt): one row per basket, newest first, in the chosen date range (at most 31 days).
const IngredientUsage = ({ usage, range, loading, onRangeChange }) => {
  const s = usage.summary;

  return (
    <div>
      <RangeBar range={range} loading={loading} onRangeChange={onRangeChange} />

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-5">
        <Tile label="ชั่งทั้งหมด (ครั้ง)" value={s.weighings.toLocaleString()} />
        <Tile label="ใบสั่งผลิต (WO)" value={s.workOrders.toLocaleString()} />
        <Tile label="Batch" value={s.batches.toLocaleString()} />
        <Tile label="น้ำหนักรวม (กก.)" value={fmtNum(s.totalNetWt, 2)} />
        <Tile label="นอกช่วง Min / Max" value={s.outOfRange.toLocaleString()} tone={s.outOfRange ? "text-red-600" : "text-green-700"} />
      </div>

      {usage.capped && <div className="mb-2 text-xs text-amber-700">{`แสดง ${usage.rows.length} รายการล่าสุด — เลือกช่วงวันที่ให้แคบลงเพื่อดูรายการอื่น`}</div>}
      <DataTable
        columns={[
          { key: "time", label: "เวลาผสม" },
          { key: "wo", label: "WO" },
          { key: "basket", label: "ตะกร้า", align: "right" },
          { key: "batch", label: "Batch" },
          { key: "std", label: "Std", align: "right" },
          { key: "min", label: "Min", align: "right" },
          { key: "max", label: "Max", align: "right" },
          { key: "net", label: "ชั่งจริง", align: "right" },
        ]}
        rows={usage.rows.map((r) => ({
          time: String(r.mixingTime || "-").slice(0, 16), // already a plain local time ("yyyy-MM-dd HH:mm:ss" from the API), so it is not run through Date
          wo: r.woNo || "-",
          basket: r.basketNumber ?? "-",
          batch: r.batchNo || "-",
          std: fmtNum(r.stdWt, 3),
          min: fmtNum(r.minWt, 3),
          max: fmtNum(r.maxWt, 3),
          net: isOutOfRange(r) ? <span className="font-semibold text-red-600">{fmtNum(r.netWt, 3)}</span> : fmtNum(r.netWt, 3),
        }))}
        empty={loading ? "กำลังโหลด..." : "ไม่มีการชั่งส่วนผสมนี้ในช่วงนี้"}
      />
    </div>
  );
};

export default IngredientUsage;
