import { fmt } from "./recipeDocs";

const has = (v) => Number(v) > 0;

// One scale per weight type: lower control .. upper control, the warning band in amber, the target marked.
const Scale = ({ title, lcl, lwl, target, uwl, ucl }) => {
  const anyLimit = [lcl, lwl, uwl, ucl].some(has);
  const ordered = has(lcl) && has(ucl) && Number(ucl) > Number(lcl);
  const pos = (v) => Math.min(100, Math.max(0, ((Number(v) - Number(lcl)) / (Number(ucl) - Number(lcl))) * 100));

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-sm font-semibold text-slate-700">{title}</span>
        <span className="text-2xl font-bold tabular-nums text-blue-700">{has(target) ? fmt(target, 2) : "-"}</span>
      </div>

      {ordered ? (
        <div className="relative mb-7 mt-5 h-2 rounded-full bg-slate-200">
          {has(lwl) && has(uwl) && Number(uwl) > Number(lwl) && (
            <div className="absolute h-2 rounded-full bg-amber-300" style={{ left: `${pos(lwl)}%`, width: `${pos(uwl) - pos(lwl)}%` }} />
          )}
          {has(target) && <div className="absolute -top-1.5 h-5 w-1 -translate-x-1/2 rounded bg-blue-700" style={{ left: `${pos(target)}%` }} />}
          {[["LCL", lcl], ["LWL", lwl], ["UWL", uwl], ["UCL", ucl]].map(
            ([label, v]) =>
              has(v) && (
                <div key={label} className="absolute top-3 -translate-x-1/2 text-center text-[10px] leading-tight text-slate-500" style={{ left: `${pos(v)}%` }}>
                  <div>{label}</div>
                  <div className="tabular-nums">{fmt(v, 2)}</div>
                </div>
              )
          )}
        </div>
      ) : (
        <div className="text-xs text-slate-400">{anyLimit ? "ขีดควบคุมยังตั้งค่าไม่ครบ" : "ยังไม่ได้ตั้งขีดควบคุม"}</div>
      )}
    </div>
  );
};

const Stat = ({ label, value }) => (
  <div className="rounded-lg bg-slate-50 px-3 py-2">
    <div className="text-xs text-slate-500">{label}</div>
    <div className="text-base font-semibold tabular-nums text-slate-800">{has(value) ? fmt(value, 2) : "-"}</div>
  </div>
);

const WeightSpec = ({ h }) => (
  <section>
    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">น้ำหนักและขีดควบคุม</h3>
    <div className="grid gap-4 lg:grid-cols-2">
      <Scale title="Net Weight (NW)" lcl={h.lclNW} lwl={h.lwlNW} target={h.targetNW} uwl={h.uwlNW} ucl={h.uclNW} />
      <Scale title="Fill Weight (FW)" lcl={h.lclFW} lwl={h.lwlFW} target={h.targetFW} uwl={h.uwlFW} ucl={h.uclFW} />
    </div>
    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      <Stat label="Max NW" value={h.maxNW} />
      <Stat label="Max FW" value={h.maxFW} />
      <Stat label="Max DW" value={h.maxDW} />
      <Stat label="Target DW" value={h.targetDW} />
      <Stat label="Label NW" value={h.labelNW} />
      <Stat label="Label T1" value={h.labelT1} />
      <Stat label="Label T2" value={h.labelT2} />
    </div>
    {has(h.minuteOfInspection) && (
      <p className="mt-3 text-xs text-slate-500">
        {`ตรวจน้ำหนักทุก ${fmt(h.minuteOfInspection, 0)} นาที`}
      </p>
    )}
  </section>
);

export default WeightSpec;
