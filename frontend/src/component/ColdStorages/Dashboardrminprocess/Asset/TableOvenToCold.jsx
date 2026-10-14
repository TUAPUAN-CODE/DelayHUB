import React, { useMemo } from 'react';
import { Box, Typography, Paper, Grid, Divider, Chip } from '@mui/material';

const API_URL = import.meta.env.VITE_API_URL;

// ─── Time helpers ─────────────────────────────────────────────────────────────
const getLatestComeColdDate = (row) => {
  const dates = [row.come_cold_date, row.come_cold_date_two, row.come_cold_date_three].filter(Boolean);
  if (dates.length === 0) return row.rmit_date || null;
  return new Date(Math.max(...dates.map(d => new Date(d)))).toISOString().replace('T', ' ');
};
const calcMin = (dt) => (new Date() - new Date(dt)) / (1000 * 60);
const formatTime = (minutes) => {
  if (isNaN(minutes) || minutes == null) return '-';
  const abs = Math.abs(minutes);
  const days = Math.floor(abs / 1440), hours = Math.floor((abs % 1440) / 60), mins = Math.floor(abs % 60);
  let s = '';
  if (days > 0) s += `${days} วัน`;
  if (hours > 0) s += `${s ? ' ' : ''}${hours} ชม.`;
  if (mins > 0 || (!days && !hours)) s += `${s ? ' ' : ''}${mins} นาที`;
  return s.trim();
};
const isOverdue = (row) => {
  const latest = getLatestComeColdDate(row);
  if (!latest) return false;
  const passed = calcMin(latest);
  if (row.mix_time != null) {
    const v = parseFloat(row.mix_time);
    return passed > Math.floor(v) * 60 + (v % 1) * 100;
  }
  if (row.remaining_rework_time != null) {
    const rrt = parseFloat(row.remaining_rework_time);
    return rrt <= 0;
  }
  const cold = parseFloat(row.cold);
  if (isNaN(cold) || cold <= 0) return false;
  return passed > Math.floor(cold) * 60 + (cold % 1) * 100;
};

// ─── Sub components ───────────────────────────────────────────────────────────
const StatCard = ({ icon, label, value, sub, color, bg }) => (
  <Paper elevation={2} sx={{ p: 2, borderRadius: '12px', bgcolor: bg || '#fff', border: `1.5px solid ${color}20`, height: '100%' }}>
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
      <Box sx={{ fontSize: '28px', lineHeight: 1 }}>{icon}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: '11px', color: '#888', fontWeight: 600, mb: 0.25 }}>{label}</Typography>
        <Typography sx={{ fontSize: '26px', fontWeight: 800, color, lineHeight: 1 }}>{value}</Typography>
        {sub && <Typography sx={{ fontSize: '11px', color: '#999', mt: 0.5 }}>{sub}</Typography>}
      </Box>
    </Box>
  </Paper>
);

const SectionTitle = ({ children }) => (
  <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#444', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
    {children}
  </Typography>
);

const BreakdownRow = ({ label, count, weight, color, pct }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75, borderBottom: '1px solid #f0f0f0' }}>
    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
    <Typography sx={{ flex: 1, fontSize: '12px', color: '#444', fontWeight: 500 }}>{label || '-'}</Typography>
    <Typography sx={{ fontSize: '12px', color: '#777', minWidth: '40px', textAlign: 'right' }}>{count} รายการ</Typography>
    {weight != null && (
      <Typography sx={{ fontSize: '12px', color: '#999', minWidth: '65px', textAlign: 'right' }}>{weight.toLocaleString()} kg</Typography>
    )}
    {pct != null && (
      <Box sx={{ minWidth: '48px' }}>
        <Box sx={{ height: 6, bgcolor: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
          <Box sx={{ height: '100%', width: `${Math.min(pct, 100)}%`, bgcolor: color, borderRadius: 3 }} />
        </Box>
      </Box>
    )}
  </Box>
);

// ─── Main Dashboard ───────────────────────────────────────────────────────────
const TableMainPrep = ({ data }) => {
  const rows = useMemo(() => Array.isArray(data) ? data : [], [data]);

  const stats = useMemo(() => {
    const total = rows.length;
    const totalWeight = rows.reduce((s, r) => s + (parseFloat(r.weight_RM) || 0), 0);
    const overdueCount = rows.filter(isOverdue).length;

    // เริ่มละลาย (defrost) แต่ไม่มีเวลาละลายเสร็จ (in any round)
    const defrostInProgress = rows.filter(r =>
      (r.start_defrost_date && !r.end_defrost_date) ||
      (r.start_defrost_date_two && !r.end_defrost_date_two) ||
      (r.start_defrost_date_three && !r.end_defrost_date_three) ||
      (r.start_defrost_date_four && !r.end_defrost_date_four)
    );

    // อยู่ใน PF (come_cold ล่าสุดยังไม่ออก)
    const inPF = rows.filter(r => {
      if (r.come_cold_date_three && !r.out_cold_date_three) return true;
      if (r.come_cold_date_two && !r.out_cold_date_two) return true;
      if (r.come_cold_date && !r.out_cold_date) return true;
      return false;
    });

    // อยู่ในห้องเย็นใหญ่ (cs_come ล่าสุดยังไม่ออก)
    const inCS = rows.filter(r => {
      if (r.cs_come_cold_date_four && !r.cs_out_cold_date_four) return true;
      if (r.cs_come_cold_date_three && !r.cs_out_cold_date_three) return true;
      if (r.cs_come_cold_date_two && !r.cs_out_cold_date_two) return true;
      if (r.cs_come_cold_date && !r.cs_out_cold_date) return true;
      return false;
    });

    // แยกตามห้องเย็น
    const byRoom = {};
    rows.forEach(r => {
      const k = r.cs_name || 'ไม่ระบุ';
      if (!byRoom[k]) byRoom[k] = { count: 0, weight: 0 };
      byRoom[k].count++;
      byRoom[k].weight += parseFloat(r.weight_RM) || 0;
    });

    // แยกตามสถานะ
    const byStatus = {};
    rows.forEach(r => {
      const k = r.rm_status || 'ไม่ระบุ';
      if (!byStatus[k]) byStatus[k] = { count: 0, weight: 0 };
      byStatus[k].count++;
      byStatus[k].weight += parseFloat(r.weight_RM) || 0;
    });

    // แยกตาม mat_name (top 5)
    const byMat = {};
    rows.forEach(r => {
      const k = r.mat_name || r.mat || 'ไม่ระบุ';
      if (!byMat[k]) byMat[k] = { count: 0, weight: 0, mat: r.mat };
      byMat[k].count++;
      byMat[k].weight += parseFloat(r.weight_RM) || 0;
    });
    const topMat = Object.entries(byMat)
      .sort((a, b) => b[1].weight - a[1].weight)
      .slice(0, 6);

    return {
      total, totalWeight, overdueCount,
      defrostInProgress, defrostCount: defrostInProgress.length,
      inPF, inPFCount: inPF.length,
      inCS, inCSCount: inCS.length,
      byRoom: Object.entries(byRoom).sort((a, b) => b[1].count - a[1].count),
      byStatus: Object.entries(byStatus).sort((a, b) => b[1].count - a[1].count),
      topMat,
    };
  }, [rows]);

  const STATUS_COLORS = {
    'QcCheck': '#4caf50',
    'รอแก้ไข': '#f44336',
    'รอกลับมาเตรียม': '#00bcd4',
    'QcCheck รอ MD': '#00bcd4',
    'เหลือจากไลน์ผลิต': '#ff9800',
  };
  const ROOM_COLORS = ['#0F3FC4', '#0277BD', '#1552F0', '#1E88E5', '#42A5F5', '#90CAF9'];

  return (
    <Box sx={{ p: 2, bgcolor: '#f4f6fa', minHeight: '100%' }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography sx={{ fontSize: '15px', fontWeight: 700, color: '#0F3FC4' }}>
          📊 Dashboard วิเคราะห์ข้อมูล — ห้องเย็นใหญ่ (In Process)
        </Typography>
        <Chip label={`${stats.total} รายการ`} color="primary" size="small" sx={{ fontWeight: 700 }} />
      </Box>

      {/* ── Row 1: Summary Cards ── */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid item xs={6} sm={3}>
          <StatCard icon="📦" label="จำนวนรายการทั้งหมด" value={stats.total} sub="รายการในระบบ" color="#0F3FC4" bg="#EAF0FF" />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard icon="⚖️" label="น้ำหนักรวม" value={`${stats.totalWeight.toLocaleString()}`} sub="กิโลกรัม" color="#2E7D32" bg="#E8F5E9" />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard icon="⚠️" label="เกินกำหนดเวลา" value={stats.overdueCount} sub={`คิดเป็น ${stats.total ? Math.round(stats.overdueCount / stats.total * 100) : 0}%`} color="#C62828" bg="#FFEBEE" />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard icon="🌊" label="กำลังละลาย (ไม่มีเวลาเสร็จ)" value={stats.defrostCount} sub="เริ่มละลายแต่ยังไม่เสร็จ" color="#006064" bg="#E0F7FA" />
        </Grid>
      </Grid>

      {/* ── Row 2: Stage Cards ── */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid item xs={6} sm={4}>
          <StatCard icon="🧊" label="อยู่ใน PF (ยังไม่ออก)" value={stats.inPFCount} sub="come_cold ล่าสุดยังไม่มี out_cold" color="#0277BD" bg="#EAF0FF" />
        </Grid>
        <Grid item xs={6} sm={4}>
          <StatCard icon="🏭" label="อยู่ห้องเย็นใหญ่ (ยังไม่ออก)" value={stats.inCSCount} sub="cs_come ล่าสุดยังไม่มี cs_out" color="#0F3FC4" bg="#E8EAF6" />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard icon="✅" label="ออกจากห้องเย็นใหญ่แล้ว" value={stats.total - stats.inCSCount} sub="cs_out มีค่าแล้ว" color="#388E3C" bg="#F1F8E9" />
        </Grid>
      </Grid>

      {/* ── Row 3: Breakdowns ── */}
      <Grid container spacing={2}>

        {/* แยกตามห้องเย็น */}
        <Grid item xs={12} md={4}>
          <Paper elevation={1} sx={{ p: 2, borderRadius: '12px', height: '100%' }}>
            <SectionTitle>🏠 แยกตามห้องเย็น</SectionTitle>
            <Divider sx={{ mb: 1.5 }} />
            {stats.byRoom.length === 0
              ? <Typography sx={{ fontSize: '12px', color: '#aaa' }}>ไม่มีข้อมูล</Typography>
              : stats.byRoom.map(([name, d], i) => (
                  <BreakdownRow
                    key={name} label={name}
                    count={d.count} weight={Math.round(d.weight)}
                    color={ROOM_COLORS[i % ROOM_COLORS.length]}
                    pct={stats.total ? (d.count / stats.total) * 100 : 0}
                  />
                ))}
          </Paper>
        </Grid>

        {/* แยกตามสถานะ */}
        <Grid item xs={12} md={4}>
          <Paper elevation={1} sx={{ p: 2, borderRadius: '12px', height: '100%' }}>
            <SectionTitle>🔖 แยกตามสถานะ</SectionTitle>
            <Divider sx={{ mb: 1.5 }} />
            {stats.byStatus.length === 0
              ? <Typography sx={{ fontSize: '12px', color: '#aaa' }}>ไม่มีข้อมูล</Typography>
              : stats.byStatus.map(([status, d]) => (
                  <BreakdownRow
                    key={status} label={status}
                    count={d.count} weight={Math.round(d.weight)}
                    color={STATUS_COLORS[status] || '#78909C'}
                    pct={stats.total ? (d.count / stats.total) * 100 : 0}
                  />
                ))}
          </Paper>
        </Grid>

        {/* Top วัตถุดิบ */}
        <Grid item xs={12} md={4}>
          <Paper elevation={1} sx={{ p: 2, borderRadius: '12px', height: '100%' }}>
            <SectionTitle>🥩 วัตถุดิบ (เรียงตามน้ำหนัก)</SectionTitle>
            <Divider sx={{ mb: 1.5 }} />
            {stats.topMat.length === 0
              ? <Typography sx={{ fontSize: '12px', color: '#aaa' }}>ไม่มีข้อมูล</Typography>
              : stats.topMat.map(([name, d], i) => (
                  <BreakdownRow
                    key={name} label={name}
                    count={d.count} weight={Math.round(d.weight)}
                    color={['#0F3FC4','#2E7D32','#6A1B9A','#E65100','#C62828','#00695C'][i % 6]}
                    pct={stats.totalWeight ? (d.weight / stats.totalWeight) * 100 : 0}
                  />
                ))}
          </Paper>
        </Grid>

        {/* รายการกำลังละลาย */}
        {stats.defrostCount > 0 && (
          <Grid item xs={12}>
            <Paper elevation={1} sx={{ p: 2, borderRadius: '12px', border: '1.5px solid #B2EBF2' }}>
              <SectionTitle>🌊 รายการที่เริ่มละลายแต่ยังไม่มีเวลาละลายเสร็จ ({stats.defrostCount} รายการ)</SectionTitle>
              <Divider sx={{ mb: 1.5 }} />
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {stats.defrostInProgress.map((r) => {
                  const round =
                    (r.start_defrost_date_four && !r.end_defrost_date_four) ? 4 :
                    (r.start_defrost_date_three && !r.end_defrost_date_three) ? 3 :
                    (r.start_defrost_date_two && !r.end_defrost_date_two) ? 2 : 1;
                  const startKey = round === 1 ? 'start_defrost_date' : `start_defrost_date_${['','','two','three','four'][round]}`;
                  const startTime = r[startKey];
                  const elapsed = startTime ? calcMin(startTime) : null;
                  return (
                    <Box key={r.mapping_id} sx={{ bgcolor: '#E0F7FA', border: '1px solid #80DEEA', borderRadius: '8px', px: 1.5, py: 1, minWidth: '160px', maxWidth: '200px' }}>
                      <Typography sx={{ fontSize: '11px', color: '#006064', fontWeight: 700 }}>{r.mat_name || r.mat}</Typography>
                      <Typography sx={{ fontSize: '11px', color: '#555' }}>Batch: {r.batch || '-'}</Typography>
                      <Typography sx={{ fontSize: '11px', color: '#555' }}>ป้าย: {r.tro_id || '-'} | รอบ {round}</Typography>
                      {elapsed != null && (
                        <Typography sx={{ fontSize: '11px', color: '#C62828', fontWeight: 600 }}>
                          ละลายมาแล้ว {formatTime(elapsed)}
                        </Typography>
                      )}
                    </Box>
                  );
                })}
              </Box>
            </Paper>
          </Grid>
        )}

      </Grid>
    </Box>
  );
};

export default TableMainPrep;
