// ไทม์ไลน์ (Gantt) ทุกล็อตบนแกนเวลาเดียวกัน — เห็นช่วงที่ค้างนาน/เกินมาตรฐานได้ทันที
import { useMemo } from 'react';
import { T } from './tracebackUI';
import { Tag } from './TraceAtoms';
import { fmtDT, fmtDur, buildDelay, lotSegments } from './tracebackCore';

// สีตามช่วง: อยู่ในห้องเย็น = ฟ้า, ก่อนเข้าห้องเย็น = ส้ม, หลังออกห้องเย็น/รอบรรจุ = เขียว
const segColor = (from) => {
  if (['_B', '_D', '_D3'].includes(from)) return T.blue;
  if (from === '_A') return T.orange;
  return T.ok;
};

const TraceTimeline = ({ materials = [] }) => {
  const rows = useMemo(() => materials.map(m => ({ m, d: buildDelay(m), seg: lotSegments(m) }))
    .filter(r => r.seg.start)
    .sort((a, b) => a.seg.start - b.seg.start), [materials]);

  const min = rows.length ? Math.min(...rows.map(r => r.seg.start.getTime())) : 0;
  const max = rows.length ? Math.max(...rows.map(r => r.seg.end.getTime())) : 0;
  const span = Math.max(max - min, 60000);
  const pct = t => ((t.getTime() - min) / span) * 100;

  if (!rows.length) {
    return <div style={{ padding: 18, border: `1px solid ${T.line}`, borderRadius: 10, background: T.white, color: T.text2 }}>ไม่มีจุดบันทึกเวลาให้แสดง</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 10, fontSize: 12, color: T.text }}>
        {[[T.orange, 'เตรียมเสร็จ → เข้าห้องเย็น'], [T.blue, 'อยู่ในห้องเย็น'], [T.ok, 'ออกห้องเย็น → บรรจุ']].map(([c, l]) => (
          <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 22, height: 10, borderRadius: 3, background: c }} /> {l}
          </span>
        ))}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 22, height: 10, borderRadius: 3, border: `2px solid ${T.bad}` }} /> ล็อตเกินมาตรฐาน DBS
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: T.text2, margin: '0 0 4px 190px' }}>
        <span>{fmtDT(new Date(min).toISOString())}</span>
        <span>{fmtDT(new Date(min + span / 2).toISOString())}</span>
        <span>{fmtDT(new Date(max).toISOString())}</span>
      </div>

      <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, background: T.white, maxHeight: 560, overflowY: 'auto' }}>
        {rows.map(({ m, d, seg }, i) => (
          <div key={m.mapping_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: i % 2 ? T.bg : T.white, borderBottom: `1px solid ${T.line}` }}>
            <div style={{ width: 180, flexShrink: 0, fontSize: 12, lineHeight: 1.35 }}>
              <div style={{ fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.mat_name}>{m.mat} · {m.mat_name}</div>
              <div style={{ color: T.text2 }}>#{m.mapping_id} · {m.rmm_line_name || '-'} {d.anyOver && <Tag tone="bad">เกิน</Tag>}</div>
            </div>
            <div style={{ position: 'relative', flex: 1, height: 22, background: T.blueSoft, borderRadius: 6, outline: d.anyOver ? `2px solid ${T.bad}` : 'none' }}>
              {seg.segs.map((sg, j) => (
                <div key={j}
                  title={`${sg.from.label} → ${sg.to.label}\n${fmtDT(sg.from.t.toISOString())} → ${fmtDT(sg.to.t.toISOString())}\n${fmtDur(sg.minutes)}`}
                  style={{
                    position: 'absolute', top: 3, bottom: 3, borderRadius: 4,
                    left: `${pct(sg.from.t)}%`, width: `${Math.max(pct(sg.to.t) - pct(sg.from.t), 0.4)}%`,
                    background: segColor(sg.from.k),
                  }} />
              ))}
            </div>
            <div style={{ width: 90, flexShrink: 0, textAlign: 'right', fontSize: 12, fontWeight: 600, color: d.over.dbs4 ? T.bad : T.text }}>
              {fmtDur(d.value.dbs4)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TraceTimeline;
