// Delay of a trolley in a large cold room (DCS): shared by the ห้องเย็นใหญ่ table and the stock summary page.

// ✅ cs_id ที่ไม่คำนวณ DCS (temp <18 องศา)
export const NO_DCS_CS_IDS = [10, 14, 21, 25, 26, 37, 38];

export const formatTime = (minutes) => {
  if (isNaN(minutes) || minutes === null) return '-';
  const abs   = Math.abs(minutes);
  const days  = Math.floor(abs / 1440);
  const hours = Math.floor((abs % 1440) / 60);
  const mins  = Math.floor(abs % 60);
  let s = '';
  if (days  > 0)              s += `${days} วัน`;
  if (hours > 0)              s += `${s ? ' ' : ''}${hours} ชม.`;
  if (mins  > 0 || (!days && !hours)) s += `${s ? ' ' : ''}${mins} นาที`;
  return s.trim();
};

export const getLatestCsComeCold = (row) => {
  const dates = [
    row.cs_come_cold_date, row.cs_come_cold_date_two,
    row.cs_come_cold_date_three, row.cs_come_cold_date_four,
  ].filter(Boolean);
  if (dates.length === 0) return null;
  return new Date(Math.max(...dates.map(d => new Date(d).getTime())));
};

// ✅ ตรวจสอบ cs_id ว่าอยู่ในกลุ่ม temp <18 หรือไม่
export const isNoDcsRoom = (row) => NO_DCS_CS_IDS.includes(Number(row.cs_id));

// minutes: > 0 = minutes left, < 0 = minutes over the limit (absent when there is no time: no DCS / not in a room yet)
export const calculateCSDelayTime = (row) => {
  // ✅ ถ้าเป็นห้องที่ไม่คำนวณ DCS ให้ return ข้อความพิเศษ
  if (isNoDcsRoom(row)) {
    return { color: 'grey', statusMessage: 'temp ต่ำกว่า -18 องศา ไม่คำนวณ DCS', percentage: 0, noDcs: true };
  }

  const latestCS = getLatestCsComeCold(row);
  if (!latestCS) {
    return { color: 'grey', statusMessage: 'รอดำเนินการ', percentage: 0 };
  }

  const timePassed = (new Date() - latestCS) / (1000 * 60);

  const rawStd = parseFloat(row.standard_cold);
  const standardMinutes = !isNaN(rawStd) && rawStd > 0
    ? Math.floor(rawStd) * 60 + (rawStd % 1) * 100
    : 120;

  const rawCold = parseFloat(row.cold);

  if (!isNaN(rawCold)) {
    if (rawCold < 0) {
      const excMin   = Math.floor(Math.abs(rawCold)) * 60 + (Math.abs(rawCold) % 1) * 100;
      const totalExc = excMin + timePassed;
      return { color: 'red', statusMessage: `เลยกำหนด ${formatTime(totalExc)}`, percentage: ((standardMinutes + totalExc) / standardMinutes) * 100, minutes: -totalExc };
    }
    if (rawCold === 0) {
      return { color: 'red', statusMessage: `เลยกำหนด ${formatTime(timePassed)}`, percentage: ((standardMinutes + timePassed) / standardMinutes) * 100, minutes: -timePassed };
    }
    const coldMin = Math.floor(rawCold) * 60 + (rawCold % 1) * 100;
    if (timePassed > coldMin) {
      const exc = timePassed - coldMin;
      return { color: 'red', statusMessage: `เลยกำหนด ${formatTime(exc)}`, percentage: ((standardMinutes + exc) / standardMinutes) * 100, minutes: -exc };
    }
    const remaining = coldMin - timePassed;
    const pct   = Math.min(100, (timePassed / standardMinutes) * 100);
    const color = pct >= 100 ? 'red' : pct >= 70 ? 'orange' : 'green';
    return { color, statusMessage: `เหลืออีก ${formatTime(remaining)}`, percentage: pct, minutes: remaining };
  }

  const pct = Math.min(100, (timePassed / standardMinutes) * 100);
  if (pct >= 100) {
    const exc = timePassed - standardMinutes;
    return { color: 'red', statusMessage: `เลยกำหนด ${formatTime(exc)}`, percentage: pct, minutes: -exc };
  }
  const remaining = standardMinutes - timePassed;
  const color = pct >= 70 ? 'orange' : 'green';
  return { color, statusMessage: `เหลืออีก ${formatTime(remaining)}`, percentage: pct, minutes: remaining };
};
