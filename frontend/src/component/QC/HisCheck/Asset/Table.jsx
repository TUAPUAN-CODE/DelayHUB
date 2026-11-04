import React, { useCallback, useMemo, useState } from 'react';
import { IconButton, Tooltip, Box } from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import ModalPrint from './ModalPrint';
// slip of a row put on a trolley as "รอกลับมาเตรียม" (no QC check): the same slip the prep point printed at that time
import PrepWaitSlip from '../../../Prep/TimeStampMain/Asset/manage/ModalPrint';
import DataGrid from '../../../Layout/DataGrid/DataGrid';
import { DEFAULT_EXT } from '../../../Sheet/Asset/ColorSettings';
import QcDetail from './QcDetail';

const NO_TOOLS = { tools: () => [] };
const GROUPS = [
  { key: 'info', label: 'ข้อมูลวัตถุดิบ', color: '#1552F0' },
  { key: 'qc', label: 'ผล QC', color: '#B45309' },
  { key: 'tool', label: 'ทำรายการ', color: '#1552F0' },
];
const rowKeyOf = (r) => `${r.mapping_id}_${r.created_at ?? ''}`;
const isWait = (r) => Number(r.rework_wait) === 1; // "รอกลับมาเตรียม": no QC data, printed with the prep slip
const firstLine = (v) => String(v ?? '').split('\n').map((x) => x.trim()).filter(Boolean).join(', ');
const batchOf = (r) => firstLine(r.batch_after) || firstLine(r.batch_before) || '';
const wt = (r) => (r.weight_RM !== null && r.weight_RM !== undefined && r.weight_RM !== '' && !Number.isNaN(parseFloat(r.weight_RM)) ? parseFloat(r.weight_RM) : null);
const col = (key, label, group, width, extra = {}) => ({ key, label, group, kind: 'data', type: 'text', width, ...extra });

/** every column the account can show (column settings of the table); the first nine are the ones of the old table */
const COLUMNS_BASE = [
  col('batch', 'Batch', 'info', 130, { get: batchOf, frozen: true }),
  col('mat', 'Material', 'info', 120),
  col('mat_name', 'รายชื่อวัตถุดิบ', 'info', 220, { text: (r) => `${r.mat_name || ''}${isWait(r) ? ' · รอกลับมาเตรียม (ไม่ผ่าน QC)' : ''}`, render: (r) => (
    <span>{r.mat_name || '-'}{isWait(r) && <Box component="span" sx={{ display: 'block', mt: 0.25, width: 'fit-content', px: 1, borderRadius: '10px', fontSize: 11, bgcolor: '#FEF3C7', color: '#B45309' }}>รอกลับมาเตรียม (ไม่ผ่าน QC)</Box>}</span>
  ) }),
  col('production', 'แผนการผลิต', 'info', 150),
  col('tro_id', 'หมายเลขรถเข็น', 'info', 120),
  col('dest', 'สถานที่จัดส่ง', 'info', 130),
  col('weight_RM', 'น้ำหนัก (kg)', 'info', 110, { type: 'number', align: 'right', get: wt, text: (r) => (wt(r) === null ? '' : wt(r).toFixed(2)), render: (r) => (wt(r) === null ? '-' : wt(r).toFixed(2)) }),
  col('level_eu', 'Level Eu', 'info', 90),
  col('CookedDateTime', 'เวลาต้ม/อบเสร็จ', 'info', 150, { type: 'time' }),
  // more columns, hidden until the account picks them
  col('mapping_id', 'รายการ', 'info', 100),
  col('rmm_line_name', 'ไลน์', 'info', 100),
  col('tray_count', 'ถาด', 'info', 70, { type: 'number', align: 'right' }),
  col('process_name', 'ประเภทการแปรรูป', 'info', 150),
  col('rmit_date', 'เตรียมเสร็จ', 'info', 150, { type: 'time' }),
  col('prepare_mor_night', 'กะเตรียม', 'info', 90),
  col('rm_status', 'สถานะวัตถุดิบ', 'info', 150),
  col('qccheck', 'Sensory', 'qc', 100),
  col('sq_remark', 'หมายเหตุ Sensory', 'qc', 180),
  col('mdcheck', 'MD', 'qc', 100),
  col('md_remark', 'หมายเหตุ MD', 'qc', 180),
  col('WorkAreaCode', 'พื้นที่ MD', 'qc', 150),
  col('md_no', 'เครื่อง MD', 'qc', 110),
  col('md_time_formatted', 'เวลาเริ่มผ่าน MD', 'qc', 150, { type: 'time' }),
  col('defectcheck', 'Defect', 'qc', 100),
  col('defect_remark', 'หมายเหตุ Defect', 'qc', 180),
  col('Moisture', 'Moisture', 'qc', 90),
  col('percent_fine', '% Fine', 'qc', 80),
  col('Temp', 'Temp', 'qc', 80),
  col('general_remark', 'หมายเหตุทั่วไป', 'qc', 200),
  col('receiver_qc', 'ผู้ตรวจ QC', 'qc', 130),
  col('qc_datetime_formatted', 'เวลา QC ตรวจ', 'qc', 150, { type: 'time' }),
];
const VISIBLE = ['batch', 'mat', 'mat_name', 'production', 'tro_id', 'dest', 'weight_RM', 'level_eu', 'CookedDateTime', 't_print'];
const DETAIL_TABS = [{ key: 'qc', label: 'ผลตรวจ QC', render: (row) => <QcDetail row={row} /> }];

/** Table of the QC history: the standard DataGrid of the system (sort / search / value filter at each column header, column settings per account) */
const QcHisTable = ({ filteredData = [], loading = false }) => {
  const [printRow, setPrintRow] = useState(null);
  const [activeKey, setActiveKey] = useState(null);

  const columns = useMemo(() => [
    ...COLUMNS_BASE,
    { key: 't_print', label: 'พิมพ์', group: 'tool', kind: 'tool', width: 70, frozen: false, render: (r) => (
      <Tooltip title="พิมพ์ข้อมูล">
        <IconButton aria-label="print" size="small" onClick={(e) => { e.stopPropagation(); setPrintRow(r); }} sx={{ width: 30, height: 30, border: '1px solid #E3E8F2', backgroundColor: '#ffffff' }}>
          <PrintIcon fontSize="small" color="action" />
        </IconButton>
      </Tooltip>
    ) },
  ], []);
  const onRowClick = useCallback((r) => setActiveKey((k) => (k === rowKeyOf(r) ? null : rowKeyOf(r))), []);
  const closePrint = () => setPrintRow(null);

  return (
    <>
      <DataGrid
        fill detail gridKey="qc-history" title="QC History" groups={GROUPS} defaultExt={DEFAULT_EXT} columns={columns} defaultVisible={VISIBLE}
        rows={filteredData} rowKey={rowKeyOf} loading={loading} hideReload ctx={NO_TOOLS} activeKey={activeKey} onRowClick={onRowClick}
        detailTabs={DETAIL_TABS} searchPlaceholder="ค้นหาในผลลัพธ์ ... (คลิกที่หัวคอลัมน์เพื่อเรียง / ค้นหา / กรอง · คลิกแถวเพื่อดูผล QC)"
      />
      {printRow && (isWait(printRow)
        ? <PrepWaitSlip open onClose={closePrint} rowData={{ ...printRow, cooked_date: printRow.CookedDateTime || printRow.cooked_date, deliveryType: 'รอกลับมาเตรียม' }} />
        : <ModalPrint open onClose={closePrint} rowData={printRow} />)}
    </>
  );
};

export default QcHisTable;
