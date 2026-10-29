import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import DataGrid from '../../../Layout/DataGrid/DataGrid';
import { buildRows } from '../../../Sheet/Asset/buildRows';
import { COLUMNS, GROUPS } from '../../../Sheet/Asset/columns';
import { DEFAULT_EXT } from '../../../Sheet/Asset/ColorSettings';
import { prepareSheetRows } from '../../../Sheet/Asset/prepareRows';
import { loadRemarkCs, remarkCsText } from '../../../Layout/RemarkCs';
import { T } from './tracebackUI';
import { Spinner } from './TraceAtoms';

const API_URL = import.meta.env.VITE_API_URL;
const CHUNK = 400; // ids per request (the URL stays short)
const NO_TOOLS = { tools: () => [] };
const rowKey = (r) => r.__key;
const GRID_KEY = 'traceback-forward-lots-v2'; // new key: the columns changed, every account starts from the new default

// QC detail of the lot (sensory, remarks, temperature ...): GET /api/sheet/rows-by-ids merges them into the row as qc_*
const passText = (v) => (v === null || v === undefined || v === '' ? null : (v === 1 || v === true || v === '1' ? 'ผ่าน' : 'ไม่ผ่าน'));
const qc = (key, label, extra = {}) => ({ key, label, group: 'prep', kind: 'data', type: 'text', width: 120, ...extra });
const QC_COLUMNS = [
  qc('qc_color', 'สี (Sensory)', { get: (r) => passText(r.qc_color), width: 100 }),
  qc('qc_odor', 'กลิ่น (Sensory)', { get: (r) => passText(r.qc_odor), width: 110 }),
  qc('qc_texture', 'เนื้อสัมผัส (Sensory)', { get: (r) => passText(r.qc_texture), width: 130 }),
  qc('qc_sq_acceptance', 'ยอมรับ Sensory', { get: (r) => (r.qc_sq_acceptance === null || r.qc_sq_acceptance === undefined ? null : (Number(r.qc_sq_acceptance) === 1 ? 'ยอมรับ' : 'ไม่ยอมรับ')), width: 120 }),
  qc('qc_sq_remark', 'หมายเหตุ Sensory (QC)', { width: 190 }),
  qc('qc_md', 'Metal Detector', { get: (r) => passText(r.qc_md), width: 120 }),
  qc('qc_md_remark', 'หมายเหตุ MD (QC)', { width: 170 }),
  qc('qc_defect_remark', 'หมายเหตุข้อบกพร่อง (QC)', { width: 190 }),
  qc('qc_temp', 'อุณหภูมิ (QC)', { width: 100 }),
  qc('qc_moisture', 'ความชื้น (QC)', { width: 100 }),
  qc('qc_percent_fine', '% Fine (QC)', { width: 100 }),
  qc('qc_general_remark', 'หมายเหตุทั่วไป (QC)', { width: 190 }),
];
// the columns the traceback does not need: trolley, mix code, "from mapping" (batch is shown as the original + the converted one, Remark CS follows HU)
const DROP = new Set(['tro_id', 'mix_code', 'from_mapping_id']);
const REMARK_CS_COLUMN = { key: 'remark_cs', label: 'Remark CS', group: 'info', kind: 'data', type: 'text', width: 170 };
const BATCH_COLUMNS = [
  { key: 'batch', label: 'Batch', group: 'info', kind: 'data', type: 'text', width: 110, get: (r) => r.batch_before || r.batch },
  { key: 'batch_2x', label: 'Batch แปลง', group: 'info', kind: 'data', type: 'text', width: 110, get: (r) => r.batch_after_2x },
];
const BASE_COLUMNS = COLUMNS.filter((c) => c.kind !== 'tool' && !DROP.has(c.key)).flatMap((c) => (c.key === 'hu' ? [c, REMARK_CS_COLUMN] : c.key === 'batch' ? BATCH_COLUMNS : [c]));
const ALL_COLUMNS = [...BASE_COLUMNS, ...QC_COLUMNS];
const ALL_KEYS = ALL_COLUMNS.map((c) => c.key);

/**
 * Every lot of the traceback as a table of the Sheet: every time, DBS 1-4 (with the account's colours), status, QC / sensory and remarks.
 * Click a header to sort, the filter button of a column to filter, "ตั้งค่าคอลัมน์" to pick the columns, Excel / PDF to export.
 * ids = every mapping_id of the result (read once) · show = Set of the ids to show now (the filters of the page), null = all
 */
const ForwardLotsGrid = ({ lots, show = null }) => {
  const [state, setState] = useState({ loading: false, mappings: [], qc: {}, remarks: {}, error: '' });
  const sig = (lots || []).map((l) => l.mapping_id).join(',');
  const batchOf = useMemo(() => new Map((lots || []).map((l) => [l.mapping_id, l])), [lots]);

  useEffect(() => {
    if (!sig) { setState({ loading: false, mappings: [], qc: {}, remarks: {}, error: '' }); return undefined; }
    let alive = true;
    const load = async () => {
      setState((s) => ({ ...s, loading: true, error: '' }));
      try {
        const list = sig.split(',');
        const mappings = [];
        const qcAll = {};
        for (let i = 0; i < list.length; i += CHUNK) {
          // eslint-disable-next-line no-await-in-loop
          const res = await axios.get(`${API_URL}/api/sheet/rows-by-ids`, { params: { ids: list.slice(i, i + CHUNK).join(',') } });
          mappings.push(...(res.data?.mappings || []));
          Object.assign(qcAll, res.data?.qc || {});
        }
        // Remark CS = the note of the lot's own HU (one request for all of them, kept a minute by Layout/RemarkCs)
        const sources = mappings.map((m) => ({ mappingId: m.mapping_id }));
        await loadRemarkCs(sources);
        const remarks = {};
        sources.forEach((src) => { const t = remarkCsText([src]); if (t) remarks[src.mappingId] = t; });
        if (alive) setState({ loading: false, mappings, qc: qcAll, remarks, error: '' });
      } catch (err) {
        console.error('[Traceback] lots grid error:', err);
        if (alive) setState({ loading: false, mappings: [], qc: {}, remarks: {}, error: err.response?.data?.error || 'โหลดรายละเอียดล็อตไม่สำเร็จ' });
      }
    };
    load();
    return () => { alive = false; };
  }, [sig]);

  const rows = useMemo(() => {
    const picked = show ? state.mappings.filter((m) => show.has(m.mapping_id)) : state.mappings;
    const built = buildRows([], picked, {}, [], Date.now(), [], { showAll: true });
    return built.map((r) => {
      const l = batchOf.get(r.mapping_id);
      return {
        ...r, ...(state.qc[r.mapping_id] || {}),
        batch_before: l?.batch_before ?? r.batch_before, batch_after_2x: l?.batch_after ?? null, remark_cs: state.remarks[r.mapping_id] || '',
      };
    });
  }, [state.mappings, state.qc, state.remarks, show, batchOf]);

  if (state.error) return <div style={{ padding: 14, color: T.bad, fontSize: 13 }}>{state.error}</div>;
  if (state.loading && !state.mappings.length) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, height: 140 }}><Spinner size={22} /> <span style={{ color: T.blueDeep, fontWeight: 600 }}>กำลังโหลดรายละเอียดทุกล็อต...</span></div>;
  }
  return (
    <div style={{ height: '74vh', minHeight: 440, position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <DataGrid
          fill gridKey={GRID_KEY} title="ล็อตการผลิตทั้งหมด" defaultExt={DEFAULT_EXT} columns={ALL_COLUMNS} groups={GROUPS} defaultVisible={ALL_KEYS}
          prepareRows={prepareSheetRows} rows={rows} rowKey={rowKey} loading={state.loading} hideReload ctx={NO_TOOLS}
          searchPlaceholder="ค้นหาในล็อตทั้งหมด (Mat / Batch / เอกสาร / สถานะ / หมายเหตุ ...)"
        />
      </div>
    </div>
  );
};

export default ForwardLotsGrid;
