// สอบกลับไปข้างหน้า (Trace Forward / Impact Analysis)
//   สแกนหรือพิมพ์รหัสรุ่นวัตถุดิบ / ส่วนผสม / Lot บรรจุภัณฑ์ → สินค้าทุกเอกสารที่ได้รับผลกระทบ
//   แยก "บรรจุแล้ว" กับ "ยังอยู่ในกระบวนการ (กักได้ทันที)" เพื่อใช้ตัดสินใจเรียกคืน/กักสินค้า
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import axios from 'axios';
import { T, TYPE_LABEL, inputCss } from './tracebackUI';
import { Tag, Kpi, Card, Btn, Segmented, SimpleTable, Spinner } from './TraceAtoms';
import { fmtDT, fmtNum, fmtDur, readRecent, pushRecent } from './tracebackCore';
import { exportForwardExcel, exportForwardPDF } from './tracebackExport';

const API_URL = import.meta.env.VITE_API_URL;

const TYPE_OPTIONS = ['auto', 'rm', 'ing', 'pkg'].map(v => ({ value: v, label: TYPE_LABEL[v] }));
const LOT_FILTERS = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'packed', label: 'บรรจุแล้ว' },
  { value: 'wip', label: 'ยังอยู่ในกระบวนการ' },
];

const ForwardTrace = ({ initialCode = '', initialType = 'auto', onOpenRecord, onStartRecall, onQueryChange }) => {
  const [code, setCode] = useState(initialCode);
  const [type, setType] = useState(initialType);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lotFilter, setLotFilter] = useState('all');
  const [recent, setRecent] = useState(() => readRecent().filter(r => r.kind === 'fwd'));
  const inputRef = useRef(null);

  const run = useCallback(async (c = code, t = type) => {
    const q = String(c || '').trim();
    if (!q) { setError('กรุณาสแกนหรือพิมพ์รหัสรุ่น / Lot'); inputRef.current?.focus(); return; }
    try {
      setLoading(true); setError(''); setData(null);
      const res = await axios.get(`${API_URL}/api/traceback/forward`, { params: { code: q, type: t } });
      setData(res.data?.data || null);
      setRecent(pushRecent({ kind: 'fwd', code: q, type: t }).filter(r => r.kind === 'fwd'));
      onQueryChange?.({ code: q, type: t });
    } catch (e) {
      console.error('Trace forward error:', e);
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, [code, type, onQueryChange]);

  // เปิดจากลิงก์ (?mode=forward&code=...) → ค้นหาทันที
  useEffect(() => {
    if (initialCode) run(initialCode, initialType);
    else inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lots = useMemo(() => (data?.lots || []).filter(l => (
    lotFilter === 'all' || (lotFilter === 'packed' ? !!l.sc_pack_date : !l.sc_pack_date)
  )), [data, lotFilter]);

  const s = data?.summary || {};
  const errs = Object.entries(data?.errors || {});

  return (
    <div>
      {/* ── ช่องสแกน ── */}
      <div style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: 14, padding: '16px 18px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.blueDeep, marginBottom: 4 }}>
          สอบกลับไปข้างหน้า — รหัสนี้ถูกใช้ในสินค้าอะไรบ้าง
        </div>
        <div style={{ fontSize: 12.5, color: T.text2, marginBottom: 12 }}>
          สแกนบาร์โค้ด/QR ด้วยเครื่องสแกน หรือพิมพ์แล้วกด Enter · "ค้นหาทุกประเภท" จะหาในวัตถุดิบ ส่วนผสม และบรรจุภัณฑ์พร้อมกัน
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            ref={inputRef}
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === 'Enter') run(); }}
            placeholder="รหัสรุ่น (Batch) / Lot บรรจุภัณฑ์"
            aria-label="รหัสรุ่นหรือ Lot ที่ต้องการสอบกลับ"
            style={{ ...inputCss, flex: '1 1 260px', height: 44, fontSize: 16, fontFamily: 'ui-monospace,monospace', letterSpacing: 1.5, fontWeight: 600 }}
          />
          <Btn onClick={() => run()} disabled={loading} style={{ height: 44 }}>
            {loading ? <Spinner size={16} /> : null} สอบกลับ
          </Btn>
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <Segmented value={type} onChange={v => setType(v)} options={TYPE_OPTIONS} />
          {recent.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: T.text2 }}>ล่าสุด:</span>
              {recent.slice(0, 6).map(r => (
                <button key={r.key} type="button" onClick={() => { setCode(r.code); setType(r.type); run(r.code, r.type); }}
                  style={{ border: `1px solid ${T.blueLine}`, background: T.blueSoft, color: T.blueDeep, borderRadius: 20, padding: '3px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {r.code} · {TYPE_LABEL[r.type]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 14, background: T.badSoft, border: `1.5px solid ${T.badLine}`, color: T.bad, borderRadius: 11, padding: 14, fontSize: 13.5 }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, height: 160 }}>
          <Spinner size={30} /> <span style={{ color: T.blueDeep, fontWeight: 600 }}>กำลังค้นหาในทุกเอกสาร...</span>
        </div>
      )}

      {data && !loading && (
        <>
          {/* ── สรุปผลกระทบ ── */}
          <div style={{
            marginTop: 14, background: s.product_count ? T.orange : T.ok, color: T.white, borderRadius: 12,
            padding: '14px 18px', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 12, opacity: 0.92 }}>ผลการสอบกลับ {TYPE_LABEL[data.type]} · รหัส</div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'ui-monospace,monospace', letterSpacing: 2 }}>{data.code}</div>
              <div style={{ fontSize: 12.5, marginTop: 2 }}>
                {s.product_count
                  ? `พบใน ${(data.matched_types || []).map(t => TYPE_LABEL[t]).join(', ')} · กระทบ ${s.product_count} เอกสารผลิต`
                  : 'ไม่พบการใช้งานรหัสนี้ในสินค้าใด'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Btn variant="outline" onClick={() => exportForwardExcel(data)} disabled={!s.product_count}>Excel</Btn>
              <Btn variant="outline" onClick={() => exportForwardPDF(data)} disabled={!s.product_count}>PDF</Btn>
              {onStartRecall && (
                <Btn variant="outline" onClick={() => onStartRecall(data)} disabled={!s.product_count}>เริ่ม Mock Recall</Btn>
              )}
            </div>
          </div>

          {errs.length > 0 && (
            <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {errs.map(([t, m]) => <Tag key={t} tone="orange">{TYPE_LABEL[t]}: {m}</Tag>)}
            </div>
          )}
          {s.truncated && <div style={{ marginTop: 8 }}><Tag tone="orange">ผลลัพธ์มากเกิน แสดง 3,000 ล็อตแรก</Tag></div>}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginTop: 12 }}>
            <Kpi label="เอกสารผลิตที่กระทบ" value={s.product_count || 0} tone={s.product_count ? 'orange' : 'ok'} />
            <Kpi label="ล็อตทั้งหมด" value={s.lot_count || 0} />
            <Kpi label="บรรจุแล้ว" value={s.packed_count || 0} sub="ต้องพิจารณาเรียกคืน" tone={s.packed_count ? 'bad' : 'ok'} />
            <Kpi label="ยังอยู่ในกระบวนการ" value={s.in_process_count || 0} sub="กักได้ทันที" tone={s.in_process_count ? 'orange' : 'ok'} />
            <Kpi label="น้ำหนักรวม (kg)" value={fmtNum(s.total_weight, 1)} />
            <Kpi label="ช่วงบรรจุ" value={<span style={{ fontSize: 13 }}>{fmtDT(s.pack_date_first)}<br />{fmtDT(s.pack_date_last)}</span>} />
          </div>

          <Card title="สินค้าที่ได้รับผลกระทบ (รายเอกสารผลิต)" right={`${(data.products || []).length} รายการ`} tone="orange">
            <SimpleTable
              rows={data.products} getKey={p => `${p.doc_no}|${p.code}`}
              rowTone={p => (p.in_process ? 'orange' : null)}
              empty="ไม่พบสินค้าที่ใช้รหัสนี้"
              columns={[
                { key: 'doc_no', label: 'เลขเอกสาร', render: p => <b>{p.doc_no}</b> },
                { key: 'code', label: 'Code สินค้า', wrap: true },
                { key: 'lots', label: 'ล็อต', align: 'right' },
                { key: 'packed', label: 'บรรจุแล้ว', align: 'right' },
                { key: 'in_process', label: 'ในกระบวนการ', align: 'right', render: p => (p.in_process ? <Tag tone="orange">{p.in_process}</Tag> : 0) },
                { key: 'total_weight', label: 'น้ำหนัก (kg)', align: 'right', render: p => fmtNum(p.total_weight, 1) },
                { key: 'lines', label: 'ไลน์', render: p => (p.lines || []).join(', ') || '—' },
                { key: 'pack', label: 'ช่วงบรรจุ', render: p => `${fmtDT(p.pack_first)} → ${fmtDT(p.pack_last)}` },
                {
                  key: 'open', label: 'ใบสอบกลับ',
                  render: p => (p.packed && onOpenRecord
                    ? <Btn variant="outline" style={{ height: 28, fontSize: 12 }} onClick={() => onOpenRecord(p.doc_no, p.code)}>เปิด</Btn>
                    : '—'),
                },
              ]}
            />
          </Card>

          {(data.sources || []).length > 0 && (
            <Card title="หลักฐานที่ใช้จับคู่ (แหล่งข้อมูล)" right="ยืนยันได้ว่าเชื่อมกันด้วยอะไร">
              <SimpleTable
                rows={data.sources} maxHeight={320}
                columns={[
                  { key: 'type', label: 'ประเภท', render: x => <Tag tone={x.type === 'pkg' ? 'orange' : x.type === 'ing' ? 'ok' : 'blue'}>{TYPE_LABEL[x.type]}</Tag> },
                  { key: 'label', label: 'รายการ', wrap: true },
                  { key: 'wo_no', label: 'WO / Code', render: x => x.wo_no || x.code || x.material_no || '—' },
                  { key: 'detail', label: 'ตะกร้า / Batch-Lot', wrap: true,
                    render: x => (x.baskets ? `ตะกร้า ${x.baskets.join(', ') || '-'}` : [x.batch_no, x.lot_no].filter(Boolean).join(' / ') || (x.count ? `${x.count} ล็อต` : '—')) },
                  { key: 'line_name', label: 'ไลน์' },
                  { key: 'time', label: 'เวลา', render: x => (x.start_time ? `${fmtDT(x.start_time)} → ${fmtDT(x.stop_time)}` : fmtDT(x.used_at)) },
                  { key: 'mapping_count', label: 'ล็อตที่จับคู่', align: 'right', render: x => x.mapping_count ?? x.count ?? '—' },
                ]}
              />
            </Card>
          )}

          <Card
            title="ล็อตการผลิตทั้งหมด"
            right={<Segmented value={lotFilter} onChange={setLotFilter} options={LOT_FILTERS} />}
          >
            <SimpleTable
              rows={lots} getKey={l => l.mapping_id} maxHeight={460}
              rowTone={l => (!l.sc_pack_date ? 'orange' : null)}
              columns={[
                { key: 'mapping_id', label: 'mapping' },
                { key: 'mat', label: 'วัตถุดิบ', wrap: true, render: l => `${l.mat} · ${l.mat_name || ''}` },
                { key: 'batch_before', label: 'Batch', render: l => <span style={{ fontFamily: 'ui-monospace,monospace' }}>{l.batch_before || '—'}</span> },
                { key: 'doc_no', label: 'เอกสาร' },
                { key: 'rmm_line_name', label: 'ไลน์' },
                { key: 'weight_RM', label: 'kg', align: 'right', render: l => fmtNum(l.weight_RM, 1) },
                { key: 'rmit_date', label: 'เตรียมเสร็จ', render: l => fmtDT(l.rmit_date) },
                { key: 'sc_pack_date', label: 'บรรจุเสร็จ', render: l => fmtDT(l.sc_pack_date) },
                { key: 'delay', label: 'เตรียม→บรรจุ', align: 'right', render: l => (l.delay_minutes == null ? '—' : fmtDur(l.delay_minutes)) },
                { key: 'status', label: 'สถานะ', render: l => (l.sc_pack_date ? <Tag tone="plain">บรรจุแล้ว</Tag> : <Tag tone="orange">{l.dest || 'ในกระบวนการ'}</Tag>) },
              ]}
            />
          </Card>
        </>
      )}
    </div>
  );
};

export default ForwardTrace;
