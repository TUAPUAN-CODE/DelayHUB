import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';

import { fmtD, fmtRange, fmtNum, uniq, buildDelay, scopeToParams, scopeTitle } from './tracebackCore';
import { RemarkCsGroupText, SortableTh } from './TraceAtoms';
import useTableSort from './tableSort';
import useRemarkCsByBatch from './useRemarkCsByBatch';
import { T } from './tracebackUI';

axios.defaults.withCredentials = true;
const API_URL = import.meta.env.VITE_API_URL;

// ใบสอบกลับ (แสดงในหน้าหลักใต้ผลการค้นหา): ตัวกรอง + ตารางข้อมูล วัตถุดิบ/Remark CS ตาม HU/ส่วนผสม/บรรจุภัณฑ์ — สีชุดเดียวกับทั้งหน้า (tracebackUI)

/* ═══ อะตอม UI ════════════════════════════════════════════════════════════ */
const Txt = ({ children, c = T.text, size = 12.5, weight = 400, style }) => (
  <span style={{ color: c, fontSize: size, fontWeight: weight, ...style }}>{children}</span>
);

const Tag = ({ children, tone = 'blue', title }) => {
  const map = {
    blue: [T.blueSoft, T.blueDeep, T.blueLine],
    orange: [T.orangeSoft, T.orange, T.orangeLine],
    ok: [T.okSoft, T.ok, T.okLine],
    bad: [T.badSoft, T.bad, T.badLine],
    plain: [T.white, T.text2, T.line],
  }[tone] || [T.blueSoft, T.blueDeep, T.blueLine];
  return (
    <span title={title} style={{
      display: 'inline-block', fontSize: 11.5, fontWeight: 500, padding: '2px 9px',
      borderRadius: 6, background: map[0], color: map[1], border: `1px solid ${map[2]}`,
      whiteSpace: 'nowrap',
    }}>{children}</span>
  );
};

const SearchSelect = ({ label, value, onChange, options = [], placeholder = 'ทั้งหมด', width = 190 }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setQ(''); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const list = useMemo(() => {
    const opts = options.map(o => (typeof o === 'string' ? { value: o, label: o } : o));
    if (!q) return opts;
    const k = q.toLowerCase();
    return opts.filter(o => String(o.label).toLowerCase().includes(k) || String(o.value).toLowerCase().includes(k));
  }, [options, q]);

  const current = useMemo(() => {
    const opts = options.map(o => (typeof o === 'string' ? { value: o, label: o } : o));
    return opts.find(o => String(o.value) === String(value));
  }, [options, value]);

  return (
    <div ref={ref} style={{ position: 'relative', width }}>
      {label && <div style={{ fontSize: 11.5, color: T.blueDeep, fontWeight: 500, marginBottom: 4 }}>{label}</div>}
      <div onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
          height: 38, padding: '0 11px', borderRadius: 9, cursor: 'pointer', background: T.white,
          border: `1.5px solid ${value ? T.blue : T.line}`,
          color: value ? T.text : T.text2, fontSize: 13, fontWeight: value ? 500 : 400,
        }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {current?.label || value || placeholder}
        </span>
        <span style={{ color: T.blue, fontSize: 11 }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
          background: T.white, border: `1.5px solid ${T.blue}`, borderRadius: 10,
          boxShadow: '0 10px 28px rgba(11,95,165,0.18)', overflow: 'hidden',
        }}>
          <div style={{ padding: 8, borderBottom: `1px solid ${T.line}` }}>
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="พิมพ์เพื่อค้นหา..."
              style={{
                width: '100%', height: 32, padding: '0 10px', borderRadius: 7, fontSize: 12.5,
                border: `1px solid ${T.blueLine}`, outline: 'none', color: T.text, background: T.bg,
                fontFamily: 'inherit', boxSizing: 'border-box',
              }} />
          </div>
          <div style={{ maxHeight: 250, overflowY: 'auto' }}>
            {value && (
              <div onClick={() => { onChange(''); setOpen(false); setQ(''); }}
                style={{ padding: '9px 12px', fontSize: 12.5, color: T.orange, fontWeight: 500, cursor: 'pointer', borderBottom: `1px solid ${T.line}` }}>
                ✕ ล้างตัวเลือก
              </div>
            )}
            {list.length ? list.map((o, i) => (
              <div key={i} onClick={() => { onChange(o.value); setOpen(false); setQ(''); }}
                style={{
                  padding: '9px 12px', fontSize: 12.5, cursor: 'pointer', fontWeight: 400,
                  color: String(o.value) === String(value) ? T.blueDeep : T.text,
                  background: String(o.value) === String(value) ? T.blueSoft : T.white,
                  borderBottom: i < list.length - 1 ? `1px solid ${T.line}` : 'none',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = T.blueSoft; }}
                onMouseLeave={e => { e.currentTarget.style.background = String(o.value) === String(value) ? T.blueSoft : T.white; }}>
                {o.label}
                {o.meta && <span style={{ color: T.text2, fontSize: 11, marginLeft: 6 }}>{o.meta}</span>}
              </div>
            )) : (
              <div style={{ padding: '16px 12px', fontSize: 12.5, color: T.text2, textAlign: 'center', fontWeight: 400 }}>ไม่พบข้อมูล</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const FilterBar = ({ children, onClear, count }) => (
  <div style={{
    display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end',
    background: T.blueSoft, border: `1px solid ${T.blueLine}`, borderRadius: 12,
    padding: '12px 14px', marginBottom: 14,
  }} className="tb-noprint">
    {children}
    <button onClick={onClear} style={{
      height: 38, padding: '0 16px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
      background: T.white, border: `1.5px solid ${T.orange}`, color: T.orange, fontSize: 13, fontWeight: 500,
    }}>ล้างตัวกรอง</button>
    {count != null && (
      <div style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: 13, fontWeight: 600, color: T.blueDeep }}>
        แสดง {count} รายการ
      </div>
    )}
  </div>
);

/* ═══ ตาราง ═══════════════════════════════════════════════════════════════ */
const DataTable = ({ columns, rows: rawRows, getKey, renderExpanded, empty = 'ไม่มีข้อมูล', rowTone }) => {
  const [open, setOpen] = useState({});
  const { sorted: rows, sort, toggle } = useTableSort(rawRows, columns);
  if (!rawRows?.length) {
    return (
      <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: 20, background: T.white, fontSize: 13, color: T.text2, fontWeight: 400 }}>
        {empty}
      </div>
    );
  }
  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, overflowX: 'auto', background: T.white }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {renderExpanded && <th style={{ ...THS, width: 34 }} />}
            {columns.map(c => <SortableTh key={c.key} col={c} rows={rawRows} sort={sort} onToggle={toggle} style={THS} />)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const k = getKey ? getKey(r, i) : i;
            const isOpen = !!open[k];
            const tone = rowTone?.(r);
            const bg = tone === 'bad' ? T.badSoft : tone === 'orange' ? T.orangeSoft : (i % 2 ? T.bg : T.white);
            return (
              <React.Fragment key={k}>
                <tr onClick={renderExpanded ? () => setOpen(p => ({ ...p, [k]: !p[k] })) : undefined}
                  style={{ background: bg, cursor: renderExpanded ? 'pointer' : 'default' }}>
                  {renderExpanded && (
                    <td style={{ ...TDS, textAlign: 'center', color: T.blue, fontWeight: 700 }}>{isOpen ? '▾' : '▸'}</td>
                  )}
                  {columns.map(c => (
                    <td key={c.key} style={{ ...TDS, textAlign: c.align || 'left', whiteSpace: c.wrap ? 'normal' : 'nowrap', minWidth: c.minWidth }}>
                      {c.render ? c.render(r, i) : (r[c.key] === 0 || r[c.key] ? r[c.key] : '—')}
                    </td>
                  ))}
                </tr>
                {isOpen && renderExpanded && (
                  <tr>
                    <td colSpan={columns.length + 1} style={{ padding: '4px 16px 18px 42px', background: T.bg, borderBottom: `1px solid ${T.line}` }}>
                      {renderExpanded(r)}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const THS = {
  background: T.blue, color: T.white, fontSize: 12.5, fontWeight: 600,
  padding: '10px 12px', whiteSpace: 'nowrap', position: 'sticky', top: 0,
  borderRight: '1px solid rgba(255,255,255,0.18)',
};
const TDS = {
  fontSize: 12.5, color: T.text, fontWeight: 400, padding: '9px 12px',
  borderBottom: `1px solid ${T.line}`, borderRight: `1px solid ${T.line}`,
};

const SectionTitle = ({ no, title, hint, count }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', margin: '26px 0 12px' }}>
    <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <span style={{
        width: 24, height: 24, borderRadius: 7, background: T.orange, color: T.white,
        fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>{no}</span>
      <span style={{ fontSize: 15, fontWeight: 700, color: T.blueDeep }}>{title}</span>
      {count != null && <Tag tone="plain">{count} รายการ</Tag>}
    </span>
    {hint && <span style={{ fontSize: 12, color: T.text2, fontWeight: 400 }}>{hint}</span>}
  </div>
);

/* ═══ แท็บ 1 — ชั้นสรุป ═══════════════════════════════════════════════════ */
const SummaryTab = ({ data }) => {
  const materials = useMemo(() => data.materials || [], [data]);
  const [f, setF] = useState({ mat: '', mat2x: '', batch: '', batch2x: '', line: '', supplier: '', status: '' });
  const clear = () => setF({ mat: '', mat2x: '', batch: '', batch2x: '', line: '', supplier: '', status: '' });

  const enriched = useMemo(() => materials.map(m => ({ ...m, _d: buildDelay(m) })), [materials]);

  const shown = useMemo(() => enriched.filter(m => (
    (!f.mat || m.mat === f.mat)
    && (!f.mat2x || m.mat_2x === f.mat2x)
    && (!f.batch || m.batch_before === f.batch)
    && (!f.batch2x || m.batch_after === f.batch2x)
    && (!f.line || m.rmm_line_name === f.line)
    && (!f.supplier || m.supplier_name === f.supplier)
    && (!f.status || (f.status === 'over' ? m._d.anyOver
      : f.status === 'nointake' ? !m.intake
      : f.status === 'defect' ? !!m.intake_defect
      : !m._d.anyOver))
  )), [enriched, f]);

  const rmRows = useMemo(() => {
    const map = new Map();
    shown.forEach(m => {
      const k = `${m.mat}|${m.batch_before}`;
      if (!map.has(k)) {
        map.set(k, {
          key: k, mat: m.mat, mat_2x: m.mat_2x, mat_name: m.mat_name,
          batch: m.batch_before, batch_2x: m.batch_after,
          supplier: m.supplier_name || m.supplier_code,
          batch_date: m.batch_date, decision: m.intake_decision,
          defect: m.intake_defect, temp_avg: m.intake_temp_avg,
          has_intake: !!m.intake,
          group: m.rm_group_name, lots: [], weight: 0, over: 0,
        });
      }
      const e = map.get(k);
      e.lots.push(m); e.weight += Number(m.weight_RM) || 0;
      if (m._d.anyOver) e.over++;
    });
    return [...map.values()];
  }, [shown]);

  const remarkBatches = useMemo(() => [...new Set(rmRows.map(r => r.batch).filter(Boolean))], [rmRows]);
  const remarkByHu = useRemarkCsByBatch(remarkBatches);

  const ingRows = useMemo(() => {
    const map = new Map();
    shown.forEach(m => (m.ingredient_summary || []).forEach(g => {
      const k = `${g.material_code}|${g.batch_no || ''}`;
      if (!map.has(k)) map.set(k, { key: k, ...g, net: 0, baskets: 0, oos: 0, lots: [] });
      const e = map.get(k);
      e.net += g.net_weight || 0; e.baskets += g.basket_count || 0; e.oos += g.out_of_spec_count || 0;
      if (!e.lots.includes(m)) e.lots.push(m);
    }));
    return [...map.values()].sort((a, b) => b.net - a.net);
  }, [shown]);

  const pkgRows = useMemo(() => {
    const map = new Map();
    shown.forEach(m => (m.packaging || []).forEach(p => {
      const k = `${p.code}|${p.lot_no}|${p.batch_no}`;
      if (!map.has(k)) map.set(k, { key: k, ...p, lots: [], details: new Set() });
      const e = map.get(k);
      if (!e.lots.includes(m)) e.lots.push(m);
      e.details.add(p.detail_id);
    }));
    return [...map.values()];
  }, [shown]);


  return (
    <div>
      <FilterBar onClear={clear} count={shown.length}>
        <SearchSelect label="รหัสวัตถุดิบ (Mat)" value={f.mat} onChange={v => setF(p => ({ ...p, mat: v }))}
          options={uniq(materials.map(m => m.mat))} width={165} />
        <SearchSelect label="รหัสวัตถุดิบ 2x (Mat 2x)" value={f.mat2x} onChange={v => setF(p => ({ ...p, mat2x: v }))}
          options={uniq(materials.map(m => m.mat_2x))} width={175} />
        <SearchSelect label="รหัสรุ่น (Batch)" value={f.batch} onChange={v => setF(p => ({ ...p, batch: v }))}
          options={uniq(materials.map(m => m.batch_before))} width={175} />
        <SearchSelect label="รหัสรุ่น 2x (Batch 2x)" value={f.batch2x} onChange={v => setF(p => ({ ...p, batch2x: v }))}
          options={uniq(materials.map(m => m.batch_after))} width={180} />
        <SearchSelect label="ไลน์ผลิต" value={f.line} onChange={v => setF(p => ({ ...p, line: v }))}
          options={uniq(materials.map(m => m.rmm_line_name))} width={140} />
        <SearchSelect label="ผู้ขาย" value={f.supplier} onChange={v => setF(p => ({ ...p, supplier: v }))}
          options={uniq(materials.map(m => m.supplier_name))} width={215} />
        <SearchSelect label="สถานะ" value={f.status} onChange={v => setF(p => ({ ...p, status: v }))} width={195}
          options={[
            { value: 'over', label: 'ดีเลย์เกินมาตรฐาน' },
            { value: 'ok', label: 'ดีเลย์อยู่ในมาตรฐาน' },
            { value: 'defect', label: 'มีข้อบกพร่องตอนรับเข้า' },
            { value: 'nointake', label: 'ไม่พบในระบบรับเข้า' },
          ]} />
      </FilterBar>

      {/* แถวในตารางชั้นสรุปไม่ขยายรายละเอียดเมื่อคลิก — ต้องกดปุ่ม "ดูเส้นทาง" เท่านั้น */}
      <SectionTitle no="1" title="วัตถุดิบและรหัสรุ่น" count={rmRows.length} />
      <DataTable
        rows={rmRows} getKey={r => r.key}
        columns={[
          { key: 'mat', label: 'Mat', render: r => <b>{r.mat}</b> },
          { key: 'mat_2x', label: 'Mat 2x', render: r => (r.mat_2x ? <Tag tone={r.mat_2x === r.mat ? 'plain' : 'orange'}>{r.mat_2x}</Tag> : '—') },
          { key: 'mat_name', label: 'ชื่อวัตถุดิบ', wrap: true, minWidth: 180 },
          { key: 'batch', label: 'Batch', render: r => <span style={{ fontFamily: 'ui-monospace,monospace', fontWeight: 600 }}>{r.batch || '—'}</span> },
          { key: 'batch_2x', label: 'Batch 2x', render: r => (r.batch_2x
              ? <span style={{ fontFamily: 'ui-monospace,monospace', fontWeight: 600, color: r.batch_2x === r.batch ? T.text2 : T.orange }}>{r.batch_2x}</span>
              : '—') },
          { key: 'remark_cs', label: 'Remark CS', render: r => <RemarkCsGroupText lots={r.lots} />, wrap: true, minWidth: 150 },
          { key: 'batch_date', label: 'วันที่ล็อต (รับเข้า)', render: r => (r.batch_date ? fmtD(r.batch_date) : '—') },
          { key: 'decision', label: 'ผลตรวจรับเข้า',
            render: r => (r.has_intake
              ? <Tag tone={r.decision === 'A01' ? 'ok' : 'orange'}>{r.decision || '—'}</Tag>
              : <Tag tone="orange">ไม่พบในระบบรับ</Tag>) },
          { key: 'temp_avg', label: 'อุณหภูมิ', align: 'right',
            render: r => (r.temp_avg != null ? `${r.temp_avg} °C` : '—') },
          { key: 'defect', label: 'ข้อบกพร่อง', wrap: true, minWidth: 150,
            render: r => (r.defect ? <Tag tone="bad">{r.defect}</Tag> : '—') },
          { key: 'supplier', label: 'ผู้ขาย', wrap: true, minWidth: 130 },
          { key: 'weight', label: 'น้ำหนัก (kg)', align: 'right', render: r => fmtNum(r.weight, 1) },
        ]}
      />

      <SectionTitle no="1.1" title="Remark CS แยกตาม HU" count={remarkByHu.rows.length} hint="1 Batch มีได้หลาย HU — แต่ละ HU มี Remark CS ของตัวเอง กดแถวเพื่อดูประวัติว่าใครพิมพ์/แก้เมื่อไร" />
      {remarkByHu.error && <div style={{ fontSize: 12.5, color: T.bad, marginBottom: 6 }}>{remarkByHu.error}</div>}
      <DataTable
        rows={remarkByHu.rows} getKey={r => `${r.batch}|${r.hu}`} empty={remarkByHu.loading ? 'กำลังโหลด...' : 'ไม่พบ HU ของ Batch นี้ในระบบรับเข้า'}
        columns={[
          { key: 'batch', label: 'Batch', render: r => <span style={{ fontFamily: 'ui-monospace,monospace', fontWeight: 600 }}>{r.batch}</span> },
          { key: 'hu', label: 'HU', render: r => <b>{r.hu}</b> },
          { key: 'remark_cs', label: 'Remark CS', render: r => (r.remark_cs ? <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{r.remark_cs}</span> : '—'), wrap: true, minWidth: 200 },
          { key: 'lots', label: 'ล็อตที่ใช้ HU นี้', render: r => (r.mapping_ids.length ? r.mapping_ids.length : '—') },
          { key: 'last', label: 'แก้ล่าสุด', render: r => (r.history[0] ? `${r.history[0].username || '-'} · ${r.history[0].created_at}` : '—'), wrap: true, minWidth: 170 },
        ]}
        renderExpanded={r => (
          <div style={{ padding: '8px 12px', fontSize: 12.5, display: 'grid', gap: 4 }}>
            <div><b>mapping_id ที่ใช้ HU นี้:</b> {r.mapping_ids.length ? r.mapping_ids.join(', ') : '—'}</div>
            {r.history.length === 0 && <div style={{ color: T.text2 }}>ยังไม่มีประวัติการพิมพ์/แก้ Remark CS (เริ่มเก็บประวัติตั้งแต่วันที่เปิดใช้ฟีเจอร์นี้)</div>}
            {r.history.map(h => (
              <div key={h.log_id}>
                {h.created_at} · {h.username || '-'} · {h.source || '-'}: {h.old_value ?? '(ว่าง)'} → <b>{h.new_value ?? '(ว่าง)'}</b>
              </div>
            ))}
          </div>
        )}
      />

      <SectionTitle no="2" title="ส่วนผสม (Ingredient)" count={ingRows.length} />
      <DataTable
        rows={ingRows} getKey={r => r.key}
        columns={[
          { key: 'material_code', label: 'รหัส', render: r => <b>{r.material_code}</b> },
          { key: 'material_name', label: 'ชื่อส่วนผสม', wrap: true, minWidth: 190 },
          { key: 'batch_no', label: 'Batch' },
          { key: 'supplier', label: 'ผู้ขาย', wrap: true, minWidth: 150, render: r => r.intake?.supplier_name || '—', sortValue: r => r.intake?.supplier_name || null },
          { key: 'received', label: 'วันที่รับเข้า', render: r => ((r.intake?.receive_first || r.intake?.batch_date) ? fmtD(r.intake.receive_first || r.intake.batch_date) : '—'), sortValue: r => r.intake?.receive_first || r.intake?.batch_date || null },
          { key: 'expire', label: 'วันหมดอายุ', render: r => (r.intake?.expiration_date ? fmtD(r.intake.expiration_date) : '—'), sortValue: r => r.intake?.expiration_date || null },
          { key: 'net', label: 'น้ำหนักรวม (kg)', align: 'right', render: r => fmtNum(r.net, 3) },
          { key: 'std_weight', label: 'มาตรฐาน/ตะกร้า', align: 'right', render: r => fmtNum(r.std_weight, 3) },
          { key: 'baskets', label: 'ตะกร้า', align: 'right' },
          { key: 'oos', label: 'หลุดพิกัด', align: 'right', render: r => (r.oos ? <Tag tone="bad">{r.oos}</Tag> : <Tag tone="ok">ครบ</Tag>) },
        ]}
      />

      <SectionTitle no="3" title="บรรจุภัณฑ์ (Packaging)" count={pkgRows.length} />
      <DataTable
        rows={pkgRows} getKey={r => r.key}
        columns={[
          { key: 'code', label: 'Code', render: r => <b>{r.code || r.material_no}</b> },
          { key: 'material_no', label: 'Material No' },
          { key: 'batch_no', label: 'Batch' },
          { key: 'lot_no', label: 'Lot' },
          { key: 'supplier', label: 'ผู้ขาย', wrap: true, minWidth: 150, render: r => r.intake?.supplier_name || '—', sortValue: r => r.intake?.supplier_name || null },
          { key: 'received', label: 'วันที่รับเข้า', render: r => ((r.intake?.receive_first || r.intake?.batch_date) ? fmtD(r.intake.receive_first || r.intake.batch_date) : '—'), sortValue: r => r.intake?.receive_first || r.intake?.batch_date || null },
          { key: 'expire', label: 'วันหมดอายุ', render: r => (r.intake?.expiration_date ? fmtD(r.intake.expiration_date) : '—'), sortValue: r => r.intake?.expiration_date || null },
          { key: 'line_name', label: 'ไลน์', render: r => r.report_line_name || r.line_name || '—' },
          { key: 'produce_date', label: 'วันที่ผลิต (โรงงานบรรจุภัณฑ์)', render: r => (r.produce_date ? fmtD(r.produce_date) : '—') },
          { key: 'use', label: 'ช่วงใช้บนไลน์', render: r => fmtRange(r.start_time, r.stop_time) },
          { key: 'lots', label: 'ล็อตที่ใช้', align: 'right', render: r => r.lots.length },
        ]}
      />
    </div>
  );
};


/* ═══ ตัวหลัก — แสดงเฉพาะข้อมูล: ตัวกรอง + ตาราง (ไม่มีหัวเอกสาร/แท็บ/การ์ดวิเคราะห์/ปุ่มส่งออก) ═══ */
const TracebackDetailView = ({ docNo, code, scope = null, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const scopeKey = useMemo(() => (scope ? JSON.stringify(scope) : ''), [scope]); // ใช้เป็น dependency (scope เป็น object ใหม่ทุกครั้งที่ render)

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setLoading(true); setError(null); setData(null);
        const res = await axios.get(`${API_URL}/api/traceback/detail`, { params: scopeKey ? scopeToParams(JSON.parse(scopeKey)) : { doc_no: docNo, code } });
        if (!cancel) setData(res.data?.data || null);
      } catch (e) {
        console.error('Traceback detail error:', e);
        if (!cancel) setError(e.response?.data?.error || e.message);
      } finally { if (!cancel) setLoading(false); }
    })();
    return () => { cancel = true; };
  }, [docNo, code, scopeKey]);

  const s = data?.summary || {};
  const title = scope && !docNo ? scopeTitle(scope) : [docNo, code || s.code].filter(Boolean).join(' · ');

  return (
    <div id="tb-detail" style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: 12, padding: '12px 14px 18px', marginTop: 12 }}>
      <style>{`@keyframes tbSpin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: T.blueDeep }}>{title}{data ? ` · ${s.material_count} ล็อต` : ''}</div>
        {onClose && <button onClick={onClose} aria-label="ปิด" style={{ border: `1px solid ${T.line}`, background: T.white, color: T.text2, borderRadius: 8, height: 30, padding: '0 12px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5 }}>✕ ปิด</button>}
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 160, gap: 12 }}>
          <div style={{ width: 24, height: 24, border: `3px solid ${T.blueLine}`, borderTop: `3px solid ${T.blue}`, borderRadius: '50%', animation: 'tbSpin 0.7s linear infinite' }} />
          <Txt c={T.blueDeep} size={14} weight={600}>กำลังรวบรวมข้อมูลจากทุกระบบ...</Txt>
        </div>
      )}
      {error && !loading && (
        <div style={{ background: T.badSoft, border: `1.5px solid ${T.badLine}`, borderRadius: 11, padding: 14, color: T.bad, fontSize: 14, fontWeight: 500 }}>โหลดข้อมูลไม่สำเร็จ: {error}</div>
      )}
      {!loading && !error && data && <SummaryTab data={data} />}
    </div>
  );
};

export default TracebackDetailView;
