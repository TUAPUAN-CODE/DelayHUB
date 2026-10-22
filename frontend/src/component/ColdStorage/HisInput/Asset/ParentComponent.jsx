import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  TextField,
  InputAdornment,
  Paper,
  Typography,
  CircularProgress,
  Button,
  MenuItem,
  Alert,
} from '@mui/material';
import SearchIcon from "@mui/icons-material/Search";
import TodayIcon from '@mui/icons-material/Today';
import ColdStorageTable from "./Table";

const API_URL = import.meta.env.VITE_API_URL;

// a whole day / date range is read at once and shown in one table that scrolls (no pages)
const MAX_ROWS = 10000;
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const thaiDate = (v) => (v ? new Date(`${v}T00:00:00`).toLocaleDateString('th-TH') : '...');
const FILTER_TYPES = [
  { value: 'any', label: 'เข้าหรือออกห้องเย็น' },
  { value: 'enter', label: 'เข้าห้องเย็น (ครั้งล่าสุด)' },
  { value: 'exit', label: 'ออกห้องเย็น (ครั้งล่าสุด)' },
];

const ParentComponent = () => {
  const [data, setData] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ค้นหา: คำค้นส่งไปค้นใน DB (หน่วง 400ms หลังหยุดพิมพ์) — ค้นทั้งฐานข้อมูล ไม่สนช่วงวันที่
  const [searchTerm, setSearchTerm] = useState("");
  const [dbTerm, setDbTerm] = useState("");

  // ช่วงวันที่: เปิดหน้ามาเป็นวันนี้ (วันเดียว = เลือกวันเริ่มกับวันสิ้นสุดเป็นวันเดียวกัน)
  const [startDate, setStartDate] = useState(() => ymd(new Date()));
  const [endDate, setEndDate] = useState(() => ymd(new Date()));
  const [filterType, setFilterType] = useState('any');

  useEffect(() => {
    const t = setTimeout(() => { setDbTerm(searchTerm.trim()); }, 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const badRange = !startDate || !endDate || endDate < startDate;

  useEffect(() => {
    if (!dbTerm && badRange) return;
    let alive = true;
    const fetchColdStorageData = async () => {
      try {
        setLoading(true);
        setError(null);
        const params = { page: 1, pageSize: MAX_ROWS };
        if (dbTerm) params.searchTerm = dbTerm;
        else { params.startDate = startDate; params.endDate = endDate; params.filterType = filterType; }

        const response = await axios.get(`${API_URL}/api/coldstorage/history`, { params });
        if (!alive) return;
        if (response.data && Array.isArray(response.data.data)) {
          setData(response.data.data);
          setTotalRows(response.data.total ?? response.data.data.length);
        } else {
          console.error("[ColdStorage History] รูปแบบข้อมูลไม่ถูกต้อง:", response.data);
          setError("รูปแบบข้อมูลไม่ถูกต้อง");
        }
      } catch (err) {
        console.error("[ColdStorage History] fetch error:", err);
        if (alive) setError(`ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้: ${err.response?.data?.message || err.message}`);
      } finally {
        if (alive) setLoading(false);
      }
    };
    fetchColdStorageData();
    return () => { alive = false; };
  }, [dbTerm, startDate, endDate, filterType, badRange]);

  const setToday = () => { const t = ymd(new Date()); setStartDate(t); setEndDate(t); };
  const rangeLabel = startDate === endDate ? `วันที่ ${thaiDate(startDate)}` : `${thaiDate(startDate)} - ${thaiDate(endDate)}`;

  return (
    <Paper sx={{
      width: '100%',
      height: 'calc(100vh - 5rem)',
      overflow: 'hidden',
      boxShadow: '0px 0px 3px rgba(0, 0, 0, 0.2)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, px: 2, py: 1 }}>
        <TextField
          size="small" type="date" label="ตั้งแต่วันที่" value={startDate}
          onChange={(e) => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 165 }}
          disabled={!!dbTerm}
        />
        <TextField
          size="small" type="date" label="ถึงวันที่" value={endDate}
          onChange={(e) => setEndDate(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 165 }}
          disabled={!!dbTerm}
        />
        <TextField size="small" select label="นับจาก" value={filterType} onChange={(e) => setFilterType(e.target.value)} sx={{ width: 210 }} disabled={!!dbTerm}>
          {FILTER_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
        </TextField>
        <Button size="small" variant="outlined" startIcon={<TodayIcon />} onClick={setToday} disabled={!!dbTerm}>วันนี้</Button>
        <TextField
          size="small"
          placeholder="พิมพ์เพื่อค้นหาจากฐานข้อมูล (วัตถุดิบ / Batch / รถเข็น / รายการ / แผนผลิต / HU / ช่อง)..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>) }}
          sx={{ flex: 1, minWidth: 260 }}
        />
      </Box>

      <Box sx={{ px: 2, pb: 1 }}>
        {badRange && !dbTerm ? (
          <Alert severity="warning" sx={{ py: 0 }}>วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มต้น</Alert>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {dbTerm
              ? `ผลค้นหา "${dbTerm}" (ทุกวันที่) ${loading ? '' : `${data.length.toLocaleString()} รายการ`}`
              : `${rangeLabel} · ${FILTER_TYPES.find((t) => t.value === filterType)?.label} ${loading ? '' : `· ${data.length.toLocaleString()} รายการ`}`}
            {!loading && totalRows > data.length && ` (แสดง ${data.length.toLocaleString()} จาก ${totalRows.toLocaleString()} — ลดช่วงวันที่ให้แคบลง)`}
          </Typography>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mx: 2, mb: 1 }}>{error}</Alert>}

      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", px: 1, pb: 1 }}>
        {loading ? (
          <Box sx={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <CircularProgress />
          </Box>
        ) : (
          <ColdStorageTable filteredData={data} hidePagination height="calc(100vh - 21rem)" />
        )}
      </Box>
    </Paper>
  );
};

export default ParentComponent;
