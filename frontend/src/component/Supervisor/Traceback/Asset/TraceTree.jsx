// ผังต้นไม้สอบกลับ: สินค้า → วัตถุดิบ (Mat+Batch) → ผู้ขาย / ล็อต → ส่วนผสม / บรรจุภัณฑ์
//   เห็นทั้งห่วงโซ่ในหน้าเดียว กางเฉพาะกิ่งที่ต้องดู
import { useMemo, useState } from 'react';
import { T } from './tracebackUI';
import { Tag, Btn } from './TraceAtoms';
import { fmtDT, fmtD, fmtNum, fmtDur, buildDelay } from './tracebackCore';

const Branch = ({ label, meta, tone = 'blue', open, onToggle, children, depth = 0, badge }) => {
  const color = { blue: T.blue, orange: T.orange, ok: T.ok, bad: T.bad, plain: T.text2 }[tone] || T.blue;
  const has = !!children;
  return (
    <div style={{ marginLeft: depth ? 18 : 0, borderLeft: depth ? `2px solid ${T.line}` : 'none', paddingLeft: depth ? 12 : 0 }}>
      <div
        role={has ? 'button' : undefined}
        tabIndex={has ? 0 : undefined}
        onClick={has ? onToggle : undefined}
        onKeyDown={has ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } } : undefined}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', margin: '4px 0', borderRadius: 9,
          background: T.white, border: `1px solid ${T.line}`, borderLeft: `4px solid ${color}`, cursor: has ? 'pointer' : 'default',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ width: 14, color, fontWeight: 700 }}>{has ? (open ? '▾' : '▸') : '•'}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{label}</span>
        {meta && <span style={{ fontSize: 12, color: T.text2 }}>{meta}</span>}
        {badge}
      </div>
      {open && children}
    </div>
  );
};

const TraceTree = ({ data }) => {
  const s = data.summary || {};
  const materials = useMemo(() => data.materials || [], [data]);
  const [open, setOpen] = useState({ root: true });
  const toggle = k => setOpen(p => ({ ...p, [k]: !p[k] }));

  const groups = useMemo(() => {
    const map = new Map();
    materials.forEach(m => {
      const k = `${m.mat}|${m.batch_before || ''}`;
      if (!map.has(k)) map.set(k, { key: k, mat: m.mat, name: m.mat_name, batch: m.batch_before, lots: [] });
      map.get(k).lots.push(m);
    });
    return [...map.values()];
  }, [materials]);

  const expandAll = (v) => {
    const next = { root: v };
    groups.forEach(g => {
      next[g.key] = v;
      g.lots.forEach(m => { next[`L${m.mapping_id}`] = v; next[`I${m.mapping_id}`] = v; next[`P${m.mapping_id}`] = v; });
    });
    setOpen(next);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }} className="tb-noprint">
        <Btn variant="outline" onClick={() => expandAll(true)}>กางทั้งหมด</Btn>
        <Btn variant="ghost" onClick={() => expandAll(false)}>พับทั้งหมด</Btn>
      </div>

      <Branch label={`สินค้า ${s.doc_no || ''}`} meta={s.code} tone="orange" open={open.root} onToggle={() => toggle('root')}
        badge={<Tag tone="plain">{materials.length} ล็อต · {fmtNum(s.total_weight_rm, 1)} kg</Tag>}>
        <div>
          {groups.map(g => {
            const over = g.lots.filter(m => buildDelay(m).anyOver).length;
            const f = g.lots[0];
            return (
              <Branch key={g.key} depth={1} tone={over ? 'bad' : 'blue'} open={open[g.key]} onToggle={() => toggle(g.key)}
                label={`${g.mat} · ${g.name || ''}`}
                meta={g.batch ? `Batch ${g.batch}` : 'ไม่มีรหัสรุ่น'}
                badge={<>
                  <Tag tone="plain">{g.lots.length} ล็อต</Tag>
                  {over > 0 && <Tag tone="bad">เกิน DBS {over}</Tag>}
                </>}>
                <div>
                  <Branch depth={2} tone={f.intake ? 'ok' : 'plain'}
                    label={`ผู้ขาย: ${f.supplier_name || f.supplier_code || 'ไม่พบข้อมูล'}`}
                    meta={[f.batch_date && `รับเข้า ${fmtD(f.batch_date)}`, f.intake_decision && `ผล ${f.intake_decision}`, f.fish_specie].filter(Boolean).join(' · ')}
                    badge={f.intake_defect ? <Tag tone="bad">{f.intake_defect}</Tag> : null} />
                  {g.lots.map(m => {
                    const d = buildDelay(m);
                    const lk = `L${m.mapping_id}`;
                    return (
                      <Branch key={lk} depth={2} tone={d.anyOver ? 'bad' : 'blue'} open={open[lk]} onToggle={() => toggle(lk)}
                        label={`ล็อต ${m.mapping_id}`}
                        meta={`${m.rmm_line_name || '-'} · ${fmtNum(m.weight_RM, 1)} kg · บรรจุ ${fmtDT(m.sc_pack_date)}`}
                        badge={<Tag tone={d.anyOver ? 'bad' : 'ok'}>DBS4 {fmtDur(d.value.dbs4)}</Tag>}>
                        <div>
                          <Branch depth={3} tone="ok" open={open[`I${m.mapping_id}`]} onToggle={() => toggle(`I${m.mapping_id}`)}
                            label="ส่วนผสม" meta={(m.wo_list || []).join(', ') || 'ยังไม่ผูก WO'}
                            badge={<Tag tone={m.ingredient_out_of_spec ? 'bad' : 'plain'}>{(m.ingredient_summary || []).length} ชนิด{m.ingredient_out_of_spec ? ` · หลุดพิกัด ${m.ingredient_out_of_spec}` : ''}</Tag>}>
                            {(m.ingredient_summary || []).length ? (
                              <div>
                                {m.ingredient_summary.map(gi => (
                                  <Branch key={`${gi.material_code}|${gi.batch_no}`} depth={4} tone={gi.out_of_spec_count ? 'bad' : 'ok'}
                                    label={`${gi.material_code} · ${gi.material_name || ''}`}
                                    meta={`Batch ${gi.batch_no || '-'} · ${fmtNum(gi.net_weight, 3)} kg · ${gi.basket_count} ตะกร้า`} />
                                ))}
                              </div>
                            ) : null}
                          </Branch>
                          <Branch depth={3} tone="orange" open={open[`P${m.mapping_id}`]} onToggle={() => toggle(`P${m.mapping_id}`)}
                            label="บรรจุภัณฑ์" meta={m.packaging_count ? `${m.packaging_count} รายการ` : 'ไม่พบ'}>
                            {(m.packaging || []).length ? (
                              <div>
                                {m.packaging.map(pk => (
                                  <Branch key={pk.detail_id} depth={4} tone="orange"
                                    label={`${pk.code || pk.material_no || '-'}`}
                                    meta={`Batch ${pk.batch_no || '-'} · Lot ${pk.lot_no || '-'} · ${fmtDT(pk.start_time)} → ${fmtDT(pk.stop_time)}`} />
                                ))}
                              </div>
                            ) : null}
                          </Branch>
                        </div>
                      </Branch>
                    );
                  })}
                </div>
              </Branch>
            );
          })}
        </div>
      </Branch>
    </div>
  );
};

export default TraceTree;
