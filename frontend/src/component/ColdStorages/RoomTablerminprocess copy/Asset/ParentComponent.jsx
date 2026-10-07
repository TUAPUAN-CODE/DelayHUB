import React, { useState, useEffect, useMemo } from 'react';
import TableMainPrep from './TableOvenToCold';
import axios from "axios";
axios.defaults.withCredentials = true;
import ModalEditPD from './ModalEditPD';
import ModalDelete from './ModalDelete';
const API_URL = import.meta.env.VITE_API_URL;

const DEST_RECEIVED = 'ในห้องเย็นใหญ่';
const DEST_PENDING  = 'เข้าห้องเย็นใหญ่';

const DATE_FIELD_GROUPS = [
  {
    groupLabel: 'เวลาเข้าออกห้องเย็นใหญ่รอบที่',
    options: [
      { value: 'cs_come_cold_date',        label: 'รอบที่ 1 - เข้าห้องเย็นใหญ่' },
      { value: 'cs_out_cold_date',          label: 'รอบที่ 1 - ออกห้องเย็นใหญ่' },
      { value: 'cs_come_cold_date_two',     label: 'รอบที่ 2 - เข้าห้องเย็นใหญ่' },
      { value: 'cs_out_cold_date_two',      label: 'รอบที่ 2 - ออกห้องเย็นใหญ่' },
      { value: 'cs_come_cold_date_three',   label: 'รอบที่ 3 - เข้าห้องเย็นใหญ่' },
      { value: 'cs_out_cold_date_three',    label: 'รอบที่ 3 - ออกห้องเย็นใหญ่' },
      { value: 'cs_come_cold_date_four',    label: 'รอบที่ 4 - เข้าห้องเย็นใหญ่' },
      { value: 'cs_out_cold_date_four',     label: 'รอบที่ 4 - ออกห้องเย็นใหญ่' },
    ],
  },
  {
    groupLabel: 'เวลาเข้าออกห้องเย็นรอบที่',
    options: [
      { value: 'come_cold_date',           label: 'รอบที่ 1 - เข้าห้องเย็น' },
      { value: 'out_cold_date',             label: 'รอบที่ 1 - ออกห้องเย็น' },
      { value: 'come_cold_date_two',       label: 'รอบที่ 2 - เข้าห้องเย็น' },
      { value: 'out_cold_date_two',         label: 'รอบที่ 2 - ออกห้องเย็น' },
      { value: 'come_cold_date_three',     label: 'รอบที่ 3 - เข้าห้องเย็น' },
      { value: 'out_cold_date_three',       label: 'รอบที่ 3 - ออกห้องเย็น' },
    ],
  },
];

const getFieldLabel = (fieldKey) => {
  for (const group of DATE_FIELD_GROUPS) {
    const found = group.options.find((o) => o.value === fieldKey);
    if (found) return `${group.groupLabel} (${found.label})`;
  }
  return fieldKey;
};

const CS_COME_COLD_FIELDS = [
  'cs_come_cold_date',
  'cs_come_cold_date_two',
  'cs_come_cold_date_three',
  'cs_come_cold_date_four',
];

const getLatestCsComeColdDateObj = (row) => {
  const dates = CS_COME_COLD_FIELDS.map((f) => row[f]).filter(Boolean).map((d) => new Date(d));
  if (dates.length === 0) return null;
  const latest = new Date(Math.max(...dates));
  return isNaN(latest.getTime()) ? null : latest;
};

const selectStyle = {
  padding: '6px 8px',
  borderRadius: '4px',
  border: '1px solid #ccc',
  color: '#000',
  backgroundColor: '#fff',
};

// ─── helper: แปลง { date, hour } → Date object ───────────────────────────────
// hour คือ 1–24  โดย 24 หมายถึง 00:00 ของวันถัดไป
const buildDateFromParts = (dateStr, hourStr) => {
  if (!dateStr || hourStr === '') return null;
  const hour = parseInt(hourStr, 10);
  if (isNaN(hour)) return null;

  // hour 1–23 → ชั่วโมงปกติ, hour 24 → 00:00 วันถัดไป
  const base = new Date(`${dateStr}T00:00:00`);
  if (isNaN(base.getTime())) return null;

  if (hour === 24) {
    base.setDate(base.getDate() + 1); // เลื่อนไปวันถัดไป
    base.setHours(0, 0, 0, 0);
  } else {
    base.setHours(hour, 0, 0, 0);
  }
  return base;
};

// ─── HourDatePicker: date input + select 1–24 ────────────────────────────────
const HourDatePicker = ({ label, dateValue, hourValue, onDateChange, onHourChange }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
    <label style={{ fontSize: '13px', color: '#555', marginBottom: '2px' }}>{label}</label>
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      {/* วันที่ */}
      <input
        type="date"
        value={dateValue}
        onChange={(e) => onDateChange(e.target.value)}
        style={{ ...selectStyle, padding: '6px 8px' }}
      />
      {/* ชั่วโมง 1–24 */}
      <select
        value={hourValue}
        onChange={(e) => onHourChange(e.target.value)}
        style={{ ...selectStyle, minWidth: '90px' }}
      >
        <option value="">-- ชม. --</option>
        {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
          <option key={h} value={h}>
            {h === 24 ? '24 (เที่ยงคืน)' : `${String(h).padStart(2, '0')}:00`}
          </option>
        ))}
      </select>
    </div>
  </div>
);

const ParentComponent = () => {
  const [openEditModal, setOpenEditModal] = useState(false);
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [dataForEditModal, setDataForEditModal] = useState(null);
  const [dataForDeleteModal, setDataForDeleteModal] = useState(null);
  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. filter สถานะ dest
  const [statusFilter, setStatusFilter] = useState('all');

  // 2. filter diff ระหว่าง 2 ฟิลด์วันที่ vs threshold
  const [field1, setField1] = useState('');
  const [field2, setField2] = useState('');
  const [thresholdHours, setThresholdHours] = useState('');
  const [diffFilter, setDiffFilter] = useState(null);
  const [sortError, setSortError] = useState('');

  // 3. filter ช่วงวันเวลา "เข้าห้องเย็นใหญ่ล่าสุด" — แยก date + hour (1–24)
  const [startDate, setStartDate]   = useState('');
  const [startHour, setStartHour]   = useState('');
  const [endDate,   setEndDate]     = useState('');
  const [endHour,   setEndHour]     = useState('');
  const [dateRangeFilter, setDateRangeFilter] = useState(null);
  const [rangeError, setRangeError] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/coldstorages/incold/fetchSlotRawMatsend`);
      const raw = Array.isArray(response.data) ? response.data : (response.data?.data ?? []);
      setTableData(raw);
    } catch (error) {
      console.error("Error fetching data:", error);
      setTableData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleOpenModal        = (data) => {};
  const handleRowClick         = (rowId) => {};
  const handleOpenEditModal    = (data) => { setDataForEditModal(data); setOpenEditModal(true); };
  const handleCloseEditModal   = () => { setOpenEditModal(false); setDataForEditModal(null); };
  const handleOpenDeleteModal  = (data) => { setDataForDeleteModal(data); setOpenDeleteModal(true); };
  const handleCloseDeleteModal = () => { setOpenDeleteModal(false); setDataForDeleteModal(null); };

  // ─── handler ที่ 2: diff filter ───────────────────────────────────────────
  const handleSortByTime = () => {
    setSortError('');
    if (!field1 || !field2 || thresholdHours === '') {
      setSortError('กรุณาเลือกฟิลด์เวลาทั้งสองและกรอกเวลาที่ต้องการเทียบให้ครบ');
      setDiffFilter(null);
      return;
    }
    const threshold = parseFloat(thresholdHours);
    if (isNaN(threshold)) { setSortError('เวลาที่กำหนดต้องเป็นตัวเลข'); setDiffFilter(null); return; }
    if (field1 === field2) { setSortError('กรุณาเลือกฟิลด์เวลาทั้งสองให้ต่างกัน'); setDiffFilter(null); return; }

    const matchCount = tableData.filter((row) => {
      const d1 = row[field1] ? new Date(row[field1]) : null;
      const d2 = row[field2] ? new Date(row[field2]) : null;
      if (!d1 || !d2 || isNaN(d1.getTime()) || isNaN(d2.getTime())) return false;
      return Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60) > threshold;
    }).length;

    if (matchCount === 0) {
      setSortError(`ไม่พบแถวที่ diff ระหว่าง "${getFieldLabel(field1)}" กับ "${getFieldLabel(field2)}" เกิน ${threshold} นาที`);
      setDiffFilter(null);
      return;
    }
    setDiffFilter({ field1, field2, threshold });
  };

  const handleResetTimeFilter = () => { setField1(''); setField2(''); setThresholdHours(''); setDiffFilter(null); setSortError(''); };

  // ─── handler ที่ 3: date-range filter (ใช้ buildDateFromParts) ────────────
  const handleSortByDateRange = () => {
    setRangeError('');
    const start = buildDateFromParts(startDate, startHour);
    const end   = buildDateFromParts(endDate,   endHour);

    if (!start || !end) {
      setRangeError('กรุณาเลือกวันที่และชั่วโมงให้ครบทั้งช่วงเริ่มต้นและสิ้นสุด');
      setDateRangeFilter(null);
      return;
    }
    if (start > end) {
      setRangeError('วันเวลาเริ่มต้นต้องมาก่อนวันเวลาสิ้นสุด');
      setDateRangeFilter(null);
      return;
    }

    const matchCount = tableData.filter((row) => {
      const latest = getLatestCsComeColdDateObj(row);
      if (!latest) return false;
      return latest >= start && latest <= end;
    }).length;

    if (matchCount === 0) {
      setRangeError('ไม่พบแถวที่วันเวลาเข้าห้องเย็นใหญ่ล่าสุดอยู่ในช่วงที่กำหนด');
      setDateRangeFilter(null);
      return;
    }
    setDateRangeFilter({ start, end });
  };

  const handleResetDateRangeFilter = () => {
    setStartDate(''); setStartHour('');
    setEndDate('');   setEndHour('');
    setDateRangeFilter(null);
    setRangeError('');
  };

  // ─── รวม filter ───────────────────────────────────────────────────────────
  const filteredData = useMemo(() => {
    let data = tableData;

    if (statusFilter === 'received') data = data.filter((r) => r.dest === DEST_RECEIVED);
    else if (statusFilter === 'pending') data = data.filter((r) => r.dest === DEST_PENDING);

    if (diffFilter) {
      const { field1: f1, field2: f2, threshold } = diffFilter;
      data = data.filter((row) => {
        const d1 = row[f1] ? new Date(row[f1]) : null;
        const d2 = row[f2] ? new Date(row[f2]) : null;
        if (!d1 || !d2 || isNaN(d1.getTime()) || isNaN(d2.getTime())) return false;
        return Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60) > threshold;
      });
    }

    if (dateRangeFilter) {
      const { start, end } = dateRangeFilter;
      data = data.filter((row) => {
        const latest = getLatestCsComeColdDateObj(row);
        if (!latest) return false;
        return latest >= start && latest <= end;
      });
      data = [...data].sort((a, b) => {
        const da = getLatestCsComeColdDateObj(a) || new Date(0);
        const db = getLatestCsComeColdDateObj(b) || new Date(0);
        return da - db;
      });
    }

    return data;
  }, [tableData, statusFilter, diffFilter, dateRangeFilter]);

  // ─── helper แสดงข้อความสรุป range ────────────────────────────────────────
  const fmtRangeDate = (d) =>
    d.toLocaleString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div>
      {/* ── Block 1: สถานะ + diff filter ── */}
      <div
        style={{
          display: 'flex', flexWrap: 'wrap', gap: '12px',
          alignItems: 'flex-end', marginBottom: '16px',
          padding: '12px', border: '1px solid #E3E8F2', borderRadius: '8px',
        }}
      >
        {/* สถานะ */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontSize: '13px', color: '#555', marginBottom: '4px' }}>สถานะการรับเข้า</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
            <option value="all">ทั้งหมด</option>
            <option value="received">รายการวัตถุดิบในห้องเย็น</option>
            <option value="pending">รายการวัตถุดิบยังไม่ Check in</option>
          </select>
        </div>

        {/* field1 */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontSize: '13px', color: '#555', marginBottom: '4px' }}>เวลาที่ 1 (input1)</label>
          <select value={field1} onChange={(e) => setField1(e.target.value)} style={{ ...selectStyle, minWidth: '220px' }}>
            <option value="">-- เลือกฟิลด์เวลา --</option>
            {DATE_FIELD_GROUPS.map((group) => (
              <optgroup key={group.groupLabel} label={group.groupLabel}>
                {group.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* field2 */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontSize: '13px', color: '#555', marginBottom: '4px' }}>เวลาที่ 2 (input2)</label>
          <select value={field2} onChange={(e) => setField2(e.target.value)} style={{ ...selectStyle, minWidth: '220px' }}>
            <option value="">-- เลือกฟิลด์เวลา --</option>
            {DATE_FIELD_GROUPS.map((group) => (
              <optgroup key={group.groupLabel} label={group.groupLabel}>
                {group.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* threshold */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontSize: '13px', color: '#555', marginBottom: '4px' }}>เวลาที่กำหนด (นาที)</label>
          <input
            type="number" min="0" step="1"
            value={thresholdHours}
            onChange={(e) => setThresholdHours(e.target.value)}
            placeholder="เช่น 60"
            style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #ccc', width: '100px', color: '#000' }}
          />
        </div>

        <button onClick={handleSortByTime} style={{ padding: '7px 16px', borderRadius: '4px', border: 'none', backgroundColor: '#2563eb', color: '#fff', cursor: 'pointer' }}>
          sort
        </button>
        <button onClick={handleResetTimeFilter} style={{ padding: '7px 16px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#fff', color: '#333', cursor: 'pointer' }}>
          ล้างตัวกรองเวลา
        </button>
      </div>

      {sortError && <div style={{ color: '#b91c1c', fontSize: '13px', marginBottom: '12px' }}>{sortError}</div>}
      {diffFilter && (
        <div style={{ color: '#15803d', fontSize: '13px', marginBottom: '12px' }}>
          กำลังแสดงแถวที่ diff ระหว่าง "{getFieldLabel(diffFilter.field1)}" กับ "{getFieldLabel(diffFilter.field2)}" เกิน {diffFilter.threshold} นาที
        </div>
      )}

      {/* ── Block 2: ช่วงวันเวลา "เข้าห้องเย็นใหญ่ล่าสุด" (ใช้ 1–24) ── */}
      <div
        style={{
          display: 'flex', flexWrap: 'wrap', gap: '16px',
          alignItems: 'flex-end', marginBottom: '16px',
          padding: '12px', border: '1px solid #E3E8F2', borderRadius: '8px',
        }}
      >
        <HourDatePicker
          label="⏱️ ช่วงวันเวลาเข้าห้องเย็นใหญ่ล่าสุด — เริ่มต้น"
          dateValue={startDate}
          hourValue={startHour}
          onDateChange={setStartDate}
          onHourChange={setStartHour}
        />

        <HourDatePicker
          label="สิ้นสุด"
          dateValue={endDate}
          hourValue={endHour}
          onDateChange={setEndDate}
          onHourChange={setEndHour}
        />

        <button onClick={handleSortByDateRange} style={{ padding: '7px 16px', borderRadius: '4px', border: 'none', backgroundColor: '#15803d', color: '#fff', cursor: 'pointer' }}>
          sort
        </button>
        <button onClick={handleResetDateRangeFilter} style={{ padding: '7px 16px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#fff', color: '#333', cursor: 'pointer' }}>
          ล้างตัวกรองช่วงวันที่
        </button>
      </div>

      {rangeError && <div style={{ color: '#b91c1c', fontSize: '13px', marginBottom: '12px' }}>{rangeError}</div>}
      {dateRangeFilter && (
        <div style={{ color: '#15803d', fontSize: '13px', marginBottom: '12px' }}>
          กำลังแสดงแถวที่วันเวลาเข้าห้องเย็นใหญ่ล่าสุด อยู่ระหว่าง{' '}
          {fmtRangeDate(dateRangeFilter.start)} ถึง {fmtRangeDate(dateRangeFilter.end)}
        </div>
      )}

      {/* ── Table ── */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 150px)' }}>
          <p style={{ color: '#6B7489', fontSize: '16px' }}>กำลังโหลดข้อมูล...</p>
        </div>
      ) : (
        <TableMainPrep
          handleOpenModal={handleOpenModal}
          handleOpenEditModal={handleOpenEditModal}
          handleOpenDeleteModal={handleOpenDeleteModal}
          data={filteredData}
          handleRowClick={handleRowClick}
        />
      )}

      {dataForEditModal && (
        <ModalEditPD
          open={openEditModal}
          onClose={handleCloseEditModal}
          data={dataForEditModal}
          onSuccess={() => { handleCloseEditModal(); fetchData(); }}
        />
      )}

      <ModalDelete
        open={openDeleteModal}
        onClose={handleCloseDeleteModal}
        data={dataForDeleteModal}
        onSuccess={() => { handleCloseDeleteModal(); fetchData(); }}
      />
    </div>
  );
};

export default ParentComponent;