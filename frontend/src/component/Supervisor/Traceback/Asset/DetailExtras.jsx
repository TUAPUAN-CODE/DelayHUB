// ส่วนเสริมของใบสอบกลับแบบ SAP: Document flow · รายการข้อยกเว้น · ประวัติการแก้ไขรายล็อต · ป้าย QR รายล็อต
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { QRCodeCanvas } from 'qrcode.react';
import { RemarkCsLine } from '../../../Layout/RemarkCs';
import { T } from './tracebackUI';
import { Tag, Card, Btn, Segmented, SimpleTable, Spinner } from './TraceAtoms';
import { fmtDT, fmtD, fmtNum, uniq, exceptionList, EXCEPTION_LABEL } from './tracebackCore';

const API_URL = import.meta.env.VITE_API_URL;

/* ═══ Document flow: ห่วงโซ่เอกสารตั้งแต่รับเข้าจนบรรจุ ═══════════════════ */
export const DocumentFlow = ({ data, onForward }) => {
  const steps = useMemo(() => {
    const s = data.summary || {};
    const materials = data.materials || [];
    const guides = uniq(materials.flatMap(m => String(m.guide_numbers || m.intake?.guide_numbers || '').split(',').map(x => x.trim())));
    const insp = uniq(materials.map(m => m.intake_inspection_lot || m.intake?.inspection_lot));
    const batches = uniq(materials.map(m => m.batch_before));
    const wos = uniq(materials.flatMap(m => m.wo_list || []));
    const ingBatches = uniq(materials.flatMap(m => (m.ingredient_summary || []).map(g => g.batch_no)));
    const pkgRows = data.packaging_rows || [];
    const slips = uniq(pkgRows.flatMap(p => p.slip_ids || []).map(String));
    const reports = uniq((data.materials || []).flatMap(m => (m.packaging || []).map(p => p.report_id)).map(String));
    return [
      { no: 1, title: 'ใบรับของจากผู้ขาย (Goods receipt)', docs: guides, hint: (s.supplier_list || []).join(', '), tone: 'blue' },
      { no: 2, title: 'ล็อตตรวจรับ (Inspection lot)', docs: insp, hint: uniq(materials.map(m => m.intake_decision)).join(', '), tone: 'blue' },
      { no: 3, title: 'รหัสรุ่นวัตถุดิบ (Batch)', docs: batches, hint: `${materials.length} ล็อตในโรงงาน`, tone: 'orange', type: 'rm' },
      { no: 4, title: 'ใบสั่งชั่งส่วนผสม (WO)', docs: wos, hint: `${ingBatches.length} Batch ส่วนผสม`, tone: 'blue' },
      { no: 5, title: 'Batch ส่วนผสม', docs: ingBatches, hint: '', tone: 'orange', type: 'ing' },
      { no: 6, title: 'เอกสารผลิต (Production order)', docs: [s.doc_no].filter(Boolean), hint: s.code, tone: 'blue' },
      { no: 7, title: 'รายงานใช้บรรจุภัณฑ์ / ใบเบิก', docs: [...reports.map(r => `รายงาน ${r}`), ...slips.map(x => `Slip ${x}`)], hint: `${pkgRows.length} ชนิดบรรจุภัณฑ์`, tone: 'blue' },
      { no: 8, title: 'Batch / Lot บรรจุภัณฑ์', docs: uniq(pkgRows.flatMap(p => [p.batch_no, p.lot_no])), hint: '', tone: 'orange', type: 'pkg' },
    ];
  }, [data]);

  return (
    <div>
      <div style={{ fontSize: 12.5, color: T.text2, marginBottom: 10 }}>
        ห่วงโซ่เอกสารทั้งหมดของการผลิตนี้ (แบบ Document flow ของ SAP) · กดรหัสสีส้มเพื่อสอบไปข้างหน้าข้ามเอกสาร
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {steps.map((st, i) => (
          <div key={st.no} style={{ display: 'grid', gridTemplateColumns: '36px 1fr', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ width: 28, height: 28, borderRadius: 14, background: st.docs.length ? (st.tone === 'orange' ? T.orange : T.blue) : T.line, color: T.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>{st.no}</span>
              {i < steps.length - 1 && <span style={{ flex: 1, width: 2, background: T.line, minHeight: 18 }} />}
            </div>
            <div style={{ paddingBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: T.blueDeep }}>{st.title} {st.hint ? <span style={{ fontWeight: 400, color: T.text2, fontSize: 12 }}>· {st.hint}</span> : null}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 5 }}>
                {st.docs.length ? st.docs.slice(0, 40).map(d => (st.type && onForward
                  ? <button key={d} type="button" onClick={() => onForward(d, st.type)} style={{ border: `1px solid ${T.orangeLine}`, background: T.orangeSoft, color: T.orange, borderRadius: 6, padding: '2px 9px', fontSize: 12, cursor: 'pointer', fontFamily: 'ui-monospace,monospace', fontWeight: 600 }} title="สอบไปข้างหน้า">{d} ↗</button>
                  : <Tag key={d} tone="plain">{d}</Tag>)) : <span style={{ fontSize: 12, color: T.text2 }}>ไม่มีเอกสารบันทึก</span>}
                {st.docs.length > 40 && <Tag tone="plain">…อีก {st.docs.length - 40}</Tag>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ═══ รายการข้อยกเว้นรวม ═══════════════════════════════════════════════════ */
export const ExceptionsPanel = ({ materials }) => {
  const all = useMemo(() => exceptionList(materials), [materials]);
  const [kind, setKind] = useState('all');
  const kinds = useMemo(() => uniq(all.map(x => x.kind)), [all]);
  const rows = kind === 'all' ? all : all.filter(x => x.kind === kind);
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <Segmented value={kind} onChange={setKind} options={[{ value: 'all', label: `ทั้งหมด (${all.length})` }, ...kinds.map(k => ({ value: k, label: `${EXCEPTION_LABEL[k]} (${all.filter(x => x.kind === k).length})` }))]} />
      </div>
      <SimpleTable
        rows={rows} getKey={(x, i) => `${x.m.mapping_id}-${x.kind}-${i}`}
        rowTone={x => (x.severity >= 3 ? 'bad' : x.severity === 2 ? 'orange' : null)}
        empty="ไม่พบข้อยกเว้น — บันทึกครบและอยู่ในเกณฑ์"
        columns={[
          { key: 'sev', label: 'ระดับ', render: x => <Tag tone={x.severity >= 3 ? 'bad' : x.severity === 2 ? 'orange' : 'plain'}>{x.severity >= 3 ? 'สูง' : x.severity === 2 ? 'กลาง' : 'ต่ำ'}</Tag> },
          { key: 'label', label: 'ข้อยกเว้น', render: x => <b>{x.label}</b> },
          { key: 'detail', label: 'รายละเอียด', wrap: true },
          { key: 'lot', label: 'ล็อต', render: x => `#${x.m.mapping_id}` },
          { key: 'mat', label: 'วัตถุดิบ', wrap: true, render: x => `${x.m.mat} · ${x.m.mat_name || ''}` },
          { key: 'batch', label: 'Batch', render: x => x.m.batch_before || '—' },
          { key: 'exp', label: 'วันหมดอายุ', render: x => (x.m.expiration_date ? fmtD(x.m.expiration_date) : '—') },
          { key: 'line', label: 'ไลน์', render: x => x.m.rmm_line_name || '—' },
        ]}
      />
    </div>
  );
};

/* ═══ ประวัติการแก้ไขข้อมูลของล็อต (Audit trail / Change document) ═══════════ */
export const LotAudit = ({ mappingId }) => {
  const [st, setSt] = useState({ loading: true, rows: [], error: '' });
  useEffect(() => {
    let cancel = false;
    axios.get(`${API_URL}/api/sheet/edit-log`, { params: { mapping_id: mappingId } })
      .then(r => { if (!cancel) setSt({ loading: false, rows: r.data?.data || [], error: '' }); })
      .catch(e => {
        console.error('Lot audit error:', e);
        if (!cancel) setSt({ loading: false, rows: [], error: e.response?.status === 403 ? 'ดูประวัติการแก้ไขได้เฉพาะหัวหน้า (Supervisor / Master)' : (e.response?.data?.error || e.message) });
      });
    return () => { cancel = true; };
  }, [mappingId]);
  if (st.loading) return <Spinner />;
  if (st.error) return <Tag tone="orange">{st.error}</Tag>;
  return (
    <SimpleTable
      rows={st.rows} getKey={r => r.edit_id} empty="ไม่มีการแก้ไขข้อมูลของล็อตนี้"
      columns={[
        { key: 'edited_at', label: 'เวลา', render: r => fmtDT(r.edited_at) },
        { key: 'username', label: 'ผู้แก้ไข' },
        { key: 'column_name', label: 'ข้อมูล', render: r => `${r.table_name}.${r.column_name}` },
        { key: 'old_value', label: 'ค่าเดิม', wrap: true },
        { key: 'new_value', label: 'ค่าใหม่', wrap: true },
        { key: 'reason', label: 'เหตุผล', wrap: true },
      ]}
    />
  );
};

/* ═══ ป้าย QR รายล็อต (พิมพ์ติดภาชนะ / เอกสาร) ════════════════════════════ */
export const QrLabelsDialog = ({ open, onClose, data, linkBase }) => {
  if (!open) return null;
  const materials = data.materials || [];
  const s = data.summary || {};
  return (
    <div className="tb-qr-wrap" style={{ position: 'fixed', inset: 0, background: 'rgba(15,39,64,.45)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .tb-qr-print, .tb-qr-print * { visibility: visible !important; }
          .tb-qr-print { position: absolute; left: 0; top: 0; width: 100%; }
          .tb-qr-noprint { display: none !important; }
        }`}</style>
      <div style={{ background: T.white, borderRadius: 14, width: 'min(960px,96vw)', maxHeight: '92vh', overflow: 'auto' }}>
        <div className="tb-qr-noprint" style={{ background: T.blue, color: T.white, padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <b>ป้าย QR รายล็อต ({materials.length} ป้าย)</b>
          <span style={{ display: 'flex', gap: 8 }}>
            <Btn variant="outline" onClick={() => window.print()}>พิมพ์</Btn>
            <Btn variant="ghost" onClick={onClose}>ปิด</Btn>
          </span>
        </div>
        <div className="tb-qr-print" style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 10 }}>
          {materials.map(m => (
            <div key={m.mapping_id} style={{ border: '1px dashed #888', borderRadius: 8, padding: 8, display: 'flex', gap: 8, alignItems: 'center', breakInside: 'avoid' }}>
              <QRCodeCanvas value={`${linkBase}${encodeURIComponent(s.doc_no || '')}&code=${encodeURIComponent(s.code || '')}#lot-${m.mapping_id}`} size={84} level="M" />
              <div style={{ fontSize: 11, lineHeight: 1.45, color: '#000', minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>#{m.mapping_id} · {m.mat}</div>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.mat_name}</div>
                <div style={{ fontFamily: 'ui-monospace,monospace' }}>Batch {m.batch_before || '-'}</div>
                <div>{fmtNum(m.weight_RM, 1)} kg · {m.rmm_line_name || '-'}</div>
                <div>{s.doc_no}</div>
                <RemarkCsLine mappingId={m.mapping_id} style={{ margin: 0 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ═══ สถานะกักของเอกสาร (แสดงเป็นแถบเตือน) ═══════════════════════════════ */
export const HoldBanner = ({ docNo, refreshKey }) => {
  const [holds, setHolds] = useState([]);
  useEffect(() => {
    if (!docNo) return undefined;
    let cancel = false;
    axios.get(`${API_URL}/api/traceback/holds`, { params: { status: 'HOLD', doc_no: docNo } })
      .then(r => { if (!cancel) setHolds(r.data?.data || []); })
      .catch(e => console.error('Hold banner error:', e));
    return () => { cancel = true; };
  }, [docNo, refreshKey]);
  if (!holds.length) return null;
  return (
    <Card title={`⛔ เอกสารนี้ถูกกักสินค้าอยู่ (${holds.length} รายการ)`} tone="orange">
      {holds.map(h => <div key={h.hold_id} style={{ fontSize: 13 }}>#{h.hold_id} · {h.reason} · โดย {h.created_by || '-'} {fmtDT(h.created_at)}</div>)}
    </Card>
  );
};
