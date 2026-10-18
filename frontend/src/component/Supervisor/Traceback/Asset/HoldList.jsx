// รายการกักสินค้า (Hold) แบบ Quality Notification ของ SAP: ดูเอกสารที่ถูกกัก · ปลดกักพร้อมเหตุผล · ส่งออก Excel
import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { T, inputCss } from './tracebackUI';
import { Tag, Kpi, Card, Btn, Segmented, SimpleTable, Spinner } from './TraceAtoms';
import { fmtDT } from './tracebackCore';
import UnlockDialog, { hasUnlock } from '../../../Sheet/Asset/UnlockDialog';

const API_URL = import.meta.env.VITE_API_URL;

/** กล่องสร้างรายการกักจากผลสอบไปข้างหน้า */
export const HoldDialog = ({ open, onClose, source, products = [], onDone }) => {
  const [reason, setReason] = useState('');
  const [picked, setPicked] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!open) return;
    setReason(source?.code ? `สอบกลับจากรหัส ${source.code}` : '');
    setPicked(Object.fromEntries(products.map((p) => [`${p.doc_no}|${p.code}`, true])));
    setMsg('');
  }, [open, source, products]);

  if (!open) return null;
  const items = products.filter((p) => picked[`${p.doc_no}|${p.code}`]);

  const save = async () => {
    if (!reason.trim()) { setMsg('กรุณาระบุเหตุผลการกัก'); return; }
    if (!items.length) { setMsg('เลือกอย่างน้อย 1 เอกสาร'); return; }
    try {
      setBusy(true); setMsg('');
      const r = await axios.post(`${API_URL}/api/traceback/holds`, {
        source_type: source?.type, source_code: source?.code, reason: reason.trim(),
        items: items.map((p) => ({ doc_no: p.doc_no, code: p.code })),
      });
      onDone?.(r.data?.message || 'กักสินค้าแล้ว');
      onClose();
    } catch (e) {
      console.error('Create hold error:', e);
      setMsg(e.response?.data?.error || e.message);
    } finally { setBusy(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,39,64,.45)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: T.white, borderRadius: 14, width: 'min(640px,96vw)', maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ background: T.bad, color: T.white, padding: '12px 18px', fontWeight: 700 }}>กักสินค้า (Hold) — {items.length} เอกสาร</div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: T.blueDeep }}>เหตุผลการกัก
            <input value={reason} onChange={(e) => setReason(e.target.value)} style={{ ...inputCss, marginTop: 4 }} />
          </label>
          <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, maxHeight: 300, overflow: 'auto' }}>
            {products.map((p) => {
              const k = `${p.doc_no}|${p.code}`;
              return (
                <label key={k} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 12px', borderBottom: `1px solid ${T.line}`, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!picked[k]} onChange={(e) => setPicked((v) => ({ ...v, [k]: e.target.checked }))} />
                  <b>{p.doc_no}</b><span style={{ color: T.text2 }}>{p.code}</span>
                  {p.in_process ? <Tag tone="orange">ในกระบวนการ {p.in_process}</Tag> : null}
                </label>
              );
            })}
          </div>
          {msg && <Tag tone="bad">{msg}</Tag>}
        </div>
        <div style={{ padding: '0 16px 16px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Btn variant="ghost" onClick={onClose} disabled={busy}>ยกเลิก</Btn>
          <Btn onClick={save} disabled={busy} style={{ background: T.bad, borderColor: T.bad }}>{busy ? <Spinner size={14} /> : null} ยืนยันกักสินค้า</Btn>
        </div>
      </div>
    </div>
  );
};

const HoldList = ({ onOpenRecord }) => {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('HOLD');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [releasing, setReleasing] = useState(null); // hold row
  const [note, setNote] = useState('');
  const [unlockAsk, setUnlockAsk] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true); setError('');
      const r = await axios.get(`${API_URL}/api/traceback/holds`, { params: { status: status === 'ALL' ? '' : status } });
      setRows(r.data?.data || []);
    } catch (e) {
      console.error('Load holds error:', e);
      setError(e.response?.data?.error || e.message);
    } finally { setLoading(false); }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const startRelease = (h) => {
    if (!hasUnlock()) { setUnlockAsk(true); return; }
    setReleasing(h); setNote('');
  };
  const doRelease = async () => {
    if (!note.trim()) { setError('กรุณาบันทึกเหตุผลการปลดกัก'); return; }
    try {
      await axios.put(`${API_URL}/api/traceback/holds/${releasing.hold_id}/release`, { note: note.trim() });
      setReleasing(null);
      load();
    } catch (e) {
      console.error('Release hold error:', e);
      setError(e.response?.status === 403 ? 'ต้องเป็นหัวหน้า หรือใส่รหัสผ่าน Setting ก่อน' : (e.response?.data?.error || e.message));
    }
  };

  const exportXlsx = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.map((h) => ({
      'เลขที่กัก': h.hold_id, สถานะ: h.status === 'HOLD' ? 'กักอยู่' : 'ปลดแล้ว', เอกสาร: h.doc_no, Code: h.code,
      เหตุผล: h.reason, 'สอบกลับจาก': [h.source_type, h.source_code].filter(Boolean).join(' '), ผู้กัก: h.created_by, เวลากัก: fmtDT(h.created_at),
      ผู้ปลด: h.released_by, เวลาปลด: fmtDT(h.released_at), 'เหตุผลปลด': h.release_note,
    }))), 'รายการกัก');
    XLSX.writeFile(wb, `Traceback_Holds_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const active = useMemo(() => rows.filter((r) => r.status === 'HOLD').length, [rows]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <Segmented value={status} onChange={setStatus} options={[{ value: 'HOLD', label: 'กักอยู่' }, { value: 'RELEASED', label: 'ปลดแล้ว' }, { value: 'ALL', label: 'ทั้งหมด' }]} />
        <Btn variant="outline" onClick={load} disabled={loading}>{loading ? <Spinner size={14} /> : null} รีเฟรช</Btn>
        <Btn variant="outline" onClick={exportXlsx} disabled={!rows.length}>Excel</Btn>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10, marginTop: 12 }}>
        <Kpi label="เอกสารที่กักอยู่ (ในรายการนี้)" value={active} tone={active ? 'bad' : 'ok'} />
        <Kpi label="รายการที่แสดง" value={rows.length} />
      </div>
      {error && <div style={{ marginTop: 10 }}><Tag tone="bad">{error}</Tag></div>}
      <Card title="รายการกักสินค้า (Hold)" tone="orange">
        <SimpleTable
          rows={rows} getKey={(h) => h.hold_id} rowTone={(h) => (h.status === 'HOLD' ? 'bad' : null)}
          empty={loading ? 'กำลังโหลด...' : 'ไม่มีรายการ'}
          columns={[
            { key: 'hold_id', label: '#' },
            { key: 'status', label: 'สถานะ', render: (h) => <Tag tone={h.status === 'HOLD' ? 'bad' : 'ok'}>{h.status === 'HOLD' ? 'กักอยู่' : 'ปลดแล้ว'}</Tag> },
            { key: 'doc_no', label: 'เอกสาร', render: (h) => <b>{h.doc_no}</b> },
            { key: 'code', label: 'Code', wrap: true },
            { key: 'reason', label: 'เหตุผล', wrap: true },
            { key: 'src', label: 'สอบกลับจาก', render: (h) => [h.source_type, h.source_code].filter(Boolean).join(' ') || '—' },
            { key: 'created', label: 'กักโดย', render: (h) => `${h.created_by || '-'} · ${fmtDT(h.created_at)}` },
            { key: 'released', label: 'ปลดโดย', wrap: true, render: (h) => (h.released_at ? `${h.released_by || '-'} · ${fmtDT(h.released_at)} · ${h.release_note || ''}` : '—') },
            { key: 'act', label: '', render: (h) => (
              <span style={{ display: 'inline-flex', gap: 6 }}>
                {onOpenRecord && <Btn variant="outline" style={{ height: 28, fontSize: 12 }} onClick={() => onOpenRecord(h.doc_no, h.code)}>เปิด</Btn>}
                {h.status === 'HOLD' && <Btn style={{ height: 28, fontSize: 12 }} onClick={() => startRelease(h)}>ปลดกัก</Btn>}
              </span>
            ) },
          ]}
        />
      </Card>

      {releasing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,39,64,.45)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: T.white, borderRadius: 14, width: 'min(480px,96vw)', padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontWeight: 700, color: T.blueDeep }}>ปลดกัก #{releasing.hold_id} · {releasing.doc_no}</div>
            <input autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="เหตุผล / ผลตรวจที่ใช้ปลดกัก" style={inputCss} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Btn variant="ghost" onClick={() => setReleasing(null)}>ยกเลิก</Btn>
              <Btn onClick={doRelease}>ยืนยันปลดกัก</Btn>
            </div>
          </div>
        </div>
      )}
      <UnlockDialog open={unlockAsk} title="ใส่รหัสผ่านเพื่อปลดกักสินค้า" onClose={() => setUnlockAsk(false)} onUnlocked={() => setUnlockAsk(false)} />
    </div>
  );
};

export default HoldList;
