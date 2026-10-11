import React, { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { thSarabunBase64 } from '../../../../fonts/thSarabunBase64';
import QrScanner from 'qr-scanner';
import {
  Box, Paper, TextField, Autocomplete, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Chip, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton,
  Tabs, Tab, Typography, Menu, MenuItem, InputAdornment, Tooltip,
} from '@mui/material';
import {
  Close, QrCodeScanner, ArrowBack, Add, CheckCircle, PictureAsPdf, FileDownload,
  Edit, AccessTime, Delete, Notes, Stop, FilterList, Search, Clear,
  BarChart, TableChart,
} from '@mui/icons-material';

const API_URL = import.meta.env.VITE_API_URL;

const SHIFTS    = ['DS', 'NS'];
const PLANTS    = ['PF1', 'PF2'];
const PKG_TYPES = ['กระป๋อง', 'ฝา', 'ถ้วย', 'ถุง'];

// ─── Sachet machine list (Sachet 1 – Sachet 16) ───────────────────────────────
// ใช้เป็นตัวเลือกใน dropdown "เครื่องผลิต" ที่โชว์เฉพาะตอนเลือกไลน์ที่เป็น Sachet เท่านั้น
const SACHET_MACHINES = Array.from({ length: 16 }, (_, i) => `Sachet ${i + 1}`);

// ─── i18n ───────────────────────────────────────────────────────────────────
const TRANSLATIONS = {
  th: {
    'tab.active': 'กำลังดำเนินการ',
    'tab.history': 'ประวัติ',
    'tab.summary': 'สรุป Plant / Line',
    'btn.createDoc': 'สร้างเอกสาร',
    'btn.edit': 'แก้ไข',
    'btn.delete': 'ลบ',
    'btn.cancel': 'ยกเลิก',
    'btn.confirm': 'ยืนยัน',
    'btn.save': 'บันทึก',
    'btn.saveChanges': 'บันทึกการแก้ไข',
    'btn.exportExcel': 'Export Excel',
    'btn.exportExcelAll': 'Export Excel รวม',
    'btn.exportPdf': 'Export PDF',
    'btn.exportPdfAll': 'Export PDF รวม',
    'btn.excelShort': 'Excel',
    'btn.pdfShort': 'PDF',
    'btn.refresh': 'รีเฟรชข้อมูล',
    'btn.backToday': '↩ กลับไปวันนี้',
    'btn.back': 'ย้อนกลับ',
    'btn.clearAllFilters': 'ล้างตัวกรองทั้งหมด',
    'btn.clearThisFilter': 'ล้างตัวกรองคอลัมน์นี้',
    'btn.confirmData': 'ยืนยันข้อมูล',
    'btn.camera': 'กล้อง',
    'btn.stop': 'หยุด',
    'btn.stopNow': 'บันทึกหยุด (ตอนนี้)',
    'btn.markDone': 'บันทึก (Done)',
    'view.table': 'ตาราง',
    'view.chart': 'กราฟ',
    'filter.reportDate': 'วันที่',
    'filter.shift': 'กะ',
    'filter.plant': 'โรงผลิต',
    'filter.packageType': 'บรรจุภัณฑ์',
    'filter.line': 'Line',
    'filter.reportedBy': 'รายงานโดย',
    'filter.qcSupervisor': 'QC Supervisor',
    'filter.searchPlaceholder': 'ค้นหา{label}...',
    'filter.notFound': 'ไม่พบข้อมูล',
    'filter.allPlants': 'ทั้งหมด',
    'form.reportDate': 'วันที่',
    'form.autoLocked': 'ล็อกอัตโนมัติตามกะปัจจุบัน',
    'form.shift': 'กะ',
    'form.plant': 'โรงผลิต',
    'form.packageType': 'บรรจุภัณฑ์',
    'form.reportedBy': 'รายงานโดย',
    'form.qcSupervisor': 'QC Supervisor',
    'form.line': 'Line',
    'form.machineName': 'เครื่องผลิต (Sachet)',
    'form.selectMachine': 'เลือกเครื่อง...',
    'form.selectOrType': 'เลือกหรือพิมพ์ชื่อ...',
    'form.typeNameHint': '⚠️ พิมพ์ชื่อได้เลย',
    'form.showingOptions': 'แสดง {n} ตัวเลือก',
    'form.selectPkgFirst': '⬆️ กรุณาเลือกบรรจุภัณฑ์ก่อน เพื่อกรอง Line',
    'form.searchLinePlaceholder': 'พิมพ์ค้นหา Line ({pkg})...',
    'form.noLineFound': 'ไม่พบ Line สำหรับ "{pkg}"',
    'form.showingLinesFor': 'แสดง {n} Line สำหรับ {pkg}',
    'form.missingFieldsWarn': '⚠️ กรุณากรอกข้อมูลให้ครบ:',
    'form.pleaseFill': 'กรุณากรอก:',
    'form.createTitle': 'สร้างเอกสารใหม่',
    'form.editTitle': 'แก้ไขเอกสาร',
    'password.title': 'ยืนยันรหัสผ่าน',
    'password.label': 'รหัสผ่าน',
    'password.wrong': 'รหัสผ่านไม่ถูกต้อง',
    'password.deleteNotice': '🔒 การลบเอกสารต้องใส่รหัสผ่าน',
    'col.no': '#',
    'col.date': 'วันที่',
    'col.shift': 'กะ',
    'col.plant': 'โรงผลิต',
    'col.packageType': 'บรรจุภัณฑ์',
    'col.line': 'Line',
    'col.machineName': 'เครื่องผลิต',
    'col.code': 'Code',
    'col.reportedBy': 'รายงานโดย',
    'col.qcSupervisor': 'QC Supervisor',
    'col.shiftDS': 'กะ DS (กลางวัน)',
    'col.shiftNS': 'กะ NS (กลางคืน)',
    'col.status': 'สถานะ',
    'col.export': 'Export',
    'col.materialNo': 'Material No.',
    'col.lotNo': 'Lot No.',
    'col.boxNo': 'Box No.',
    'col.produceDate': 'วันที่ผลิต/เวลา',
    'col.receiveDate': 'วันที่รับเข้า',
    'col.batchNo': 'Batch No.',
    'col.huNo': 'HU No.',
    'col.startTime': 'เวลาเริ่มปล่อย',
    'col.stopTime': 'เวลาหยุดปล่อย',
    'col.qty': 'จำนวน',
    'col.remark': 'หมายเหตุ',
    'status.bothShifts': 'ครบทั้ง 2 กะ',
    'status.partial': 'บางกะ',
    'status.noReport': 'ไม่มีรายงาน',
    'status.hasReport': 'มีรายงาน',
    'status.none': 'ไม่มี',
    'table.noData': 'ไม่มีข้อมูล',
    'table.noLineData': 'ไม่มีข้อมูล Line',
    'table.emptyDetailHint': 'ยังไม่มีข้อมูล — Scan QR Code เพื่อเพิ่มแถว',
    'msg.confirmDeleteDoc': 'ยืนยันการลบเอกสาร?',
    'msg.confirmDeleteRow': 'ยืนยันการลบแถวนี้?',
    'msg.confirmDone': 'ยืนยันบันทึก? สถานะจะเปลี่ยนเป็น Done',
    'msg.errorPrefix': 'เกิดข้อผิดพลาด: ',
    'msg.deleteFailed': 'ลบไม่สำเร็จ: ',
    'msg.saveFailed': 'บันทึกไม่สำเร็จ: ',
    'msg.loadHistoryFailed': 'โหลดข้อมูลประวัติไม่สำเร็จ: ',
    'msg.loadDataFailed': 'โหลดข้อมูลไม่สำเร็จ: ',
    'msg.stopTimeSaveFailed': 'บันทึก stop_time ไม่สำเร็จ: ',
    'msg.qrProcessFailed': 'ไม่สามารถประมวลผล QR ได้',
    'msg.slipNotFound': 'ไม่พบ slip_id: {id}',
    'msg.cameraAccessFailed': 'ไม่สามารถเข้าถึงกล้องได้',
    'msg.chooseFilterHint': 'กรุณาเลือกตัวกรองที่ต้องการ (หรือไม่เลือกเพื่อดูทั้งหมด) แล้วกด "ยืนยันข้อมูล" เพื่อแสดงรายการ',
    'msg.rowShowsCodeHint': 'แต่ละแถวแสดง 1 Code ที่ใช้ในเอกสาร — คลิกแถวเพื่อดูรายละเอียดของ Code นั้น',
    'label.date': 'วันที่',
    'label.summary': 'สรุป',
    'label.summaryTitle': 'สรุปรายงานการใช้บรรจุภัณฑ์',
    'label.allPlantsSuffix': 'ทุกโรงผลิต',
    'label.plantPrefix': 'โรงผลิต',
    'label.overallProgress': 'ความคืบหน้ารวม',
    'label.chart14days': 'จำนวน Line ที่ทำรายงาน — 14 วันล่าสุด',
    'label.chartCountedUntil': 'นับถึงวันที่ {date}',
    'legend.ds': 'DS (กลางวัน)',
    'legend.ns': 'NS (กลางคืน)',
    'detail.docTitle': 'เอกสารรายงานการใช้บรรจุภัณฑ์ #{id}',
    'detail.done': 'Done',
    'detail.scanStart': '📦 Scan เริ่มปล่อย:',
    'detail.scanStartTitle': 'Scan เริ่มปล่อย',
    'detail.scanStartPlaceholder': 'Scan QR Code แล้วกด Enter — สร้างแถวใหม่พร้อม เวลาเริ่มปล่อย',
    'detail.scanStopTitle': 'Scan หยุดปล่อย',
    'detail.scanStopHint': 'Scan ป้ายสลีปเพื่อยืนยัน หรือกดปุ่ม "บันทึกหยุด" เพื่อบันทึกเวลาหยุดปล่อย ณ ขณะนี้',
    'detail.scanStopPlaceholder': 'Scan QR Code หรือกด Enter เพื่อยืนยัน',
    'detail.editRowTitle': '✏️ แก้ไขข้อมูลแถว',
    'detail.releaseTime': 'เวลาปล่อย',
    'detail.pouchSachet': 'Pouch / Sachet',
    'detail.qtyBlock': 'จำนวน รับ / ใช้ / เสีย / คงเหลือ',
    'detail.qtyReceived': 'จำนวนรับ',
    'detail.qtyUsed': 'จำนวนใช้',
    'detail.qtyDamaged': 'จำนวนเสีย',
    'detail.qtyRemaining': 'คงเหลือ',
    'lang.thai': 'ไทย',
    'lang.english': 'English',
    'pkgType.can': 'กระป๋อง',
    'pkgType.lid': 'ฝา',
    'pkgType.cup': 'ถ้วย',
    'pkgType.pouch': 'ถุง',
  },
  en: {
    'tab.active': 'In Progress',
    'tab.history': 'History',
    'tab.summary': 'Plant / Line Summary',
    'btn.createDoc': 'Create Document',
    'btn.edit': 'Edit',
    'btn.delete': 'Delete',
    'btn.cancel': 'Cancel',
    'btn.confirm': 'Confirm',
    'btn.save': 'Save',
    'btn.saveChanges': 'Save Changes',
    'btn.exportExcel': 'Export Excel',
    'btn.exportExcelAll': 'Export All (Excel)',
    'btn.exportPdf': 'Export PDF',
    'btn.exportPdfAll': 'Export All (PDF)',
    'btn.excelShort': 'Excel',
    'btn.pdfShort': 'PDF',
    'btn.refresh': 'Refresh',
    'btn.backToday': '↩ Back to Today',
    'btn.back': 'Back',
    'btn.clearAllFilters': 'Clear All Filters',
    'btn.clearThisFilter': 'Clear This Filter',
    'btn.confirmData': 'Confirm',
    'btn.camera': 'Camera',
    'btn.stop': 'Stop',
    'btn.stopNow': 'Save Stop (Now)',
    'btn.markDone': 'Mark as Done',
    'view.table': 'Table',
    'view.chart': 'Chart',
    'filter.reportDate': 'Date',
    'filter.shift': 'Shift',
    'filter.plant': 'Plant',
    'filter.packageType': 'Package Type',
    'filter.line': 'Line',
    'filter.reportedBy': 'Reported By',
    'filter.qcSupervisor': 'QC Supervisor',
    'filter.searchPlaceholder': 'Search {label}...',
    'filter.notFound': 'No data found',
    'filter.allPlants': 'All',
    'form.reportDate': 'Date',
    'form.autoLocked': 'Auto-locked to current shift',
    'form.shift': 'Shift',
    'form.plant': 'Plant',
    'form.packageType': 'Package Type',
    'form.reportedBy': 'Reported By',
    'form.qcSupervisor': 'QC Supervisor',
    'form.line': 'Line',
    'form.machineName': 'Machine (Sachet)',
    'form.selectMachine': 'Select machine...',
    'form.selectOrType': 'Select or type a name...',
    'form.typeNameHint': '⚠️ You can type a name',
    'form.showingOptions': 'Showing {n} options',
    'form.selectPkgFirst': '⬆️ Please select a package type first to filter Line',
    'form.searchLinePlaceholder': 'Search Line ({pkg})...',
    'form.noLineFound': 'No Line found for "{pkg}"',
    'form.showingLinesFor': 'Showing {n} Lines for {pkg}',
    'form.missingFieldsWarn': '⚠️ Please fill in all required fields:',
    'form.pleaseFill': 'Please fill in:',
    'form.createTitle': 'Create New Document',
    'form.editTitle': 'Edit Document',
    'password.title': 'Confirm Password',
    'password.label': 'Password',
    'password.wrong': 'Incorrect password',
    'password.deleteNotice': '🔒 Deleting a document requires a password',
    'col.no': '#',
    'col.date': 'Date',
    'col.shift': 'Shift',
    'col.plant': 'Plant',
    'col.packageType': 'Package Type',
    'col.line': 'Line',
    'col.machineName': 'Machine',
    'col.code': 'Code',
    'col.reportedBy': 'Reported By',
    'col.qcSupervisor': 'QC Supervisor',
    'col.shiftDS': 'DS Shift (Day)',
    'col.shiftNS': 'NS Shift (Night)',
    'col.status': 'Status',
    'col.export': 'Export',
    'col.materialNo': 'Material No.',
    'col.lotNo': 'Lot No.',
    'col.boxNo': 'Box No.',
    'col.produceDate': 'Production Date/Time',
    'col.receiveDate': 'Receive Date',
    'col.batchNo': 'Batch No.',
    'col.huNo': 'HU No.',
    'col.startTime': 'Start Time',
    'col.stopTime': 'Stop Time',
    'col.qty': 'Quantity',
    'col.remark': 'Remark',
    'status.bothShifts': 'Both Shifts',
    'status.partial': 'Partial',
    'status.noReport': 'No Report',
    'status.hasReport': 'Reported',
    'status.none': 'None',
    'table.noData': 'No data',
    'table.noLineData': 'No Line data',
    'table.emptyDetailHint': 'No data yet — Scan QR Code to add a row',
    'msg.confirmDeleteDoc': 'Confirm delete this document?',
    'msg.confirmDeleteRow': 'Confirm delete this row?',
    'msg.confirmDone': 'Confirm save? Status will change to Done',
    'msg.errorPrefix': 'An error occurred: ',
    'msg.deleteFailed': 'Delete failed: ',
    'msg.saveFailed': 'Save failed: ',
    'msg.loadHistoryFailed': 'Failed to load history: ',
    'msg.loadDataFailed': 'Failed to load data: ',
    'msg.stopTimeSaveFailed': 'Failed to save stop time: ',
    'msg.qrProcessFailed': 'Unable to process the QR code',
    'msg.slipNotFound': 'Slip ID not found: {id}',
    'msg.cameraAccessFailed': 'Unable to access the camera',
    'msg.chooseFilterHint': 'Please choose filters (or leave blank to see all), then click "Confirm" to show the list',
    'msg.rowShowsCodeHint': 'Each row shows 1 Code used in the document — click a row to see its details',
    'label.date': 'Date',
    'label.summary': 'Summary',
    'label.summaryTitle': 'Packaging Usage Summary Report',
    'label.allPlantsSuffix': 'All Plants',
    'label.plantPrefix': 'Plant',
    'label.overallProgress': 'Overall Progress',
    'label.chart14days': 'Lines Reported — Last 14 Days',
    'label.chartCountedUntil': 'Counted up to {date}',
    'legend.ds': 'DS (Day)',
    'legend.ns': 'NS (Night)',
    'detail.docTitle': 'Packaging Usage Report #{id}',
    'detail.done': 'Done',
    'detail.scanStart': '📦 Scan to Start:',
    'detail.scanStartTitle': 'Scan to Start',
    'detail.scanStartPlaceholder': 'Scan QR Code and press Enter — creates a new row with start time',
    'detail.scanStopTitle': 'Scan to Stop',
    'detail.scanStopHint': 'Scan the slip label to confirm, or click "Save Stop" to record the stop time now',
    'detail.scanStopPlaceholder': 'Scan QR Code or press Enter to confirm',
    'detail.editRowTitle': '✏️ Edit Row Data',
    'detail.releaseTime': 'Release Time',
    'detail.pouchSachet': 'Pouch / Sachet',
    'detail.qtyBlock': 'Qty Received / Used / Damaged / Remaining',
    'detail.qtyReceived': 'Qty Received',
    'detail.qtyUsed': 'Qty Used',
    'detail.qtyDamaged': 'Qty Damaged',
    'detail.qtyRemaining': 'Qty Remaining',
    'lang.thai': 'ไทย',
    'lang.english': 'English',
    'pkgType.can': 'Can',
    'pkgType.lid': 'Lid',
    'pkgType.cup': 'Cup',
    'pkgType.pouch': 'Pouch',
  },
};

const LanguageContext = createContext({ lang: 'th', t: (k) => k, setLang: () => {} });
const useLang = () => useContext(LanguageContext);

const PKG_TYPE_KEYS = {
  'กระป๋อง': 'pkgType.can',
  'ฝา': 'pkgType.lid',
  'ถ้วย': 'pkgType.cup',
  'ถุง': 'pkgType.pouch',
};
const pkgLabel = (value, t) => (value && PKG_TYPE_KEYS[value]) ? t(PKG_TYPE_KEYS[value]) : (value || '-');

const LangSwitcher = () => {
  const { lang, setLang, t } = useLang();
  return (
    <Box sx={{ display: 'flex', gap: 0.5 }}>
      {['th', 'en'].map(l => (
        <Box key={l} onClick={() => setLang(l)} sx={{
          px: 1.4, py: 0.4, borderRadius: '8px', fontSize: '12px', fontWeight: 600,
          cursor: 'pointer', userSelect: 'none', transition: 'all .15s',
          border: lang === l ? '1.5px solid #1976D2' : '1.5px solid #e0e0e0',
          backgroundColor: lang === l ? '#1976D2' : '#fff',
          color: lang === l ? '#fff' : '#607d8b',
        }}>
          {l === 'th' ? t('lang.thai') : t('lang.english')}
        </Box>
      ))}
    </Box>
  );
};

// ─── Package type → line_type_id mapping ──────────────────────────────────────
const PKG_LINE_TYPE_IDS = {
  'กระป๋อง': [2],
  'ฝา':      [2, 3],
  'ถ้วย':    [1],
  'ถุง':     [3, 12],
};

const SPOUT_PATTERN = /spout/i;

// ─── QC Supervisor options ─────────────────────────────────────────────────────
const QC_SUPERVISORS = [
  { name: 'ศศิเพ็ญ',    hint: 'Cup, Spout, Sachet · PF1', plants: ['PF1'], pkgTypes: ['ถ้วย', 'ฝา', 'ถุง'] },
  { name: 'กิตติพงศ์',  hint: 'Cup, Spout, Sachet · PF1', plants: ['PF1'], pkgTypes: ['ถ้วย', 'ฝา', 'ถุง'] },
  { name: 'ญาตาวี',     hint: 'Pouch, Can · PF1',         plants: ['PF1'], pkgTypes: ['ถุง', 'กระป๋อง'] },
  { name: 'สุนันทา',    hint: 'Pouch, Can, Cup · PF2',    plants: ['PF2'], pkgTypes: ['ถุง', 'กระป๋อง', 'ถ้วย'] },
  { name: 'วิลาวัลย์',  hint: 'Pouch, Can · PF1',         plants: ['PF1'], pkgTypes: ['ถุง', 'กระป๋อง'] },
  { name: 'รัฐจินันท์', hint: 'Pouch, Can, Cup · PF2',    plants: ['PF2'], pkgTypes: ['ถุง', 'กระป๋อง', 'ถ้วย'] },
  { name: 'จิรายุ',     hint: 'Pouch, Can, Cup · PF2',    plants: ['PF2'], pkgTypes: ['ถุง', 'กระป๋อง', 'ถ้วย'] },
];

const getQcSupervisorOptions = (plant, pkgType) => {
  if (!plant && !pkgType) return QC_SUPERVISORS;
  return QC_SUPERVISORS.filter(s => {
    const matchPlant = !plant   || s.plants.includes(plant);
    const matchPkg   = !pkgType || s.pkgTypes.includes(pkgType);
    return matchPlant && matchPkg;
  });
};

// ─── Infer line_type_id ────────────────────────────────────────────────────────
const inferLineTypeId = (lineName) => {
  const n = (lineName || '').toLowerCase();
  if (/^cup|^cup\s/.test(n))                          return 1;
  if (/^can/.test(n))                                 return 2;
  if (/^fd$|freeze\s*dry/i.test(n))                   return 12;
  if (/pouch|sachet|auto|spout|big\s*spout/i.test(n)) return 3;
  return null;
};

const filterLinesByPkgType = (lines, pkgType) => {
  if (!pkgType) return lines;
  const allowedTypes = PKG_LINE_TYPE_IDS[pkgType];
  if (!allowedTypes) return lines;
  return lines.filter(l => {
    const typeId = l.line_type_id ?? inferLineTypeId(l.line_name);
    if (!allowedTypes.includes(typeId)) return false;
    if (pkgType === 'ฝา' && typeId === 3) return SPOUT_PATTERN.test(l.line_name || '');
    return true;
  });
};

// ─── Pouch / Sachet line detection ────────────────────────────────────────────
const isPouchSachetLine = (lineName) => /pouch|sachet|auto/i.test(lineName || '');

// ─── Sachet-only line detection ────────────────────────────────────────────────
// เช็คเฉพาะไลน์ที่เป็น "Sachet" เท่านั้น (ไม่รวม Pouch/Auto ทั่วไป)
// ใช้คุมการแสดง dropdown เครื่องจักร Sachet 1–16 — แยกจาก isPouchSachetLine
// เพราะตัวนั้นยังต้องใช้คุมคอลัมน์ Ink/Roll No./Side ที่อื่นอยู่ ห้ามไปแก้ตัวนั้น
const isSachetLine = (lineName) => /sachet/i.test(lineName || '');

// ─── Cup 4 / Cup 5 detection ───────────────────────────────────────────────────
// ไลน์ Cup 4 / Cup 5 ต้องใช้คอลัมน์ รับ / ใช้ / เสีย / คงเหลือ (แต่ไม่ต้องมี Ink / Roll No. / Side)
// ใช้ (?!\d) กันไม่ให้ไปจับ Cup 40, Cup 51 ฯลฯ
const isCup45Line = (lineName) => /^cup\s*[45](?!\d)/i.test((lineName || '').trim());

// ไลน์ที่ต้องแสดงคอลัมน์ รับ / ใช้ / เสีย / คงเหลือ = Pouch/Sachet + Cup 4 + Cup 5
const needsQtyCols = (lineName) => isPouchSachetLine(lineName) || isCup45Line(lineName);

// ─── Thailand timezone helpers ─────────────────────────────────────────────────
const toThaiDT = (dateObj) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(dateObj);
  const get = (t) => parts.find(p => p.type === t)?.value;
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
};
const nowThaiDT   = () => toThaiDT(new Date());
const nowThaiDate = () => nowThaiDT().slice(0, 10);

// ─── Business date (shift-aware) ──────────────────────────────────────────────
const getBusinessDate = () => {
  const dt   = nowThaiDT();
  const hour = Number(dt.slice(11, 13));
  if (hour >= 6) return dt.slice(0, 10);
  const [y, m, d] = dt.slice(0, 10).split('-').map(Number);
  const yesterday = new Date(Date.UTC(y, m - 1, d));
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return `${yesterday.getUTCFullYear()}-${String(yesterday.getUTCMonth()+1).padStart(2,'0')}-${String(yesterday.getUTCDate()).padStart(2,'0')}`;
};

const fmtDT = (d) => {
  if (!d) return '-';
  return String(d).replace('T', ' ').slice(0, 19);
};
const fmtDate = (d) => {
  const full = fmtDT(d);
  return full === '-' ? '-' : full.slice(0, 10);
};

// ─── Auto-complete เอกสารที่ค้าง (ลืมกดปุ่ม Done) ──────────────────────────────
// กะ DS (กลางวัน): ถ้าเวลาปัจจุบันถึง 18:00 น. ของ report_date แล้ว แต่ยังไม่ Done → ตัดเข้า "ประวัติ" อัตโนมัติ
// กะ NS (กลางคืน): ถ้าเวลาปัจจุบันถึง 06:00 น. ของ "วันถัดไป" จาก report_date แล้ว แต่ยังไม่ Done → ตัดเข้า "ประวัติ" อัตโนมัติ
// (กะ NS มักเริ่มช่วงเย็น/ค่ำและคาบเกี่ยวข้ามเที่ยงคืน จึงต้องตัดในเช้าของวันถัดไป ไม่ใช่วันเดียวกับ report_date)
const addOneDay = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d));
  next.setUTCDate(next.getUTCDate() + 1);
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
};

const getShiftAutoDoneCutoff = (report) => {
  const dateStr = fmtDate(report.report_date); // 'YYYY-MM-DD' หรือ '-'
  if (dateStr === '-' || !report.shift) return null;
  if (report.shift === 'DS') {
    return `${dateStr} 18:00:00`; // ตัดกะเช้า (DS) เวลา 18:00 น. ของวันเดียวกัน
  }
  if (report.shift === 'NS') {
    return `${addOneDay(dateStr)} 06:00:00`; // ตัดกะดึก (NS) เวลา 06:00 น. ของวันถัดไป
  }
  return null;
};

// เปรียบเทียบ string รูปแบบ 'YYYY-MM-DD HH:MM:SS' เรียงลำดับได้ตรงๆ โดยไม่ต้องแปลงเป็น Date
const isReportOverdueForAutoDone = (report) => {
  const cutoff = getShiftAutoDoneCutoff(report);
  if (!cutoff) return false;
  return nowThaiDT() >= cutoff;
};

// ─── Shared styles ─────────────────────────────────────────────────────────────
const cellSx = { fontSize: '12px', py: 0.8, px: 1, whiteSpace: 'nowrap' };
const inputSx = {
  '& .MuiInputBase-root': { height: '32px', fontSize: '12px' },
  '& .MuiInputBase-input': { padding: '4px 8px' },
};
const dateStyle = {
  height: '32px', fontSize: '12px', padding: '0 6px',
  border: '1px solid #c4c4c4', borderRadius: '4px', outline: 'none', backgroundColor: '#fff',
};

// ─── Shared UI ─────────────────────────────────────────────────────────────────
const FL = ({ children, required }) => (
  <Box sx={{ fontSize: '10px', fontWeight: 'bold', color: '#555', mb: 0.3, textTransform: 'uppercase' }}>
    {children}{required && <span style={{ color: 'red' }}> *</span>}
  </Box>
);

const ChoiceBar = ({ options, value, onChange }) => (
  <Box sx={{ display: 'flex', gap: 0.5 }}>
    {options.map(o => (
      <Box key={o} onClick={() => onChange(o)} sx={{
        flex: 1, textAlign: 'center', py: 0.5, borderRadius: '4px', cursor: 'pointer', fontSize: '13px',
        border: value === o ? '2px solid #1976D2' : '1px solid #ccc',
        backgroundColor: value === o ? '#1976D2' : '#f5f5f5',
        color: value === o ? '#fff' : '#444', userSelect: 'none',
      }}>{o}</Box>
    ))}
  </Box>
);

// ─── Export button (ป้ายชัดเจน: Excel = เขียว / PDF = แดง) ──────────────────────
const ExportBtn = ({ kind, label, tooltip, onClick, sx }) => {
  const isPdf = kind === 'pdf';
  const main  = isPdf ? '#d32f2f' : '#2e7d32';
  const dark  = isPdf ? '#b71c1c' : '#1b5e20';
  return (
    <Tooltip title={tooltip || label} arrow>
      <Button size="small" variant="contained" disableElevation onClick={onClick}
        startIcon={isPdf ? <PictureAsPdf sx={{ fontSize: 15 }} /> : <FileDownload sx={{ fontSize: 15 }} />}
        sx={{
          textTransform: 'none', fontSize: '11px', fontWeight: 700,
          px: 1, py: 0.3, minWidth: 0, lineHeight: 1.4,
          backgroundColor: main, color: '#fff',
          '&:hover': { backgroundColor: dark },
          ...sx,
        }}>
        {label}
      </Button>
    </Tooltip>
  );
};

// ─── Time dropdown helpers ─────────────────────────────────────────────────────
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MIN_OPTIONS  = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

const dropdownStyle = {
  height: '32px', fontSize: '13px', padding: '0 4px',
  border: '1px solid #c4c4c4', borderRadius: '4px', outline: 'none',
  backgroundColor: '#fff', cursor: 'pointer', appearance: 'auto',
};

const TimeDropdown = ({ value, onChange }) => {
  const parts = (value || '00:00').split(':');
  const h = parts[0] || '00';
  const m = parts[1] || '00';
  const upd = (nh, nm) => onChange(`${nh}:${nm}`);
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <select value={h} onChange={e => upd(e.target.value, m)} style={{ ...dropdownStyle, width: '60px' }}>
        {HOUR_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <span style={{ fontSize: '14px', color: '#555', fontWeight: 'bold' }}>:</span>
      <select value={m} onChange={e => upd(h, e.target.value)} style={{ ...dropdownStyle, width: '60px' }}>
        {MIN_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </Box>
  );
};

const DateTimeEditor = ({ value, onChange }) => {
  const dateVal = value ? String(value).slice(0, 10) : '';
  const timeVal = value ? (String(value).slice(11, 16) || '00:00') : '00:00';
  return (
    <Box sx={{ display: 'flex', gap: 0.8, alignItems: 'center', flexWrap: 'wrap' }}>
      <input type="date" value={dateVal}
        onChange={e => onChange(`${e.target.value} ${timeVal}:00`)}
        style={{ ...dateStyle, width: '130px' }} />
      <TimeDropdown value={timeVal}
        onChange={t => onChange(`${dateVal || nowThaiDate()} ${t}:00`)} />
    </Box>
  );
};

// ─── QR Camera ────────────────────────────────────────────────────────────────
// FIX: qr-scanner เรียก callback ซ้ำทุกครั้งที่ถอดรหัสได้ (หลายครั้ง/วินาที) ระหว่างที่กล้องยังไม่ถูกปิด
//      ทำให้ onScan ถูกเรียกหลายรอบ → POST /scan ซ้ำ → ได้แถวซ้ำ
//      แก้โดยใช้ flag `handled` ให้ยิง onScan ได้ครั้งเดียว แล้วหยุดกล้องทันที
const QrScannerView = ({ onScan, onError }) => {
  const { t } = useLang();
  const videoRef = useRef(null);
  useEffect(() => {
    if (!videoRef.current) return;
    let handled = false;
    const scanner = new QrScanner(videoRef.current, (result) => {
      if (handled) return;
      const text = typeof result === 'object' ? result.data : result;
      if (!text) return;
      handled = true;
      scanner.stop();
      onScan(text);
    }, { preferredCamera: 'environment', highlightScanRegion: true, returnDetailedScanResult: true, onDecodeError: () => {} });
    scanner.start().catch(err => onError(err.message || t('msg.cameraAccessFailed')));
    return () => { scanner.stop(); scanner.destroy(); };
  }, []);
  return <video ref={videoRef} style={{ width: '100%', display: 'block', borderRadius: '6px' }} muted playsInline />;
};

// ─── Password Dialog ───────────────────────────────────────────────────────────
const PasswordDialog = ({ open, onClose, onConfirm }) => {
  const { t } = useLang();
  const [pwd, setPwd] = useState('');
  const [err, setErr] = useState('');
  const handle = () => {
    if (pwd === '2026') { setPwd(''); setErr(''); onConfirm(); }
    else setErr(t('password.wrong'));
  };
  return (
    <Dialog open={open} onClose={() => { setPwd(''); setErr(''); onClose(); }} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: '14px', pb: 1 }}>{t('password.title')}</DialogTitle>
      <DialogContent>
        <TextField type="password" fullWidth size="small" label={t('password.label')}
          value={pwd} onChange={e => { setPwd(e.target.value); setErr(''); }}
          onKeyDown={e => e.key === 'Enter' && handle()}
          error={!!err} helperText={err} autoFocus sx={{ mt: 1 }} />
      </DialogContent>
      <DialogActions>
        <Button size="small" onClick={() => { setPwd(''); setErr(''); onClose(); }}>{t('btn.cancel')}</Button>
        <Button size="small" variant="contained" onClick={handle}>{t('btn.confirm')}</Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── Create / Edit Report Modal ────────────────────────────────────────────────
const EMPTY_REPORT = {
  report_date: '', shift: '', plant: '', package_type: '',
  reported_by: '', qc_supervisor: '', line_name: '', machine_name: '',
};

const isReportFormValid = (form) => {
  const base = !!form.report_date && !!form.shift && !!form.plant && !!form.package_type &&
    !!form.reported_by.trim() && !!form.qc_supervisor.trim() && !!form.line_name;
  if (!base) return false;
  // ถ้าไลน์เป็น Sachet ต้องเลือกเครื่องผลิตด้วย
  if (isSachetLine(form.line_name)) return !!form.machine_name;
  return true;
};

const ReportFormModal = ({ open, onClose, onSaved, lines, initialData, editMode }) => {
  const { t } = useLang();
  const [form, setForm]     = useState(EMPTY_REPORT);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (open) {
      if (initialData) {
        setForm({ ...EMPTY_REPORT, ...initialData, report_date: initialData.report_date ? fmtDate(initialData.report_date) : '' });
      } else {
        setForm({ ...EMPTY_REPORT, report_date: getBusinessDate() });
      }
    }
  }, [open, initialData]);

  const filteredLines = filterLinesByPkgType(lines, form.package_type);
  const handlePkgTypeChange = (v) => setForm(p => ({ ...p, package_type: v || '', line_name: '', qc_supervisor: '', machine_name: '' }));
  const handlePlantChange   = (v) => setForm(p => ({ ...p, plant: v, qc_supervisor: '' }));
  const qcOptions = getQcSupervisorOptions(form.plant, form.package_type);
  const valid = isReportFormValid(form);
  const showMachineField = isSachetLine(form.line_name);

  const handleSave = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      let res;
      if (editMode && initialData?.report_id) {
        res = await axios.put(`${API_URL}/api/pack/pkg/put/reports/${initialData.report_id}`, form);
      } else {
        res = await axios.post(`${API_URL}/api/pack/pkg/reports`, form);
      }
      if (res.data.success) { onSaved(res.data.data); onClose(); }
    } catch (err) {
      alert(t('msg.errorPrefix') + (err.response?.data?.error || err.message));
    } finally { setSaving(false); }
  };

  const missingFields = [];
  if (!form.report_date)          missingFields.push(t('form.reportDate'));
  if (!form.shift)                missingFields.push(t('form.shift'));
  if (!form.plant)                missingFields.push(t('form.plant'));
  if (!form.package_type)         missingFields.push(t('form.packageType'));
  if (!form.reported_by.trim())   missingFields.push(t('form.reportedBy'));
  if (!form.qc_supervisor.trim()) missingFields.push(t('form.qcSupervisor'));
  if (!form.line_name)            missingFields.push(t('form.line'));
  if (showMachineField && !form.machine_name) missingFields.push(t('form.machineName'));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1.5, borderBottom: '1px solid #e0e0e0' }}>
        <Typography sx={{ fontWeight: 'bold', fontSize: '15px' }}>
          {editMode ? t('form.editTitle') : t('form.createTitle')}
        </Typography>
        <IconButton onClick={onClose} size="small"><Close /></IconButton>
      </Box>
      <DialogContent sx={{ pt: 2 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
          <Box>
            <FL required>{t('form.reportDate')}</FL>
            {editMode ? (
              <input type="date" value={form.report_date} onChange={e => set('report_date', e.target.value)} style={{ ...dateStyle, width: '100%' }} />
            ) : (
              <>
                <input type="date" value={form.report_date} readOnly disabled
                  style={{ ...dateStyle, width: '100%', backgroundColor: '#f0f0f0', color: '#666', cursor: 'not-allowed' }} />
                <Box sx={{ fontSize: '10px', color: '#999', mt: 0.3 }}>{t('form.autoLocked')}</Box>
              </>
            )}
          </Box>
          <Box>
            <FL required>{t('form.shift')}</FL>
            <ChoiceBar options={SHIFTS} value={form.shift} onChange={v => set('shift', v)} />
          </Box>
          <Box>
            <FL required>{t('form.plant')}</FL>
            <ChoiceBar options={PLANTS} value={form.plant} onChange={handlePlantChange} />
          </Box>
          <Box>
            <FL required>{t('form.packageType')}</FL>
            <Autocomplete options={PKG_TYPES} value={form.package_type || null}
              getOptionLabel={o => pkgLabel(o, t)}
              onChange={(_, v) => handlePkgTypeChange(v)}
              renderInput={p => <TextField {...p} size="small" sx={inputSx} />}
              size="small" noOptionsText={t('filter.notFound')} />
          </Box>
          <Box>
            <FL required>{t('form.reportedBy')}</FL>
            <TextField fullWidth size="small" value={form.reported_by} onChange={e => set('reported_by', e.target.value)} sx={inputSx} />
          </Box>
          <Box>
            <FL required>{t('form.qcSupervisor')}</FL>
            <Autocomplete freeSolo options={qcOptions}
              getOptionLabel={o => (typeof o === 'string' ? o : o.name)}
              value={form.qc_supervisor || null}
              onChange={(_, v) => {
                if (!v) set('qc_supervisor', '');
                else if (typeof v === 'string') set('qc_supervisor', v);
                else set('qc_supervisor', v.name);
              }}
              onInputChange={(_, v, reason) => { if (reason === 'input') set('qc_supervisor', v); }}
              renderOption={(props, option) => (
                <Box component="li" {...props} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start !important', py: '6px !important', px: '12px !important' }}>
                  <Box sx={{ fontSize: '13px', fontWeight: 500, color: '#111' }}>{option.name}</Box>
                  <Box sx={{ fontSize: '10.5px', color: '#888', mt: 0.2 }}>{option.hint}</Box>
                </Box>
              )}
              renderInput={p => <TextField {...p} size="small" placeholder={t('form.selectOrType')} sx={inputSx} />}
              size="small" noOptionsText={t('filter.notFound')}
              isOptionEqualToValue={(o, v) => typeof v === 'string' ? o.name === v : o.name === v?.name}
            />
            {(form.plant || form.package_type) && (
              <Box sx={{ fontSize: '10.5px', color: '#1565C0', mt: 0.4 }}>
                {qcOptions.length > 0 ? t('form.showingOptions', { n: qcOptions.length }) : t('form.typeNameHint')}
                {form.plant && ` · ${form.plant}`}{form.package_type && ` · ${pkgLabel(form.package_type, t)}`}
              </Box>
            )}
          </Box>
          <Box sx={{ gridColumn: '1 / -1' }}>
            <FL required>{t('form.line')}</FL>
            {!form.package_type ? (
              <Box sx={{ fontSize: '11.5px', color: '#999', border: '1px solid #e0e0e0', borderRadius: '4px', px: 1.5, py: 0.8, backgroundColor: '#fafafa' }}>
                {t('form.selectPkgFirst')}
              </Box>
            ) : (
              <Autocomplete options={filteredLines} getOptionLabel={o => o.line_name || ''}
                value={filteredLines.find(l => l.line_name === form.line_name) || null}
                onChange={(_, v) => setForm(p => ({ ...p, line_name: v?.line_name || '', machine_name: '' }))}
                renderInput={p => <TextField {...p} placeholder={t('form.searchLinePlaceholder', { pkg: pkgLabel(form.package_type, t) })} size="small" sx={inputSx} />}
                size="small" noOptionsText={t('form.noLineFound', { pkg: pkgLabel(form.package_type, t) })}
                isOptionEqualToValue={(o, v) => o.line_name === v.line_name}
              />
            )}
            {form.package_type && filteredLines.length > 0 && (
              <Box sx={{ fontSize: '10.5px', color: '#1565C0', mt: 0.4 }}>{t('form.showingLinesFor', { n: filteredLines.length, pkg: pkgLabel(form.package_type, t) })}</Box>
            )}
          </Box>

          {/* ─── Sachet machine dropdown — โชว์เฉพาะไลน์ที่เป็น Sachet เท่านั้น ───────── */}
          {showMachineField && (
            <Box sx={{ gridColumn: '1 / -1' }}>
              <FL required>{t('form.machineName')}</FL>
              <Autocomplete options={SACHET_MACHINES} value={form.machine_name || null}
                onChange={(_, v) => set('machine_name', v || '')}
                renderInput={p => <TextField {...p} size="small" placeholder={t('form.selectMachine')} sx={inputSx} />}
                size="small" noOptionsText={t('filter.notFound')} />
            </Box>
          )}
        </Box>
        {missingFields.length > 0 && (
          <Box sx={{ mt: 1.5, p: 1, backgroundColor: '#fff3e0', borderRadius: '6px', fontSize: '11.5px', color: '#e65100', border: '1px solid #ffcc80' }}>
            {t('form.missingFieldsWarn')} <b>{missingFields.join(', ')}</b>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onClose} size="small">{t('btn.cancel')}</Button>
        <Tooltip title={!valid ? `${t('form.pleaseFill')} ${missingFields.join(', ')}` : ''} arrow>
          <span>
            <Button variant="contained" size="small" onClick={handleSave}
              disabled={saving || !valid}
              startIcon={saving && <CircularProgress size={12} color="inherit" />}>
              {editMode ? t('btn.saveChanges') : t('btn.createDoc')}
            </Button>
          </span>
        </Tooltip>
      </DialogActions>
    </Dialog>
  );
};

// ─── Filter field definitions ──────────────────────────────────────────────────
const FILTER_FIELD_DEFS = [
  { field: 'report_date',   key: 'filter.reportDate' },
  { field: 'shift',         key: 'filter.shift' },
  { field: 'plant',         key: 'filter.plant' },
  { field: 'package_type',  key: 'filter.packageType' },
  { field: 'line_name',     key: 'filter.line' },
  { field: 'reported_by',   key: 'filter.reportedBy' },
  { field: 'qc_supervisor', key: 'filter.qcSupervisor' },
];
const EMPTY_FILTERS = FILTER_FIELD_DEFS.reduce((acc, f) => { acc[f.field] = ''; return acc; }, {});

const getFilterFieldValue = (row, field) => {
  if (field === 'report_date') return row.report_date ? fmtDate(row.report_date) : '';
  const v = row[field];
  return (v === null || v === undefined) ? '' : String(v);
};
const matchesFilters = (row, filters) =>
  FILTER_FIELD_DEFS.every(({ field }) => {
    const selected = filters[field];
    if (!selected) return true;
    return getFilterFieldValue(row, field) === selected;
  });
const buildFilterOptions = (rows) => {
  const options = {};
  FILTER_FIELD_DEFS.forEach(({ field }) => {
    const set = new Set();
    (rows || []).forEach(r => { const v = getFilterFieldValue(r, field); if (v) set.add(v); });
    options[field] = Array.from(set).sort((a, b) => a.localeCompare(b, 'th'));
  });
  return options;
};

// ─── Filter dropdown button ────────────────────────────────────────────────────
const FilterDropdown = ({ label, options, value, onChange, disabled, labelFn }) => {
  const { t } = useLang();
  const [anchorEl, setAnchorEl] = useState(null);
  const [search, setSearch]     = useState('');
  const open     = Boolean(anchorEl);
  const hasValue = !!value;
  const display  = (v) => (labelFn ? labelFn(v) : v);
  const handleOpen  = (e) => { if (disabled) return; setAnchorEl(e.currentTarget); setSearch(''); };
  const handleClose = ()  => setAnchorEl(null);
  const handlePick  = (v) => { onChange(v); handleClose(); };
  const filtered    = (options || []).filter(o => display(o).toLowerCase().includes(search.trim().toLowerCase()));
  return (
    <Box sx={{ display: 'inline-block' }}>
      <Button size="small" variant="outlined" onClick={handleOpen} disabled={disabled}
        startIcon={<FilterList sx={{ fontSize: 16 }} />}
        sx={{
          textTransform: 'none', fontSize: '12.5px', height: '32px',
          borderColor: hasValue ? '#1976D2' : '#c4c4c4',
          backgroundColor: hasValue ? '#e3f2fd' : '#fff',
          color: hasValue ? '#1976D2' : '#555',
          '&:hover': { borderColor: '#1565C0', backgroundColor: '#e3f2fd' },
        }}>
        {label}{hasValue ? `: ${display(value)}` : ''}
      </Button>
      <Menu anchorEl={anchorEl} open={open} onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        PaperProps={{ sx: { width: 240, mt: 0.5, maxHeight: 360 } }}>
        <Box sx={{ px: 1, pt: 0.5, pb: 1 }}>
          <TextField size="small" fullWidth autoFocus placeholder={t('filter.searchPlaceholder', { label })}
            value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.stopPropagation()}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 16, color: '#999' }} /></InputAdornment> }}
            sx={inputSx} />
        </Box>
        {hasValue && (
          <MenuItem onClick={() => handlePick('')} sx={{ fontSize: '12.5px', color: '#c62828', display: 'flex', gap: 1 }}>
            <Clear sx={{ fontSize: 15 }} /> {t('btn.clearThisFilter')}
          </MenuItem>
        )}
        {filtered.length === 0
          ? <MenuItem disabled sx={{ fontSize: '12px', color: '#999' }}>{t('filter.notFound')}</MenuItem>
          : filtered.map(o => (
            <MenuItem key={o} selected={value === o} onClick={() => handlePick(o)} sx={{ fontSize: '12.5px' }}>
              {display(o)}
            </MenuItem>
          ))}
      </Menu>
    </Box>
  );
};

const FilterBar = ({ filters, options, onChange, disabled }) => {
  const { t } = useLang();
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
      {FILTER_FIELD_DEFS.map(({ field, key }) => (
        <FilterDropdown key={field} label={t(key)}
          options={(options && options[field]) || []}
          value={filters[field]} onChange={v => onChange(field, v)} disabled={disabled}
          labelFn={field === 'package_type' ? (v) => pkgLabel(v, t) : undefined}
        />
      ))}
    </Box>
  );
};

// ─── Report List Table (Active — รูปแบบเดิม) ─────────────────────────────────
const ReportListTable = ({ reports, onRowClick, onDelete, onEdit }) => {
  const { t } = useLang();
  const cols = ['col.no', 'col.date', 'col.shift', 'col.plant', 'col.packageType', 'col.line', 'col.reportedBy', 'col.qcSupervisor'];
  return (
    <TableContainer sx={{ maxHeight: '520px' }}>
      <Table stickyHeader size="small">
        <TableHead>
          <TableRow>
            {cols.map(k => (
              <TableCell key={k} sx={{ backgroundColor: '#1976D2', color: '#fff', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap', py: 1, px: 1.5 }}>
                {t(k)}
              </TableCell>
            ))}
            <TableCell sx={{ backgroundColor: '#1976D2', color: '#fff', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap', py: 1, px: 1.5 }} />
          </TableRow>
        </TableHead>
        <TableBody>
          {reports.length === 0 ? (
            <TableRow><TableCell colSpan={cols.length + 1} align="center" sx={{ py: 4, color: '#999', fontSize: '13px' }}>{t('table.noData')}</TableCell></TableRow>
          ) : reports.map((r, i) => (
            <TableRow key={r.report_id} hover
              sx={{ cursor: 'pointer', '&:hover': { backgroundColor: '#e3f2fd' }, backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
              <TableCell sx={cellSx} onClick={() => onRowClick(r)}>{i + 1}</TableCell>
              <TableCell sx={cellSx} onClick={() => onRowClick(r)}>{fmtDate(r.report_date)}</TableCell>
              <TableCell sx={cellSx} onClick={() => onRowClick(r)}>{r.shift || '-'}</TableCell>
              <TableCell sx={cellSx} onClick={() => onRowClick(r)}>{r.plant || '-'}</TableCell>
              <TableCell sx={cellSx} onClick={() => onRowClick(r)}>
                <Chip label={pkgLabel(r.package_type, t)} size="small" sx={{ fontSize: '11px', height: '20px', backgroundColor: '#e3f2fd', color: '#1565C0' }} />
              </TableCell>
              <TableCell sx={cellSx} onClick={() => onRowClick(r)}>{r.line_name || '-'}</TableCell>
              <TableCell sx={cellSx} onClick={() => onRowClick(r)}>{r.reported_by || '-'}</TableCell>
              <TableCell sx={cellSx} onClick={() => onRowClick(r)}>{r.qc_supervisor || '-'}</TableCell>
              <TableCell sx={{ ...cellSx, minWidth: 100 }}>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {onEdit && (
                    <Box onClick={e => { e.stopPropagation(); onEdit(r); }}
                      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.3, px: 1, py: 0.3, borderRadius: '4px', backgroundColor: '#e3f2fd', color: '#1565C0', cursor: 'pointer', fontSize: '11px', '&:hover': { backgroundColor: '#bbdefb' } }}>
                      <Edit sx={{ fontSize: 13 }} /> {t('btn.edit')}
                    </Box>
                  )}
                  <Box onClick={e => { e.stopPropagation(); onDelete(r); }}
                    sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.3, px: 1, py: 0.3, borderRadius: '4px', backgroundColor: '#ffebee', color: '#c62828', cursor: 'pointer', fontSize: '11px', '&:hover': { backgroundColor: '#ffcdd2' } }}>
                    {t('btn.delete')}
                  </Box>
                </Box>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

// ─── Done History Table ────────────────────────────────────────────────────────
const DoneHistoryTable = ({ rows, onRowClick, onDelete }) => {
  const { t } = useLang();
  const cols = ['col.no', 'col.date', 'col.shift', 'col.plant', 'col.packageType', 'col.line', 'col.code', 'col.reportedBy', 'col.qcSupervisor'];
  return (
    <TableContainer sx={{ maxHeight: '520px' }}>
      <Table stickyHeader size="small">
        <TableHead>
          <TableRow>
            {cols.map(k => (
              <TableCell key={k} sx={{ backgroundColor: '#1976D2', color: '#fff', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap', py: 1, px: 1.5 }}>
                {t(k)}
              </TableCell>
            ))}
            <TableCell sx={{ backgroundColor: '#1976D2', color: '#fff', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap', py: 1, px: 1.5 }} />
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow><TableCell colSpan={cols.length + 1} align="center" sx={{ py: 4, color: '#999', fontSize: '13px' }}>{t('table.noData')}</TableCell></TableRow>
          ) : rows.map((r, i) => (
            <TableRow key={`${r.report_id}-${r._code}-${i}`} hover
              sx={{ cursor: 'pointer', '&:hover': { backgroundColor: '#e3f2fd' }, backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
              <TableCell sx={{ ...cellSx, color: '#888' }} onClick={() => onRowClick(r)}>{i + 1}</TableCell>
              <TableCell sx={cellSx} onClick={() => onRowClick(r)}>{fmtDate(r.report_date)}</TableCell>
              <TableCell sx={cellSx} onClick={() => onRowClick(r)}>{r.shift || '-'}</TableCell>
              <TableCell sx={cellSx} onClick={() => onRowClick(r)}>{r.plant || '-'}</TableCell>
              <TableCell sx={cellSx} onClick={() => onRowClick(r)}>
                <Chip label={pkgLabel(r.package_type, t)} size="small" sx={{ fontSize: '11px', height: '20px', backgroundColor: '#e3f2fd', color: '#1565C0' }} />
              </TableCell>
              <TableCell sx={cellSx} onClick={() => onRowClick(r)}>{r.line_name || '-'}</TableCell>
              <TableCell sx={{ ...cellSx, fontWeight: 600, color: r._code !== '-' ? '#1565C0' : '#bbb' }} onClick={() => onRowClick(r)}>
                {r._code}
              </TableCell>
              <TableCell sx={cellSx} onClick={() => onRowClick(r)}>{r.reported_by || '-'}</TableCell>
              <TableCell sx={cellSx} onClick={() => onRowClick(r)}>{r.qc_supervisor || '-'}</TableCell>
              <TableCell sx={{ ...cellSx, minWidth: 60 }}>
                <Box onClick={e => { e.stopPropagation(); onDelete(r); }}
                  sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.3, px: 1, py: 0.3, borderRadius: '4px', backgroundColor: '#ffebee', color: '#c62828', cursor: 'pointer', fontSize: '11px', '&:hover': { backgroundColor: '#ffcdd2' } }}>
                  {t('btn.delete')}
                </Box>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

// ─── Plant/Line Summary Tab ────────────────────────────────────────────────────
const ProgressRing = ({ percent, size = 64, stroke = 7, color = '#2e7d32', track = '#e8f5e9', label }) => {
  const r  = (size - stroke) / 2;
  const c  = 2 * Math.PI * r;
  const off = c * (1 - Math.min(Math.max(percent, 0), 100) / 100);
  return (
    <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.4s ease' }} />
      </svg>
      <Box sx={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column',
      }}>
        <Typography sx={{ fontSize: size * 0.24, fontWeight: 800, color: '#263238', lineHeight: 1 }}>
          {Math.round(percent)}%
        </Typography>
      </Box>
    </Box>
  );
};

// ปุ่ม Export อยู่แถวล่างของการ์ด (มีข้อความ Excel / PDF กำกับชัดเจน)
const StatCard = ({ icon, value, label, color, bg, onExport, onExportPdf }) => {
  const { t } = useLang();
  return (
    <Paper elevation={0} sx={{
      flex: '1 1 160px', minWidth: 150, display: 'flex', flexDirection: 'column', gap: 1,
      p: 1.6, borderRadius: '14px', border: '1px solid #eceff1',
      background: `linear-gradient(135deg, ${bg} 0%, #ffffff 130%)`,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{
          width: 42, height: 42, borderRadius: '12px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '20px', backgroundColor: color, color: '#fff',
          boxShadow: `0 4px 10px ${color}55`,
        }}>
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: '20px', fontWeight: 800, color: '#263238', lineHeight: 1.1 }}>
            {value}
          </Typography>
          <Typography sx={{ fontSize: '11px', color: '#78909c', fontWeight: 600, mt: 0.2 }}>
            {label}
          </Typography>
        </Box>
      </Box>
      {(onExport || onExportPdf) && (
        <Box sx={{ display: 'flex', gap: 0.6 }}>
          {onExport && (
            <ExportBtn kind="excel" label={t('btn.excelShort')} tooltip={`${t('btn.exportExcel')}: ${label}`}
              onClick={onExport} sx={{ flex: 1 }} />
          )}
          {onExportPdf && (
            <ExportBtn kind="pdf" label={t('btn.pdfShort')} tooltip={`${t('btn.exportPdf')}: ${label}`}
              onClick={onExportPdf} sx={{ flex: 1 }} />
          )}
        </Box>
      )}
    </Paper>
  );
};

const SummaryBarChart = ({ data, selectedDate }) => {
  const { t } = useLang();
  if (!data || data.length === 0) return null;
  const chartData = data.slice(-14);
  const maxVal    = Math.max(...chartData.map(d => d.lines.length), 1);
  const W = 680; const H = 260;
  const padL = 34; const padR = 12; const padT = 30; const padB = 46;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const gridLines = 4;

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 780, height: 'auto', display: 'block' }}>
        <defs>
          <linearGradient id="gradDS" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#42a5f5" />
            <stop offset="100%" stopColor="#1565C0" />
          </linearGradient>
          <linearGradient id="gradNS" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#ab47bc" />
            <stop offset="100%" stopColor="#5e35b1" />
          </linearGradient>
        </defs>

        {Array.from({ length: gridLines + 1 }, (_, i) => i / gridLines).map(frac => {
          const y   = padT + innerH * (1 - frac);
          const val = Math.round(frac * maxVal);
          return (
            <g key={frac}>
              <line x1={padL} y1={y} x2={W - padR} y2={y}
                stroke="#eceff1" strokeWidth="1" strokeDasharray={frac === 0 ? '0' : '3,4'} />
              <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#b0bec5" fontWeight="600">{val}</text>
            </g>
          );
        })}

        {chartData.map((d, i) => {
          const slotW    = innerW / chartData.length;
          const x        = padL + i * slotW + slotW * 0.14;
          const bW       = Math.max(5, (slotW * 0.72) / 2 - 1);
          const dsVal    = d.lines.filter(l => l.ds).length;
          const nsVal    = d.lines.filter(l => l.ns).length;
          const dsH      = maxVal ? (dsVal / maxVal) * innerH : 0;
          const nsH      = maxVal ? (nsVal / maxVal) * innerH : 0;
          const cx       = x + bW;
          const label    = d.date.slice(5).replace('-', '/');
          const isToday  = d.date === selectedDate;
          return (
            <g key={d.date}>
              {isToday && (
                <rect x={x - slotW * 0.14 + 1} y={padT - 6} width={slotW - 2} height={innerH + 6}
                  fill="#1976D2" opacity="0.06" rx="6" />
              )}
              <rect x={x} y={padT + innerH - dsH} width={bW} height={Math.max(dsH, 1.5)}
                fill="url(#gradDS)" rx="3">
                <title>{d.date} · DS: {dsVal}</title>
              </rect>
              <rect x={x + bW + 2} y={padT + innerH - nsH} width={bW} height={Math.max(nsH, 1.5)}
                fill="url(#gradNS)" rx="3">
                <title>{d.date} · NS: {nsVal}</title>
              </rect>
              <text x={cx} y={H - padB + 16} textAnchor="middle" fontSize="8.5"
                fill={isToday ? '#1565C0' : '#90a4ae'} fontWeight={isToday ? '700' : '500'}>
                {label}
              </text>
            </g>
          );
        })}

        <line x1={padL} y1={padT + innerH} x2={W - padR} y2={padT + innerH} stroke="#cfd8dc" strokeWidth="1" />
      </svg>

      <Box sx={{ display: 'flex', gap: 2.5, justifyContent: 'center', mt: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
          <Box sx={{ width: 9, height: 9, borderRadius: '3px', background: 'linear-gradient(135deg,#42a5f5,#1565C0)' }} />
          <Typography sx={{ fontSize: '11px', color: '#607d8b', fontWeight: 600 }}>{t('legend.ds')}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
          <Box sx={{ width: 9, height: 9, borderRadius: '3px', background: 'linear-gradient(135deg,#ab47bc,#5e35b1)' }} />
          <Typography sx={{ fontSize: '11px', color: '#607d8b', fontWeight: 600 }}>{t('legend.ns')}</Typography>
        </Box>
      </Box>
    </Box>
  );
};

// ─── Excel Export: สรุป Plant/Line ─────────────────────────────────────────────
const exportPlantSummaryExcel = (rows, { title, dateStr, groupByPlant, t }) => {
  const headers = groupByPlant
    ? [t('col.no'), t('col.plant'), t('col.line'), t('col.shiftDS'), t('col.shiftNS'), t('col.status')]
    : [t('col.no'), t('col.line'), t('col.shiftDS'), t('col.shiftNS'), t('col.status')];
  const colCount = headers.length;

  const doneCount  = (rows || []).filter(l => l.ds || l.ns).length;
  const totalCount = (rows || []).length;

  const aoa = [
    [title],
    [`${t('label.date')}: ${dateStr}`],
    [],
    headers,
  ];

  (rows || []).forEach((l, i) => {
    const both = l.ds && l.ns;
    const done = l.ds || l.ns;
    const status = both ? `✔ ${t('status.bothShifts')}` : done ? `◐ ${t('status.partial')}` : `✕ ${t('status.noReport')}`;
    const dsText = l.ds ? `${t('status.hasReport')} (${l.ds_count})` : t('status.none');
    const nsText = l.ns ? `${t('status.hasReport')} (${l.ns_count})` : t('status.none');
    aoa.push(groupByPlant
      ? [i + 1, l.plant || '-', l.line_name, dsText, nsText, status]
      : [i + 1, l.line_name, dsText, nsText, status]);
  });

  const summaryRowIdx = aoa.length + 1;
  aoa.push([]);
  aoa.push([`${t('label.summary')}: ${doneCount} / ${totalCount} Line`]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
    { s: { r: summaryRowIdx, c: 0 }, e: { r: summaryRowIdx, c: colCount - 1 } },
  ];

  ws['!rows'] = [{ hpx: 24 }, { hpx: 18 }];

  ws['!cols'] = groupByPlant
    ? [{ wch: 5 }, { wch: 10 }, { wch: 22 }, { wch: 20 }, { wch: 20 }, { wch: 18 }]
    : [{ wch: 5 }, { wch: 22 }, { wch: 20 }, { wch: 20 }, { wch: 18 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Summary');

  const safeTitle = title.replace(/[^a-zA-Zก-๙0-9]+/g, '_');
  XLSX.writeFile(wb, `${safeTitle}_${dateStr}.xlsx`);
};

// ─── PDF Export: สรุป Plant/Line ───────────────────────────────────────────────
const exportPlantSummaryPDF = (rows, { title, dateStr, groupByPlant, t }) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  try {
    doc.addFileToVFS('Sarabun.ttf', thSarabunBase64);
    doc.addFont('Sarabun.ttf', 'Sarabun', 'normal');
    doc.addFont('Sarabun.ttf', 'Sarabun', 'bold');
    doc.setFont('Sarabun', 'normal');
  } catch (e) { doc.setFont('helvetica'); }

  const pageW  = doc.internal.pageSize.getWidth();
  const margin = 12;

  doc.setFontSize(15); doc.setTextColor(20, 20, 20);
  doc.text(title, pageW / 2, 16, { align: 'center' });
  doc.setFontSize(10); doc.setTextColor(90, 90, 90);
  doc.text(`${t('label.date')}: ${dateStr}`, pageW / 2, 23, { align: 'center' });

  const head = groupByPlant
    ? [t('col.no'), t('col.plant'), t('col.line'), t('col.shiftDS'), t('col.shiftNS'), t('col.status')]
    : [t('col.no'), t('col.line'), t('col.shiftDS'), t('col.shiftNS'), t('col.status')];

  const statusKinds = [];
  const body = (rows || []).map((l, i) => {
    const both = l.ds && l.ns;
    const done = l.ds || l.ns;
    statusKinds.push(both ? 'both' : done ? 'partial' : 'none');
    const status = both ? t('status.bothShifts') : done ? t('status.partial') : t('status.noReport');
    const dsText = l.ds ? `${t('status.hasReport')} (${l.ds_count})` : t('status.none');
    const nsText = l.ns ? `${t('status.hasReport')} (${l.ns_count})` : t('status.none');
    return groupByPlant
      ? [i + 1, l.plant || '-', l.line_name, dsText, nsText, status]
      : [i + 1, l.line_name, dsText, nsText, status];
  });

  const statusColIdx = head.length - 1;
  const STATUS_COLORS = { both: [46, 125, 50], partial: [141, 110, 0], none: [183, 28, 28] };

  autoTable(doc, {
    startY: 28,
    head: [head], body,
    margin: { left: margin, right: margin },
    styles: { font: 'Sarabun', fontStyle: 'normal', fontSize: 9, cellPadding: 1.8, lineWidth: 0.2, lineColor: [180, 180, 180], valign: 'middle' },
    headStyles: { font: 'Sarabun', fontStyle: 'normal', fillColor: [38, 50, 56], textColor: [255, 255, 255], halign: 'center' },
    alternateRowStyles: { fillColor: [247, 250, 253] },
    columnStyles: { 0: { cellWidth: 10, halign: 'center' } },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === statusColIdx) {
        data.cell.styles.textColor = STATUS_COLORS[statusKinds[data.row.index]];
      }
    },
  });

  const doneCount  = (rows || []).filter(l => l.ds || l.ns).length;
  const totalCount = (rows || []).length;
  const y = doc.lastAutoTable.finalY + 8;
  doc.setFontSize(10.5); doc.setTextColor(20, 20, 20);
  doc.text(`${t('label.summary')}: ${doneCount} / ${totalCount} Line`, margin, y);

  const safeTitle = title.replace(/[^a-zA-Zก-๙0-9]+/g, '_');
  doc.save(`${safeTitle}_${dateStr}.pdf`);
};

// ─── Plant/Line Summary Tab ─────────────────────────────────────────────────────
const PlantLineSummaryTab = ({ lines, activeReports }) => {
  const { t } = useLang();
  const today = getBusinessDate();
  const [selectedDate,    setSelectedDate]    = useState(today);
  const [selectedPlant,   setSelectedPlant]   = useState('');
  const [viewMode,        setViewMode]        = useState('table');
  const [allDoneReports,  setAllDoneReports]  = useState([]);
  const [loading,         setLoading]         = useState(false);
  const [loadError,       setLoadError]       = useState('');

  const fetchAllDone = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await axios.get(`${API_URL}/api/pack/pkg/reports/done`);
      if (res.data.success) setAllDoneReports(res.data.data || []);
      else throw new Error(res.data.error || t('msg.loadDataFailed'));
    } catch (err) {
      console.error('PlantLineSummaryTab fetchAllDone error:', err);
      setLoadError(t('msg.loadHistoryFailed') + (err.response?.data?.error || err.message));
    } finally { setLoading(false); }
  }, [t]);

  useEffect(() => { fetchAllDone(); }, [fetchAllDone]);

  const combinedReports = useMemo(
    () => [...allDoneReports, ...(activeReports || [])],
    [allDoneReports, activeReports]
  );

  const reportsOnDate = useMemo(() =>
    combinedReports.filter(r =>
      fmtDate(r.report_date) === selectedDate &&
      (!selectedPlant || r.plant === selectedPlant)
    ), [combinedReports, selectedDate, selectedPlant]);

  const lineSummary = useMemo(() => {
    const map = {};
    lines.forEach(l => {
      if (selectedPlant && l.plant !== selectedPlant) return;
      if (!map[l.line_name]) map[l.line_name] = { line_name: l.line_name, plant: l.plant || '', ds: false, ns: false, ds_count: 0, ns_count: 0 };
    });
    reportsOnDate.forEach(r => {
      const key = r.line_name;
      if (!map[key]) map[key] = { line_name: key, plant: r.plant || '', ds: false, ns: false, ds_count: 0, ns_count: 0 };
      if (r.shift === 'DS') { map[key].ds = true; map[key].ds_count++; }
      if (r.shift === 'NS') { map[key].ns = true; map[key].ns_count++; }
    });
    return Object.values(map).sort((a, b) => a.line_name.localeCompare(b.line_name, 'th'));
  }, [lines, reportsOnDate, selectedPlant]);

  const fullLineSummaryAllPlants = useMemo(() => {
    const map = {};
    lines.forEach(l => {
      if (!map[l.line_name]) map[l.line_name] = { line_name: l.line_name, plant: l.plant || '', ds: false, ns: false, ds_count: 0, ns_count: 0 };
    });
    const reportsAllPlantsOnDate = combinedReports.filter(r => fmtDate(r.report_date) === selectedDate);
    reportsAllPlantsOnDate.forEach(r => {
      const key = r.line_name;
      if (!map[key]) map[key] = { line_name: key, plant: r.plant || '', ds: false, ns: false, ds_count: 0, ns_count: 0 };
      if (r.shift === 'DS') { map[key].ds = true; map[key].ds_count++; }
      if (r.shift === 'NS') { map[key].ns = true; map[key].ns_count++; }
    });
    return Object.values(map).sort((a, b) => (a.plant || '').localeCompare(b.plant || '') || a.line_name.localeCompare(b.line_name, 'th'));
  }, [lines, combinedReports, selectedDate]);

  const chartData = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dates14 = Array.from({ length: 14 }, (_, i) => {
      const dt = new Date(Date.UTC(y, m - 1, d));
      dt.setUTCDate(dt.getUTCDate() - (13 - i));
      return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
    });
    return dates14.map(date => {
      const reps = combinedReports.filter(r =>
        fmtDate(r.report_date) === date && (!selectedPlant || r.plant === selectedPlant)
      );
      const lineMap = {};
      reps.forEach(r => {
        if (!lineMap[r.line_name]) lineMap[r.line_name] = { line_name: r.line_name, ds: false, ns: false };
        if (r.shift === 'DS') lineMap[r.line_name].ds = true;
        if (r.shift === 'NS') lineMap[r.line_name].ns = true;
      });
      return { date, lines: Object.values(lineMap) };
    });
  }, [combinedReports, selectedDate, selectedPlant]);

  const doneCount  = lineSummary.filter(l => l.ds || l.ns).length;
  const totalCount = lineSummary.length;
  const percent    = totalCount ? (doneCount / totalCount) * 100 : 0;

  const SUMMARY_PLANTS = ['PF1', 'PF2', 'FD'];
  const plantBreakdown = useMemo(() => {
    const reportsAllPlantsOnDate = combinedReports.filter(r => fmtDate(r.report_date) === selectedDate);
    const lineStatus = {};
    lines.forEach(l => {
      lineStatus[l.line_name] = { plant: l.plant || '-', done: false };
    });
    reportsAllPlantsOnDate.forEach(r => {
      if (!lineStatus[r.line_name]) lineStatus[r.line_name] = { plant: r.plant || '-', done: false };
      lineStatus[r.line_name].done = true;
    });
    const map = {};
    Object.values(lineStatus).forEach(ls => {
      const key = ls.plant || '-';
      if (!map[key]) map[key] = { done: 0, total: 0 };
      map[key].total += 1;
      if (ls.done) map[key].done += 1;
    });
    return map;
  }, [lines, combinedReports, selectedDate]);

  const PLANT_CARD_STYLE = {
    PF1: { icon: '🏭', color: '#1565C0', bg: '#e3f2fd' },
    PF2: { icon: '🏗️', color: '#6a1b9a', bg: '#f3e5f5' },
    FD:  { icon: '❄️', color: '#00838f', bg: '#e0f7fa' },
  };

  const rowExportOpts = (l) => ({
    title: `${t('label.summaryTitle')} · ${l.plant || '-'} · ${l.line_name}`,
    dateStr: selectedDate,
    groupByPlant: true,
    t,
  });
  const handleExportRow    = (l) => exportPlantSummaryExcel([l], rowExportOpts(l));
  const handleExportRowPdf = (l) => exportPlantSummaryPDF([l], rowExportOpts(l));

  const allPlantsExportOpts = {
    title: `${t('label.summaryTitle')} · ${t('label.allPlantsSuffix')}`,
    dateStr: selectedDate, groupByPlant: true, t,
  };
  const plantExportOpts = (p) => ({
    title: `${t('label.summaryTitle')} · ${t('label.plantPrefix')} ${p}`,
    dateStr: selectedDate, groupByPlant: false, t,
  });

  const SUMMARY_TABLE_COLS = ['col.no', 'col.plant', 'col.line', 'col.shiftDS', 'col.shiftNS', 'col.status', 'col.export'];

  return (
    <Box>
      <Paper elevation={0} sx={{
        p: 2, mb: 2.5, borderRadius: '16px', border: '1px solid #eceff1',
        background: 'linear-gradient(135deg, #f5f9ff 0%, #ffffff 100%)',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2.5, flexWrap: 'wrap' }}>
          <Box>
            <FL>{t('filter.reportDate')}</FL>
            <input type="date" value={selectedDate} max={today}
              onChange={e => setSelectedDate(e.target.value || today)}
              style={{ ...dateStyle, width: '155px', fontWeight: 600 }} />
          </Box>
          <Box>
            <FL>{t('filter.plant')}</FL>
            <Box sx={{ display: 'flex', gap: 0.6 }}>
              {['', ...PLANTS].map(p => (
                <Box key={p || 'all'} onClick={() => setSelectedPlant(p)} sx={{
                  px: 1.6, py: 0.6, borderRadius: '8px', fontSize: '12.5px', fontWeight: 600,
                  cursor: 'pointer', userSelect: 'none', transition: 'all .15s',
                  border: selectedPlant === p ? '1.5px solid #1976D2' : '1.5px solid #e0e0e0',
                  backgroundColor: selectedPlant === p ? '#1976D2' : '#fff',
                  color: selectedPlant === p ? '#fff' : '#607d8b',
                }}>
                  {p || t('filter.allPlants')}
                </Box>
              ))}
            </Box>
          </Box>
          {selectedDate !== today && (
            <Button size="small" onClick={() => setSelectedDate(today)}
              sx={{ fontSize: '11.5px', textTransform: 'none', color: '#1976D2' }}>
              {t('btn.backToday')}
            </Button>
          )}
          <Button size="small" onClick={fetchAllDone} disabled={loading}
            sx={{ fontSize: '11.5px', textTransform: 'none', color: '#607d8b' }}>
            {loading ? <CircularProgress size={12} sx={{ mr: 0.7 }} /> : null}
            {t('btn.refresh')}
          </Button>

          <Box sx={{ display: 'flex', gap: 0.8 }}>
            <ExportBtn kind="excel" label={t('btn.exportExcelAll')}
              onClick={() => exportPlantSummaryExcel(fullLineSummaryAllPlants, allPlantsExportOpts)}
              sx={{ fontSize: '11.5px', px: 1.4, py: 0.6 }} />
            <ExportBtn kind="pdf" label={t('btn.exportPdfAll')}
              onClick={() => exportPlantSummaryPDF(fullLineSummaryAllPlants, allPlantsExportOpts)}
              sx={{ fontSize: '11.5px', px: 1.4, py: 0.6 }} />
          </Box>

          <Box sx={{ ml: 'auto', display: 'flex', gap: 0.5, backgroundColor: '#eceff1', borderRadius: '10px', p: 0.4 }}>
            <Button size="small" onClick={() => setViewMode('table')}
              startIcon={<TableChart sx={{ fontSize: 15 }} />}
              sx={{
                fontSize: '12px', textTransform: 'none', borderRadius: '8px', px: 1.5,
                backgroundColor: viewMode === 'table' ? '#fff' : 'transparent',
                color: viewMode === 'table' ? '#1976D2' : '#78909c',
                boxShadow: viewMode === 'table' ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                fontWeight: viewMode === 'table' ? 700 : 500,
                '&:hover': { backgroundColor: viewMode === 'table' ? '#fff' : '#e0e0e0' },
              }}>{t('view.table')}</Button>
            <Button size="small" onClick={() => setViewMode('chart')}
              startIcon={<BarChart sx={{ fontSize: 15 }} />}
              sx={{
                fontSize: '12px', textTransform: 'none', borderRadius: '8px', px: 1.5,
                backgroundColor: viewMode === 'chart' ? '#fff' : 'transparent',
                color: viewMode === 'chart' ? '#1976D2' : '#78909c',
                boxShadow: viewMode === 'chart' ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                fontWeight: viewMode === 'chart' ? 700 : 500,
                '&:hover': { backgroundColor: viewMode === 'chart' ? '#fff' : '#e0e0e0' },
              }}>{t('view.chart')}</Button>
          </Box>
        </Box>
      </Paper>

      {loadError && (
        <Box sx={{ mb: 2, p: 1.2, borderRadius: '10px', backgroundColor: '#ffebee', border: '1px solid #ef9a9a', fontSize: '12px', color: '#b71c1c' }}>
          ⚠️ {loadError}
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 1.6, mb: 2.5, flexWrap: 'wrap', alignItems: 'stretch' }}>
        <Paper elevation={0} sx={{
          flex: '1 1 200px', minWidth: 190, display: 'flex', alignItems: 'center', gap: 2,
          p: 2, borderRadius: '16px', border: '1px solid #eceff1',
          background: 'linear-gradient(135deg, #e8f5e9 0%, #ffffff 130%)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <ProgressRing percent={percent} color="#2e7d32" track="#c8e6c9" />
          <Box>
            <Typography sx={{ fontSize: '11px', color: '#78909c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>
              {t('label.overallProgress')}
            </Typography>
            <Typography sx={{ fontSize: '13px', color: '#37474f', fontWeight: 600, mt: 0.3 }}>
              {doneCount} / {totalCount} Line
            </Typography>
            <Typography sx={{ fontSize: '11px', color: '#90a4ae', mt: 0.1 }}>
              {selectedDate}
            </Typography>
          </Box>
        </Paper>

        {SUMMARY_PLANTS.map(p => {
          const stat  = plantBreakdown[p] || { done: 0, total: 0 };
          const style = PLANT_CARD_STYLE[p];
          return (
            <StatCard key={p} icon={style.icon}
              value={`${stat.done} / ${stat.total}`}
              label={p}
              color={style.color} bg={style.bg}
              onExport={() => exportPlantSummaryExcel(
                fullLineSummaryAllPlants.filter(l => l.plant === p), plantExportOpts(p)
              )}
              onExportPdf={() => exportPlantSummaryPDF(
                fullLineSummaryAllPlants.filter(l => l.plant === p), plantExportOpts(p)
              )}
            />
          );
        })}
      </Box>

      {viewMode === 'chart' && (
        <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2.5 }, mb: 2, borderRadius: '16px', border: '1px solid #eceff1' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            <Box>
              <Typography sx={{ fontSize: '14px', fontWeight: 700, color: '#263238' }}>
                {t('label.chart14days')}
              </Typography>
              <Typography sx={{ fontSize: '11.5px', color: '#90a4ae', mt: 0.2 }}>
                {t('label.chartCountedUntil', { date: selectedDate })}{selectedPlant ? ` · ${t('label.plantPrefix')} ${selectedPlant}` : ` · ${t('label.allPlantsSuffix')}`}
              </Typography>
            </Box>
          </Box>
          {loading ? (
            <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress size={26} /></Box>
          ) : (
            <SummaryBarChart data={chartData} selectedDate={selectedDate} />
          )}
        </Paper>
      )}

      {viewMode === 'table' && (
        <Paper elevation={0} sx={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid #eceff1', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <TableContainer sx={{ maxHeight: '520px' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  {SUMMARY_TABLE_COLS.map(k => (
                    <TableCell key={k} align={k === 'col.export' ? 'center' : 'left'} sx={{
                      background: 'linear-gradient(135deg, #263238 0%, #37474f 100%)',
                      color: '#fff', fontSize: '11.5px', fontWeight: 700, letterSpacing: 0.2,
                      whiteSpace: 'nowrap', py: 1.2, px: 1.5, border: 'none',
                    }}>
                      {t(k)}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={SUMMARY_TABLE_COLS.length} align="center" sx={{ py: 5 }}>
                      <CircularProgress size={24} />
                    </TableCell>
                  </TableRow>
                ) : lineSummary.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={SUMMARY_TABLE_COLS.length} align="center" sx={{ py: 5, color: '#b0bec5', fontSize: '13px' }}>
                      {t('table.noLineData')}
                    </TableCell>
                  </TableRow>
                ) : lineSummary.map((l, i) => {
                  const done = l.ds || l.ns;
                  const both = l.ds && l.ns;
                  const accent = both ? '#2e7d32' : done ? '#f9a825' : '#e0e0e0';
                  return (
                    <TableRow key={l.line_name} sx={{
                      backgroundColor: i % 2 === 0 ? '#fff' : '#fafcff',
                      borderLeft: `3px solid ${accent}`,
                      transition: 'background-color .15s',
                      '&:hover': { backgroundColor: '#f1f8ff' },
                    }}>
                      <TableCell sx={{ ...cellSx, color: '#b0bec5', fontWeight: 600 }}>{i + 1}</TableCell>
                      <TableCell sx={cellSx}>
                        <Chip label={l.plant || '-'} size="small"
                          sx={{ fontSize: '10px', height: '20px', fontWeight: 700,
                            backgroundColor: l.plant === 'PF1' ? '#e3f2fd' : '#f3e5f5',
                            color: l.plant === 'PF1' ? '#1565C0' : '#6a1b9a' }} />
                      </TableCell>
                      <TableCell sx={{ ...cellSx, fontWeight: 700, color: '#263238' }}>{l.line_name}</TableCell>
                      <TableCell sx={cellSx}>
                        {l.ds ? (
                          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6, px: 1.1, py: 0.4, borderRadius: '20px', backgroundColor: '#e3f2fd', color: '#1565C0', fontSize: '11px', fontWeight: 700 }}>
                            <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#1565C0' }} /> {l.ds_count} {t('status.hasReport')}
                          </Box>
                        ) : (
                          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6, px: 1.1, py: 0.4, borderRadius: '20px', backgroundColor: '#f5f5f5', color: '#b0bec5', fontSize: '11px', fontWeight: 600 }}>
                            <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#cfd8dc' }} /> {t('status.none')}
                          </Box>
                        )}
                      </TableCell>
                      <TableCell sx={cellSx}>
                        {l.ns ? (
                          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6, px: 1.1, py: 0.4, borderRadius: '20px', backgroundColor: '#ede7f6', color: '#4527a0', fontSize: '11px', fontWeight: 700 }}>
                            <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#4527a0' }} /> {l.ns_count} {t('status.hasReport')}
                          </Box>
                        ) : (
                          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6, px: 1.1, py: 0.4, borderRadius: '20px', backgroundColor: '#f5f5f5', color: '#b0bec5', fontSize: '11px', fontWeight: 600 }}>
                            <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#cfd8dc' }} /> {t('status.none')}
                          </Box>
                        )}
                      </TableCell>
                      <TableCell sx={cellSx}>
                        {both ? (
                          <Chip label={`✓ ${t('status.bothShifts')}`} size="small"
                            sx={{ fontSize: '10.5px', height: '22px', fontWeight: 700, backgroundColor: '#2e7d32', color: '#fff' }} />
                        ) : done ? (
                          <Chip label={`◐ ${t('status.partial')}`} size="small"
                            sx={{ fontSize: '10.5px', height: '22px', fontWeight: 700, backgroundColor: '#fff3c4', color: '#8d6e00' }} />
                        ) : (
                          <Chip label={`✕ ${t('status.noReport')}`} size="small"
                            sx={{ fontSize: '10.5px', height: '22px', fontWeight: 700, backgroundColor: '#fce4e4', color: '#b71c1c' }} />
                        )}
                      </TableCell>
                      <TableCell sx={{ ...cellSx, textAlign: 'center', minWidth: 150 }}>
                        <Box sx={{ display: 'inline-flex', gap: 0.6 }}>
                          <ExportBtn kind="excel" label={t('btn.excelShort')}
                            tooltip={`${t('btn.exportExcel')}: ${l.line_name}`}
                            onClick={() => handleExportRow(l)} />
                          <ExportBtn kind="pdf" label={t('btn.pdfShort')}
                            tooltip={`${t('btn.exportPdf')}: ${l.line_name}`}
                            onClick={() => handleExportRowPdf(l)} />
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
};

// ─── PDF Export (เอกสารรายฉบับ — คงรูปแบบเดิม เป็นภาษาไทยเสมอ) ─────────────────
const exportPDF = (report, details) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  try {
    doc.addFileToVFS('Sarabun.ttf', thSarabunBase64);
    doc.addFont('Sarabun.ttf', 'Sarabun', 'normal');
    doc.addFont('Sarabun.ttf', 'Sarabun', 'bold');
    doc.setFont('Sarabun', 'normal');
  } catch (e) { doc.setFont('helvetica'); }

  const pageW  = doc.internal.pageSize.getWidth();
  const margin = 10;
  const dateStr = fmtDate(report.report_date);

  doc.setFont('Sarabun', 'normal'); doc.setFontSize(9.5); doc.setTextColor(80, 80, 80);
  doc.text('บริษัท ไอ-เทล คอร์ปอเรชั่น จำกัด (มหาชน)', pageW / 2, 9, { align: 'center' });
  doc.text('หมายเลขเอกสาร:  F3QCSM21', pageW - margin, 9, { align: 'right' });
  doc.setTextColor(20, 20, 20); doc.setFontSize(16);
  doc.text('รายงานการใช้บรรจุภัณฑ์', pageW / 2, 18, { align: 'center' });

  const infoY = 24; const infoH = 9;
  const col1W = 55; const col2W = 32; const col3W = 50;
  const col4X = margin + col1W + col2W + col3W;

  doc.setFillColor(240, 247, 255);
  doc.rect(margin, infoY, pageW - margin * 2, infoH, 'F');
  doc.setLineWidth(0.3); doc.rect(margin, infoY, pageW - margin * 2, infoH);
  doc.line(margin + col1W, infoY, margin + col1W, infoY + infoH);
  doc.line(margin + col1W + col2W, infoY, margin + col1W + col2W, infoY + infoH);
  doc.line(col4X, infoY, col4X, infoY + infoH);

  doc.setFont('Sarabun', 'normal'); doc.setFontSize(9.5);
  doc.text(`วันที่: ${dateStr}`, margin + 3, infoY + 6);
  doc.text(`กะ: ${report.shift || '-'}`, margin + col1W + 3, infoY + 6);
  doc.text(`โรงผลิต: ${report.plant || '-'}`, margin + col1W + col2W + 3, infoY + 6);

  let cx = col4X + 3;
  doc.text('บรรจุภัณฑ์:', cx, infoY + 6);
  cx += doc.getTextWidth('บรรจุภัณฑ์:') + 3;
  PKG_TYPES.forEach(t => {
    const boxSize = 3.8; const boxY = infoY + infoH / 2 - boxSize / 2;
    doc.setLineWidth(0.3); doc.rect(cx, boxY, boxSize, boxSize);
    if (report.package_type === t) {
      doc.setLineWidth(0.55);
      doc.line(cx + 0.5, boxY + 2.0, cx + 1.5, boxY + 3.2);
      doc.line(cx + 1.5, boxY + 3.2, cx + 3.4, boxY + 0.6);
      doc.setLineWidth(0.3);
    }
    doc.text(t, cx + boxSize + 1.5, infoY + 6);
    cx += boxSize + 1.5 + doc.getTextWidth(t) + 6;
  });

  // แถบเสริม: แสดงชื่อเครื่องผลิต (Sachet) ถ้าเอกสารนี้เป็นไลน์ Sachet
  if (isSachetLine(report.line_name) && report.machine_name) {
    doc.setFontSize(9); doc.setTextColor(21, 101, 192);
    doc.text(`Machine: ${report.machine_name}`, pageW - margin, infoY + infoH + 5, { align: 'right' });
    doc.setTextColor(20, 20, 20);
  }

  const pouch   = isPouchSachetLine(report.line_name); // Ink / Roll No. / Side
  const showQty = needsQtyCols(report.line_name);       // รับ / ใช้ / เสีย / คงเหลือ (Pouch/Sachet + Cup 4/5)
  const wide    = pouch || showQty;                     // ตารางกว้างกว่าปกติ → ลดขนาดฟอนต์

  const baseHeaders = ['Line', 'Code', 'Material No.', 'Lot No.', 'Box No.',
    'วันที่ผลิต / เวลา', 'วันที่รับเข้า', 'Batch No.', 'HU No.',
    'เวลาเริ่มปล่อย', 'เวลาหยุดปล่อย', 'จำนวน', 'หมายเหตุ'];
  const pdfHeaders = [
    ...baseHeaders.slice(0, 9),
    ...(pouch ? POUCH_COLS_MID : []),
    ...baseHeaders.slice(9),
    ...(showQty ? POUCH_COLS_END : []),
  ];

  const rows = details.map(d => {
    const base = [
      report.line_name || '-', d.code || '', d.material_no || '', d.lot_no || '', d.box_no || '',
      fmtDT(d.produce_date), fmtDate(d.receive_date), d.batch_no || '', d.hu_no || '',
    ];
    const mid  = pouch   ? [d.ink || '', d.roll_no || '', d.side || ''] : [];
    const tail = [fmtDT(d.start_time), fmtDT(d.stop_time), d.qty ?? '', d.remark || ''];
    const end  = showQty ? [d.qty_received ?? '', d.qty_used ?? '', d.qty_damaged ?? '', d.qty_remaining ?? ''] : [];
    return [...base, ...mid, ...tail, ...end];
  });

  const colCount = pdfHeaders.length;
  while (rows.length < 14) rows.push(Array(colCount).fill(''));

  autoTable(doc, {
    startY: infoY + infoH + (isSachetLine(report.line_name) && report.machine_name ? 9 : 5),
    head: [pdfHeaders], body: rows,
    margin: { left: margin, right: margin },
    styles: { font: 'Sarabun', fontStyle: 'normal', fontSize: wide ? 6.6 : 7.2, cellPadding: wide ? 1.1 : 1.4, lineWidth: 0.2, lineColor: [180, 180, 180], valign: 'middle' },
    headStyles: { font: 'Sarabun', fontStyle: 'normal', fillColor: [25, 118, 210], textColor: [255, 255, 255], lineWidth: 0.2, lineColor: [180, 180, 180], fontSize: wide ? 7.5 : 8.5, halign: 'center' },
    alternateRowStyles: { fillColor: [247, 250, 253] },
    ...(wide ? {} : {
      columnStyles: {
        0: { cellWidth: 18 }, 1: { cellWidth: 16 }, 2: { cellWidth: 26 },
        3: { cellWidth: 18 }, 4: { cellWidth: 16 }, 5: { cellWidth: 30 },
        6: { cellWidth: 22 }, 7: { cellWidth: 20 }, 8: { cellWidth: 18 },
        9: { cellWidth: 30 }, 10: { cellWidth: 30 }, 11: { cellWidth: 14 }, 12: { cellWidth: 'auto' },
      },
    }),
  });

  const sigNameY = doc.lastAutoTable.finalY + 12;
  const sigLineY = sigNameY + 3; const sigLabelY = sigLineY + 5;
  const sigLineHalfW = 40;
  const leftCenterX  = margin + 55;
  const rightCenterX = pageW - margin - 65;

  doc.setFont('Sarabun', 'normal'); doc.setFontSize(9.5);
  doc.text(report.reported_by || '-', leftCenterX, sigNameY, { align: 'center' });
  doc.text(report.qc_supervisor || '-', rightCenterX, sigNameY, { align: 'center' });
  doc.setLineWidth(0.3);
  doc.line(leftCenterX - sigLineHalfW, sigLineY, leftCenterX + sigLineHalfW, sigLineY);
  doc.line(rightCenterX - sigLineHalfW, sigLineY, rightCenterX + sigLineHalfW, sigLineY);
  doc.setFontSize(8.5); doc.setTextColor(90, 90, 90);
  doc.text('รายงานโดย', leftCenterX, sigLabelY, { align: 'center' });
  doc.text('QC Section Manager', rightCenterX, sigLabelY, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  doc.save(`รายงานบรรจุภัณฑ์_${report.report_id}_${dateStr}.pdf`);
};

// ─── Pouch/Sachet extra columns ────────────────────────────────────────────────
const POUCH_COLS_MID    = ['Ink', 'Roll No.', 'Side'];
const POUCH_COLS_END    = ['รับ', 'ใช้', 'เสีย', 'คงเหลือ'];
const POUCH_FIELDS_MID  = ['ink', 'roll_no', 'side'];
const POUCH_FIELDS_END  = ['qty_received', 'qty_used', 'qty_damaged', 'qty_remaining'];
const POUCH_DATE_FIELDS = [];

// ─── PouchCell ─────────────────────────────────────────────────────────────────
const PouchCell = ({ value, field, isDate, disabled, onClick }) => {
  const hasValue = value !== null && value !== undefined && String(value) !== '';
  const display  = hasValue ? (isDate ? fmtDate(value) : String(value)) : '-';
  return (
    <TableCell onClick={e => { e.stopPropagation(); if (!disabled) onClick(); }}
      sx={{ ...cellSx, color: hasValue ? '#333' : '#bbb', cursor: disabled ? 'default' : 'pointer',
        '&:hover': disabled ? {} : { backgroundColor: '#fff3e0' } }}>
      {display}
    </TableCell>
  );
};

// ─── Edit Detail Modal ─────────────────────────────────────────────────────────
// pouch   = ไลน์ Pouch/Sachet → แสดง Ink / Roll No. / Side
// showQty = ไลน์ Pouch/Sachet + Cup 4/5 → แสดง รับ / ใช้ / เสีย / คงเหลือ
const EditDetailModal = ({ open, onClose, detail, onSaved, pouch, showQty }) => {
  const { t } = useLang();
  const [form, setForm]     = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && detail) {
      setForm({
        code: detail.code ?? '', material_no: detail.material_no ?? '',
        lot_no: detail.lot_no ?? '', box_no: detail.box_no ?? '',
        batch_no: detail.batch_no ?? '', hu_no: detail.hu_no ?? '',
        produce_date: detail.produce_date ? fmtDate(detail.produce_date) : '',
        receive_date: detail.receive_date ? fmtDate(detail.receive_date) : '',
        start_time: detail.start_time ? fmtDT(detail.start_time) : '',
        stop_time: detail.stop_time ? fmtDT(detail.stop_time) : '',
        qty: detail.qty ?? '', remark: detail.remark ?? '',
        ink: detail.ink ?? '', roll_no: detail.roll_no ?? '', side: detail.side ?? '',
        qty_received: detail.qty_received ?? '', qty_used: detail.qty_used ?? '',
        qty_damaged: detail.qty_damaged ?? '', qty_remaining: detail.qty_remaining ?? '',
      });
    }
  }, [open, detail]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form };
      ['qty', 'qty_received', 'qty_used', 'qty_damaged', 'qty_remaining'].forEach(f => {
        if (payload[f] === '' || payload[f] === null || payload[f] === undefined) payload[f] = null;
        else payload[f] = Number(payload[f]);
      });
      ['produce_date', 'receive_date', 'start_time', 'stop_time'].forEach(f => {
        if (payload[f] === '') payload[f] = null;
      });
      await axios.put(`${API_URL}/api/pack/pkg/details/${detail.detail_id}`, payload);
      await onSaved();
      onClose();
    } catch (err) {
      alert(t('msg.saveFailed') + (err.response?.data?.error || err.message));
    } finally { setSaving(false); }
  };

  if (!detail) return null;

  const fieldRow = (key, label, editor) => (<Box key={key}><FL>{label}</FL>{editor}</Box>);
  const textField     = (key) => <TextField fullWidth size="small" value={form[key] ?? ''} onChange={e => set(key, e.target.value)} sx={inputSx} />;
  const numField      = (key) => <TextField fullWidth size="small" type="number" value={form[key] ?? ''} onChange={e => set(key, e.target.value)} sx={inputSx} />;
  const dateTimeField = (key) => <DateTimeEditor value={form[key]} onChange={v => set(key, v)} />;
  const dateField     = (key) => <input type="date" value={form[key] ?? ''} onChange={e => set(key, e.target.value)} style={{ ...dateStyle, width: '100%' }} />;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1.5, borderBottom: '1px solid #e0e0e0' }}>
        <Typography sx={{ fontWeight: 'bold', fontSize: '15px' }}>{t('detail.editRowTitle')}</Typography>
        <IconButton onClick={onClose} size="small"><Close /></IconButton>
      </Box>
      <DialogContent sx={{ pt: 2 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1.5 }}>
          {fieldRow('code', t('col.code'), textField('code'))}
          {fieldRow('material_no', t('col.materialNo'), textField('material_no'))}
          {fieldRow('lot_no', t('col.lotNo'), textField('lot_no'))}
          {fieldRow('box_no', t('col.boxNo'), textField('box_no'))}
          {fieldRow('batch_no', t('col.batchNo'), textField('batch_no'))}
          {fieldRow('hu_no', t('col.huNo'), textField('hu_no'))}
          <Box sx={{ gridColumn: '1 / -1' }}><FL>{t('col.produceDate')}</FL>{dateTimeField('produce_date')}</Box>
          {fieldRow('receive_date', t('col.receiveDate'), dateField('receive_date'))}
          {fieldRow('qty', t('col.qty'), numField('qty'))}
          {fieldRow('remark', t('col.remark'), textField('remark'))}
        </Box>
        <Box sx={{ mt: 1.5, borderTop: '1px solid #e0e0e0', pt: 1.5 }}>
          <Typography sx={{ fontSize: '12px', fontWeight: 'bold', color: '#555', mb: 1 }}>{t('detail.releaseTime')}</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <Box><FL>{t('col.startTime')}</FL>{dateTimeField('start_time')}</Box>
            <Box><FL>{t('col.stopTime')}</FL>{dateTimeField('stop_time')}</Box>
          </Box>
        </Box>
        {(pouch || showQty) && (
          <Box sx={{ mt: 1.5, borderTop: '1px solid #e0e0e0', pt: 1.5 }}>
            <Typography sx={{ fontSize: '12px', fontWeight: 'bold', color: '#555', mb: 1 }}>
              {pouch ? t('detail.pouchSachet') : t('detail.qtyBlock')}
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1.5 }}>
              {pouch && fieldRow('ink', 'Ink', textField('ink'))}
              {pouch && fieldRow('roll_no', 'Roll No.', textField('roll_no'))}
              {pouch && fieldRow('side', 'Side', textField('side'))}
              {showQty && fieldRow('qty_received', t('detail.qtyReceived'), numField('qty_received'))}
              {showQty && fieldRow('qty_used', t('detail.qtyUsed'), numField('qty_used'))}
              {showQty && fieldRow('qty_damaged', t('detail.qtyDamaged'), numField('qty_damaged'))}
              {showQty && fieldRow('qty_remaining', t('detail.qtyRemaining'), numField('qty_remaining'))}
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button size="small" onClick={onClose}>{t('btn.cancel')}</Button>
        <Button size="small" variant="contained" onClick={handleSave}
          disabled={saving} startIcon={saving && <CircularProgress size={12} color="inherit" />}>
          {t('btn.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── Document Detail View ──────────────────────────────────────────────────────
const DocumentDetailView = ({ report, onBack, isDone }) => {
  const { t } = useLang();
  const [details,     setDetails]     = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [qrText,      setQrText]      = useState('');
  const [scanning,    setScanning]    = useState(false);
  const [camOpen,     setCamOpen]     = useState(false);
  const [stopScanId,  setStopScanId]  = useState(null);
  const [stopCamOpen, setStopCamOpen] = useState(false);
  const [stopping,    setStopping]    = useState(false);
  const [editDetail,  setEditDetail]  = useState(null);
  const scanRef     = useRef(null);
  const stopScanRef = useRef(null);
  // FIX: lock แบบ synchronous กันยิง API ซ้ำ (state `scanning`/`stopping` อัปเดตแบบ async กันไม่ทัน)
  const scanLockRef = useRef(false);
  const stopLockRef = useRef(false);

  const fetchDetails = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/pack/pkg/reports/${report.report_id}`);
      if (res.data.success) {
        let list = res.data.data.details || [];
        if (report._code && report._code !== '-') {
          list = list.filter(d => d.code === report._code);
        }
        setDetails(list);
      }
    } catch (err) { console.error('fetchDetails error:', err); }
    finally { setLoading(false); }
  }, [report.report_id, report._code]);

  useEffect(() => {
    fetchDetails();
    setTimeout(() => scanRef.current?.focus(), 100);
  }, [fetchDetails]);

  const handleStartScan = async (raw) => {
    const slipId = String(raw).trim();
    if (!slipId || scanLockRef.current) return;
    scanLockRef.current = true;
    setScanning(true);
    try {
      const startTime = nowThaiDT();
      const res = await axios.post(`${API_URL}/api/pack/pkg/scan`, { report_id: report.report_id, slip_id: slipId, start_time: startTime });
      if (res.data.success) { await fetchDetails(); }
      else alert(res.data.error || t('msg.qrProcessFailed'));
    } catch (err) {
      alert(err.response?.data?.error || t('msg.slipNotFound', { id: slipId }));
    } finally {
      setQrText(''); setScanning(false);
      scanLockRef.current = false;
      setTimeout(() => scanRef.current?.focus(), 100);
    }
  };

  const handleStopConfirm = async () => {
    if (!stopScanId || stopLockRef.current) return;
    stopLockRef.current = true;
    setStopping(true);
    try {
      const stopTime = nowThaiDT();
      await axios.put(`${API_URL}/api/pack/pkg/details/${stopScanId}`, { stop_time: stopTime });
      await fetchDetails();
      setStopScanId(null); setStopCamOpen(false);
    } catch (err) {
      alert(t('msg.stopTimeSaveFailed') + (err.response?.data?.error || err.message));
    } finally {
      setStopping(false);
      stopLockRef.current = false;
    }
  };

  const handleDelete = async (detail_id) => {
    if (!window.confirm(t('msg.confirmDeleteRow'))) return;
    try {
      await axios.delete(`${API_URL}/api/pack/pkg/details/${detail_id}`);
      setDetails(prev => prev.filter(d => d.detail_id !== detail_id));
    } catch (err) { alert(t('msg.deleteFailed') + (err.response?.data?.error || err.message)); }
  };

  const handleDone = async () => {
    if (!window.confirm(t('msg.confirmDone'))) return;
    setSaving(true);
    try {
      await axios.put(`${API_URL}/api/pack/pkg/reports/${report.report_id}/done`);
      onBack(true);
    } catch (err) {
      alert(t('msg.errorPrefix') + (err.response?.data?.error || err.message));
      setSaving(false);
    }
  };

  const pouch   = isPouchSachetLine(report.line_name); // Ink / Roll No. / Side
  const showQty = needsQtyCols(report.line_name);       // รับ / ใช้ / เสีย / คงเหลือ (Pouch/Sachet + Cup 4/5)
  const DETAIL_COL_KEYS = [
    'col.no', 'col.code', 'col.materialNo', 'col.lotNo', 'col.boxNo',
    'col.produceDate', 'col.receiveDate', 'col.batchNo', 'col.huNo',
    'col.startTime', 'col.stopTime', 'col.qty', 'col.remark',
  ];
  const colLabels = [
    ...DETAIL_COL_KEYS.slice(0, 9).map(k => t(k)),
    ...(pouch ? POUCH_COLS_MID : []),
    ...DETAIL_COL_KEYS.slice(9).map(k => t(k)),
    ...(showQty ? POUCH_COLS_END : []),
    '',
  ];

  return (
    <Box>
      <Dialog open={camOpen} onClose={() => setCamOpen(false)} maxWidth="sm" fullWidth>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1.5, borderBottom: '1px solid #e0e0e0' }}>
          <Box sx={{ fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', gap: 1, color: '#2e7d32' }}><QrCodeScanner /> {t('detail.scanStartTitle')}</Box>
          <IconButton onClick={() => setCamOpen(false)} size="small"><Close /></IconButton>
        </Box>
        <Box sx={{ p: 2 }}>
          {camOpen && <QrScannerView onScan={text => { setCamOpen(false); handleStartScan(text); }} onError={e => console.error(e)} />}
        </Box>
      </Dialog>

      <Dialog open={!!stopScanId} onClose={() => { setStopScanId(null); setStopCamOpen(false); }} maxWidth="sm" fullWidth>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1.5, borderBottom: '1px solid #e0e0e0' }}>
          <Box sx={{ fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', gap: 1, color: '#c62828' }}>
            <Stop /> {t('detail.scanStopTitle')} — #{details.findIndex(d => d.detail_id === stopScanId) + 1}
          </Box>
          <IconButton onClick={() => { setStopScanId(null); setStopCamOpen(false); }} size="small"><Close /></IconButton>
        </Box>
        <DialogContent>
          <Typography sx={{ fontSize: '12px', color: '#666', mb: 1.5 }}>
            {t('detail.scanStopHint')}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField inputRef={stopScanRef} fullWidth size="small"
              placeholder={t('detail.scanStopPlaceholder')}
              onKeyDown={e => { if (e.key === 'Enter') handleStopConfirm(); }} autoFocus />
            <Button size="small" variant="outlined" startIcon={<QrCodeScanner />}
              onClick={() => setStopCamOpen(v => !v)}>{t('btn.camera')}</Button>
          </Box>
          {stopCamOpen && (
            <Box sx={{ mt: 1.5 }}>
              <QrScannerView onScan={() => { setStopCamOpen(false); handleStopConfirm(); }} onError={e => console.error(e)} />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button size="small" onClick={() => { setStopScanId(null); setStopCamOpen(false); }}>{t('btn.cancel')}</Button>
          <Button size="small" variant="contained" color="error" disabled={stopping}
            onClick={handleStopConfirm}
            startIcon={stopping ? <CircularProgress size={12} color="inherit" /> : <Stop />}>
            {t('btn.stopNow')}
          </Button>
        </DialogActions>
      </Dialog>

      <EditDetailModal open={!!editDetail} onClose={() => setEditDetail(null)} detail={editDetail} onSaved={fetchDetails} pouch={pouch} showQty={showQty} />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        <Button startIcon={<ArrowBack />} size="small" variant="outlined" onClick={() => onBack(false)}>{t('btn.back')}</Button>
        <Typography sx={{ fontWeight: 'bold', fontSize: '15px', flex: 1, color: '#111' }}>
          {t('detail.docTitle', { id: report.report_id })}
          {report._code && report._code !== '-' && (
            <Chip label={`Code: ${report._code}`} size="small" sx={{ ml: 1, fontSize: '11px', backgroundColor: '#e3f2fd', color: '#1565C0' }} />
          )}
          {isDone && <Chip label={t('detail.done')} size="small" color="success" sx={{ ml: 1, fontSize: '11px' }} />}
        </Typography>
        <Button variant="outlined" size="small" startIcon={<PictureAsPdf />}
          onClick={() => exportPDF(report, details)}
          sx={{ borderColor: '#d32f2f', color: '#d32f2f', '&:hover': { backgroundColor: '#ffebee' } }}>
          {t('btn.exportPdf')}
        </Button>
        {!isDone && (
          <Button variant="contained" color="success" size="small"
            startIcon={saving ? <CircularProgress size={12} color="inherit" /> : <CheckCircle />}
            onClick={handleDone} disabled={saving}>
            {t('btn.markDone')}
          </Button>
        )}
      </Box>

      <Paper sx={{ p: 1.5, mb: 2, backgroundColor: '#f0f7ff', borderRadius: '8px', border: '1px solid #bbdefb' }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, fontSize: '12px', color: '#333' }}>
          {[[t('col.date'), fmtDate(report.report_date)], [t('col.shift'), report.shift], [t('col.plant'), report.plant],
            [t('col.packageType'), pkgLabel(report.package_type, t)], [t('col.line'), report.line_name],
            ...(isSachetLine(report.line_name) ? [[t('col.machineName'), report.machine_name]] : []),
            [t('col.reportedBy'), report.reported_by], [t('col.qcSupervisor'), report.qc_supervisor],
          ].map(([l, v]) => <Box key={l}><b>{l}:</b> {v || '-'}</Box>)}
        </Box>
      </Paper>

      {!isDone && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, p: 1, backgroundColor: '#e8f5e9', borderRadius: '8px', border: '1px solid #a5d6a7' }}>
          <Box sx={{ fontSize: '12px', fontWeight: 'bold', color: '#1b5e20', whiteSpace: 'nowrap' }}>{t('detail.scanStart')}</Box>
          <TextField inputRef={scanRef} size="small"
            placeholder={t('detail.scanStartPlaceholder')}
            value={qrText} onChange={e => setQrText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleStartScan(qrText); }}
            disabled={scanning}
            sx={{ flex: 1, backgroundColor: '#fff', borderRadius: '4px', '& .MuiInputBase-root': { fontSize: '13px' } }} />
          {scanning && <CircularProgress size={20} />}
          <Button size="small" variant="contained" color="success" startIcon={<QrCodeScanner />}
            onClick={() => setCamOpen(true)}>{t('btn.camera')}</Button>
        </Box>
      )}

      {loading ? (
        <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress size={28} /></Box>
      ) : (
        <TableContainer component={Paper}
          sx={{ borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflowX: 'auto' }}>
          <Table size="small" stickyHeader sx={{ minWidth: pouch ? 1800 : showQty ? 1500 : 1300 }}>
            <TableHead>
              <TableRow>
                {colLabels.map((h, idx) => (
                  <TableCell key={`${h}-${idx}`}
                    sx={{ backgroundColor: '#1565C0', color: '#fff', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap', py: 0.8, px: 1 }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {details.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colLabels.length} align="center" sx={{ py: 5, color: '#999', fontSize: '13px' }}>
                    {t('table.emptyDetailHint')}
                  </TableCell>
                </TableRow>
              ) : details.map((d, i) => (
                <TableRow key={d.detail_id}
                  sx={{ backgroundColor: i % 2 === 0 ? '#fff' : '#f9f9f9', '&:hover': { backgroundColor: '#e3f2fd' } }}>
                  <TableCell sx={{ ...cellSx, color: '#888' }}>{i + 1}</TableCell>
                  <TableCell sx={cellSx}>{d.code || '-'}</TableCell>
                  <TableCell sx={{ ...cellSx, fontFamily: 'monospace' }}>{d.material_no || '-'}</TableCell>
                  <TableCell sx={cellSx}>{d.lot_no || '-'}</TableCell>
                  <TableCell sx={cellSx}>{d.box_no || '-'}</TableCell>
                  <TableCell sx={cellSx}>{fmtDT(d.produce_date)}</TableCell>
                  <TableCell sx={cellSx}>{fmtDate(d.receive_date)}</TableCell>
                  <TableCell sx={cellSx}>{d.batch_no || '-'}</TableCell>
                  <TableCell sx={cellSx}>{d.hu_no || '-'}</TableCell>
                  {pouch && POUCH_FIELDS_MID.map(f => (
                    <PouchCell key={f} value={d[f]} field={f} isDate={POUCH_DATE_FIELDS.includes(f)} disabled={isDone} onClick={() => setEditDetail(d)} />
                  ))}
                  <TableCell sx={{ ...cellSx, color: d.start_time ? '#2e7d32' : '#ccc', fontFamily: 'monospace', fontSize: '11px' }}>{fmtDT(d.start_time)}</TableCell>
                  <TableCell sx={{ ...cellSx, color: d.stop_time ? '#c62828' : '#ccc', fontFamily: 'monospace', fontSize: '11px' }}>{fmtDT(d.stop_time)}</TableCell>
                  <TableCell sx={{ ...cellSx, textAlign: 'center' }}>{d.qty ?? '-'}</TableCell>
                  <TableCell sx={cellSx}>{d.remark || '-'}</TableCell>
                  {showQty && POUCH_FIELDS_END.map(f => (
                    <PouchCell key={f} value={d[f]} field={f} disabled={isDone} onClick={() => setEditDetail(d)} />
                  ))}
                  <TableCell sx={{ ...cellSx, whiteSpace: 'nowrap', minWidth: 160, py: 0.6 }}>
                    {!isDone && (
                      <Box sx={{ display: 'flex', gap: 0.6, alignItems: 'center' }}>
                        <Button size="small" variant="contained" color="error"
                          startIcon={<Stop sx={{ fontSize: 15 }} />}
                          onClick={e => { e.stopPropagation(); setStopScanId(d.detail_id); setTimeout(() => stopScanRef.current?.focus(), 200); }}
                          sx={{ fontSize: '11px', px: 1, py: 0.4, minWidth: 0, lineHeight: 1.4, backgroundColor: '#d32f2f', '&:hover': { backgroundColor: '#b71c1c' } }}>
                          {t('btn.stop')}
                        </Button>
                        <Button size="small" variant="contained" color="primary"
                          startIcon={<Edit sx={{ fontSize: 14 }} />}
                          onClick={e => { e.stopPropagation(); setEditDetail(d); }}
                          sx={{ fontSize: '11px', px: 1, py: 0.4, minWidth: 0, lineHeight: 1.4, backgroundColor: '#1565C0', '&:hover': { backgroundColor: '#0d47a1' } }}>
                          {t('btn.edit')}
                        </Button>
                        <Button size="small" variant="outlined" color="error"
                          startIcon={<Delete sx={{ fontSize: 14 }} />}
                          onClick={e => { e.stopPropagation(); handleDelete(d.detail_id); }}
                          sx={{ fontSize: '11px', px: 1, py: 0.4, minWidth: 0, lineHeight: 1.4, borderColor: '#c62828', color: '#c62828', '&:hover': { backgroundColor: '#ffebee', borderColor: '#b71c1c' } }}>
                          {t('btn.delete')}
                        </Button>
                      </Box>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
const TableMainPrep = () => {
  const [lang, setLang] = useState('th'); // ค่าเริ่มต้น: ภาษาไทย
  const t = useCallback((key, params) => {
    let str = TRANSLATIONS[lang][key] ?? key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => { str = str.replace(`{${k}}`, v); });
    }
    return str;
  }, [lang]);

  const [activeTab,      setActiveTab]      = useState(0);
  const [view,           setView]           = useState('list');
  const [selectedReport, setSelectedReport] = useState(null);
  const [activeReports,  setActiveReports]  = useState([]);
  const [doneRaw,        setDoneRaw]        = useState([]);
  const [doneRows,       setDoneRows]       = useState([]);
  const [lines,          setLines]          = useState([]);
  const [createOpen,     setCreateOpen]     = useState(false);
  const [editReport,     setEditReport]     = useState(null);
  const [pwdDialog,      setPwdDialog]      = useState({ open: false, onConfirm: null });

  const [activeFilters,            setActiveFilters]            = useState(EMPTY_FILTERS);
  const [doneFilters,              setDoneFilters]              = useState(EMPTY_FILTERS);
  const [doneAppliedFilters,       setDoneAppliedFilters]       = useState(EMPTY_FILTERS);
  const [doneFilterOptions,        setDoneFilterOptions]        = useState({});
  const [doneFilterOptionsLoading, setDoneFilterOptionsLoading] = useState(false);
  const [doneCount,                setDoneCount]                = useState(0);
  const [doneLoaded,               setDoneLoaded]               = useState(false);
  const [doneLoading,              setDoneLoading]              = useState(false);

  useEffect(() => { fetchLines(); fetchActive(); fetchDoneCount(); fetchDoneFilterOptions(); }, []);

  // ─── Auto-complete เอกสารที่ค้าง (ลืมกดปุ่ม Done) ──────────────────────────
  // เช็คเอกสารใน "กำลังดำเนินการ" ทุกใบ ถ้าเลยเวลาตัดกะของตัวเองแล้ว (DS=18:00 / NS=06:00 วันถัดไป)
  // จะยิง API เดิมที่ปุ่ม "บันทึก (Done)" ใช้ (PUT /reports/{id}/done) ให้อัตโนมัติ แล้วรีเฟรชหน้าจอ
  // หมายเหตุ: ทำงานเฉพาะตอนมีคนเปิดหน้านี้ค้างอยู่ หรือเข้ามาเปิดหลังเวลาตัดกะเท่านั้น
  // (เพราะเป็น logic ฝั่ง frontend) หากต้องการให้ตัดแม่นยำแม้ไม่มีใครเปิดแอปเลย ควรทำเป็น cron job ฝั่ง backend แทน
  const autoCompleteOverdueReports = useCallback(async () => {
    const overdue = (activeReports || []).filter(isReportOverdueForAutoDone);
    if (overdue.length === 0) return;
    try {
      await Promise.all(
        overdue.map(r => axios.put(`${API_URL}/api/pack/pkg/reports/${r.report_id}/done`))
      );
    } catch (err) {
      console.error('autoCompleteOverdueReports error:', err);
    } finally {
      fetchActive();
      fetchDoneCount();
      fetchDoneFilterOptions();
      if (doneLoaded) fetchDoneFiltered(doneAppliedFilters);
    }
  }, [activeReports, doneLoaded, doneAppliedFilters]);

  useEffect(() => {
    autoCompleteOverdueReports(); // เช็คทันทีตอนโหลดหน้า / เมื่อรายการ active เปลี่ยน
    const intervalId = setInterval(autoCompleteOverdueReports, 60 * 1000); // เช็คซ้ำทุก 1 นาที
    return () => clearInterval(intervalId);
  }, [autoCompleteOverdueReports]);

  const fetchLines = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/pack/pkg/lines`);
      const data = res.data.success ? res.data.data
                 : Array.isArray(res.data) ? res.data
                 : res.data.data ?? [];
      setLines(data);
    } catch (err) { console.error('fetchLines error:', err); }
  };

  const fetchActive = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/pack/pkg/reports`);
      if (res.data.success) setActiveReports(res.data.data);
    } catch (err) { console.error('fetchActive:', err); }
  };

  const fetchDoneCount = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/pack/pkg/reports/done/count`);
      if (res.data.success) { setDoneCount(res.data.data?.count ?? 0); return; }
      throw new Error(res.data.error);
    } catch {
      try {
        const res2 = await axios.get(`${API_URL}/api/pack/pkg/reports/done`);
        if (res2.data.success) setDoneCount(res2.data.data.length ?? 0);
      } catch (err2) { console.error('fetchDoneCount fallback:', err2); }
    }
  };

  const fetchDoneFilterOptions = async () => {
    setDoneFilterOptionsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/use/pkg/mnt/reports/done/filter-options`);
      if (res.data.success) { setDoneFilterOptions(res.data.data || {}); return; }
      throw new Error(res.data.error);
    } catch {
      try {
        const res2 = await axios.get(`${API_URL}/api/pack/pkg/reports/done`);
        if (res2.data.success) setDoneFilterOptions(buildFilterOptions(res2.data.data));
      } catch (err2) { console.error('fetchDoneFilterOptions fallback:', err2); }
    } finally { setDoneFilterOptionsLoading(false); }
  };

  const expandReportsToCodeRows = (reports, detailsMap) => {
    const rows = [];
    reports.forEach(r => {
      const details = detailsMap[r.report_id] || [];
      if (details.length === 0) {
        rows.push({ ...r, _code: '-' });
        return;
      }
      const uniqueCodes = [...new Set(details.map(d => d.code).filter(Boolean))];
      if (uniqueCodes.length === 0) {
        rows.push({ ...r, _code: '-' });
      } else {
        uniqueCodes.forEach(code => {
          rows.push({ ...r, _code: code });
        });
      }
    });
    return rows;
  };

  const fetchDoneFiltered = async (filters = doneAppliedFilters) => {
    setDoneLoading(true);
    try {
      const params = {};
      FILTER_FIELD_DEFS.forEach(({ field }) => { if (filters[field]) params[field] = filters[field]; });

      let reports = [];
      try {
        const res = await axios.get(`${API_URL}/use/pkg/mnt/reports/done/filtered`, { params });
        if (res.data.success) reports = res.data.data;
        else throw new Error(res.data.error);
      } catch {
        const res2 = await axios.get(`${API_URL}/api/pack/pkg/reports/done`);
        if (res2.data.success) reports = res2.data.data.filter(r => matchesFilters(r, filters));
        else throw new Error('fetch done failed');
      }

      const detailsMap = {};
      await Promise.all(
        reports.map(async (r) => {
          try {
            const dr = await axios.get(`${API_URL}/api/pack/pkg/reports/${r.report_id}`);
            detailsMap[r.report_id] = dr.data.success ? (dr.data.data.details || []) : [];
          } catch {
            detailsMap[r.report_id] = [];
          }
        })
      );

      const rows = expandReportsToCodeRows(reports, detailsMap);

      setDoneRaw(reports);
      setDoneRows(rows);
      setDoneLoaded(true);
    } catch (err) {
      console.error('fetchDoneFiltered failed:', err);
      alert(t('msg.loadDataFailed') + (err.response?.data?.error || err.message));
    } finally { setDoneLoading(false); }
  };

  const handleConfirmDoneFilters = () => {
    setDoneAppliedFilters(doneFilters);
    fetchDoneFiltered(doneFilters);
  };

  const activeFilterOptions = useMemo(() => buildFilterOptions(activeReports), [activeReports]);
  const filteredActiveReports = useMemo(() =>
    activeReports.filter(r => matchesFilters(r, activeFilters)), [activeReports, activeFilters]);

  const handleBack = (refreshDone) => {
    setSelectedReport(null); setView('list');
    fetchActive();
    if (refreshDone) {
      fetchDoneCount(); fetchDoneFilterOptions();
      if (doneLoaded) fetchDoneFiltered(doneAppliedFilters);
    }
  };

  const doDelete = async (report, isDoneReport) => {
    try {
      await axios.delete(`${API_URL}/api/pack/pkg/reports/${report.report_id}`);
      fetchActive(); fetchDoneCount(); fetchDoneFilterOptions();
      if (isDoneReport && doneLoaded) fetchDoneFiltered(doneAppliedFilters);
    } catch (err) { alert(t('msg.deleteFailed') + (err.response?.data?.error || err.message)); }
  };

  const handleDelete = (report, isDone) => {
    if (isDone) {
      setPwdDialog({ open: true, onConfirm: () => { setPwdDialog({ open: false, onConfirm: null }); doDelete(report, true); } });
    } else {
      if (window.confirm(t('msg.confirmDeleteDoc'))) doDelete(report, false);
    }
  };

  const handleReportEdited = () => {
    fetchActive();
    if (doneLoaded) fetchDoneFiltered(doneAppliedFilters);
  };

  let content;
  if (view === 'detail' && selectedReport) {
    content = (
      <DocumentDetailView report={selectedReport} onBack={handleBack} isDone={selectedReport.status === 'done'} />
    );
  } else {
    content = (
      <Box>
        <PasswordDialog open={pwdDialog.open}
          onClose={() => setPwdDialog({ open: false, onConfirm: null })}
          onConfirm={pwdDialog.onConfirm || (() => {})} />

        <ReportFormModal open={createOpen} onClose={() => setCreateOpen(false)}
          onSaved={() => { fetchActive(); setCreateOpen(false); }}
          lines={lines} editMode={false} />

        <ReportFormModal open={!!editReport} onClose={() => setEditReport(null)}
          onSaved={() => { handleReportEdited(); setEditReport(null); }}
          lines={lines} initialData={editReport} editMode={true} />

        {/* ─── Language switcher ─────────────────────────────────────────── */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
          <LangSwitcher />
        </Box>

        {/* ─── Tabs ───────────────────────────────────────────────────────── */}
        <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', borderBottom: '2px solid #e0e0e0', mb: 2 }}>
          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
            <Tab label={`${t('tab.active')} (${activeReports.length})`} sx={{ fontSize: '13px', textTransform: 'none' }} />
            <Tab label={`${t('tab.history')} (${doneCount})`}            sx={{ fontSize: '13px', textTransform: 'none' }} />
            <Tab label={t('tab.summary')}                                sx={{ fontSize: '13px', textTransform: 'none' }} />
          </Tabs>
          {activeTab === 0 && (
            <Button startIcon={<Add />} variant="contained" size="small"
              onClick={() => setCreateOpen(true)} sx={{ mb: 0.5 }}>
              {t('btn.createDoc')}
            </Button>
          )}
        </Box>

        {/* ─── Tab 0: กำลังดำเนินการ ──────────────────────────────────────── */}
        {activeTab === 0 && (
          <Box>
            <Box sx={{ mb: 1.2, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <FilterBar filters={activeFilters} options={activeFilterOptions}
                onChange={(field, v) => setActiveFilters(prev => ({ ...prev, [field]: v }))} />
              {Object.values(activeFilters).some(Boolean) && (
                <Button size="small" onClick={() => setActiveFilters(EMPTY_FILTERS)}
                  startIcon={<Clear sx={{ fontSize: 15 }} />}
                  sx={{ fontSize: '12px', textTransform: 'none', color: '#c62828' }}>
                  {t('btn.clearAllFilters')}
                </Button>
              )}
            </Box>
            <Paper sx={{ borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <ReportListTable
                reports={filteredActiveReports}
                onRowClick={r => { setSelectedReport(r); setView('detail'); }}
                onDelete={r => handleDelete(r, false)}
                onEdit={r => setEditReport(r)}
              />
            </Paper>
          </Box>
        )}

        {/* ─── Tab 1: ประวัติ ─────────────────────────────────────────────── */}
        {activeTab === 1 && (
          <Box>
            <Paper sx={{ p: 1.5, mb: 1.2, borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: '#fafafa' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
                <FilterBar filters={doneFilters} options={doneFilterOptions}
                  onChange={(field, v) => setDoneFilters(prev => ({ ...prev, [field]: v }))}
                  disabled={doneLoading || doneFilterOptionsLoading} />
                {Object.values(doneFilters).some(Boolean) && (
                  <Button size="small" onClick={() => setDoneFilters(EMPTY_FILTERS)} disabled={doneLoading}
                    startIcon={<Clear sx={{ fontSize: 15 }} />} sx={{ fontSize: '12px', textTransform: 'none', color: '#c62828' }}>
                    {t('btn.clearAllFilters')}
                  </Button>
                )}
                <Button size="small" variant="contained" onClick={handleConfirmDoneFilters}
                  disabled={doneLoading}
                  startIcon={doneLoading ? <CircularProgress size={12} color="inherit" /> : <CheckCircle />}>
                  {t('btn.confirmData')}
                </Button>
              </Box>
              <Box sx={{ fontSize: '11px', color: '#888', mt: 0.8 }}>
                {t('msg.rowShowsCodeHint')}
              </Box>
            </Paper>

            <Paper sx={{ borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <Box sx={{ p: 1.5, borderBottom: '1px solid #e0e0e0', backgroundColor: '#fff3e0', fontSize: '12px', color: '#e65100' }}>
                {t('password.deleteNotice')}
              </Box>
              {!doneLoaded ? (
                <Box sx={{ py: 5, textAlign: 'center', color: '#999', fontSize: '13px' }}>
                  {t('msg.chooseFilterHint')}
                </Box>
              ) : (
                <DoneHistoryTable
                  rows={doneRows}
                  onRowClick={r => { setSelectedReport(r); setView('detail'); }}
                  onDelete={r => handleDelete(r, true)}
                />
              )}
            </Paper>
          </Box>
        )}

        {/* ─── Tab 2: สรุป Plant/Line ─────────────────────────────────────── */}
        {activeTab === 2 && (
          <PlantLineSummaryTab
            lines={lines}
            activeReports={activeReports}
          />
        )}
      </Box>
    );
  }

  return (
    <LanguageContext.Provider value={{ lang, t, setLang }}>
      {content}
    </LanguageContext.Provider>
  );
};

export default TableMainPrep;