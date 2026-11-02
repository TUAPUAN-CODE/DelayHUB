// DBS1–DBS4 (delay time) — ported verbatim from the Report page (Pack/ReportRawmatNotEditTIME/Asset/Table.jsx) so the numbers match it.
// DBS1 = prep -> cold, DBS2 = time in cold rooms (+ waiting-for-production deposits), DBS3 = cold -> packed, DBS4 = total.
// Standards (hours) come from the row: DBS1..DBS4.

const buildMappedRow = (row) => {
  const gid = Number(row.rm_group_id);

  if (gid === 55) {
    return {
      _A: row.gm_date,
      _B: row.start_mixed_date,
      _C: row.rmit_date,
      _D: null, _E: null, _D3: null, _E3: null,
      _F: row.sc_pack_date,
    };
  }

  if (gid === 85 || gid === 49 || gid === 82) {
    const colA = (row.out_cold_date && row.out_cold_date !== '-' && row.out_cold_date !== null)
      ? row.out_cold_date
      : (row.rmit_date_mix ?? null);
    return {
      _A: colA,
      _B: row.start_mixed_date,
      _C: row.rmit_date,
      _D: null, _E: null, _D3: null, _E3: null,
      _F: row.sc_pack_date,
    };
  }

  if (gid === 46) {
    return {
      _A: null,
      _B: row.rmit_date,
      _C: null,
      _D: null,
      _E: null,
      _D3: null,
      _E3: null,
      _F: row.sc_pack_date,
    };
  }

  return {
    _A: row.rmit_date,
    _B: row.come_cold_date,
    _C: row.out_cold_date,
    _D: row.come_cold_date_two,
    _E: row.out_cold_date_two,
    _D3: row.come_cold_date_three,
    _E3: row.out_cold_date_three,
    _F: row.sc_pack_date,
  };
};

// Multi-stage flows (Tuna scrap, CK bone): a group whose RawMatGroup.cook_to_freeze is filled (FLOW_COOK_FREEZE).
//   DBS1 = cooked_date -> first stay in a cold room · DBS3 = rmit_date (preparation done, after the big cold room) -> sc_pack_date
//   plus three more stages (index 4..6 of getDbs): leaving the cold room -> into the big cold room, end of cooking -> into the big cold room,
//   leaving the big cold room -> preparation
export const isFlowGroup = (row) => row?.FLOW_COOK_FREEZE !== null && row?.FLOW_COOK_FREEZE !== undefined && row?.FLOW_COOK_FREEZE !== '';

const getRemappedRow = (row) => {
  const m = buildMappedRow(row);
  ROW_OF.set(m, row);
  if (isFlowGroup(row)) {
    m._flow = true;
    m._P = row.rmit_date;
    m._A = row.cooked_date || null;
    const first = sortedColdStays(m)[0];
    m._B = first ? first.in : null;
  }
  return m;
};

const isSpecialGroup = (row) => {
  const gid = Number(row.rm_group_id);
  return gid === 55 || gid === 85 || gid === 49 || gid === 46  || gid === 82;
};

// ─────────────────────────────────────────────────────────────
// DATE HELPERS
// ─────────────────────────────────────────────────────────────
const calculateMinutesDifference = (startDate, endDate) => {
  if (!startDate || startDate === '-' || !endDate || endDate === '-') return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  const diffInMinutes = (end - start) / (1000 * 60);
  return diffInMinutes >= 0 ? diffInMinutes : null;
};

const formatMinutesToTime = (minutes) => {
  if (minutes === null || minutes === undefined) return '-';
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  let timeString = '';
  if (hours > 0) timeString += `${hours} h`;
  if (mins > 0) {
    if (timeString) timeString += ' ';
    timeString += `${mins} m`;
  }
  return timeString || '-';
};

// ─────────────────────────────────────────────────────────────
// DBS CALCULATIONS
// ─────────────────────────────────────────────────────────────
const calculateDBS1FromMapped = (mapped, row) => {
  const gid = Number(row.rm_group_id);
  if (gid === 49 || gid === 85 || gid === 46 || gid === 82) return '-';
  return formatMinutesToTime(calculateMinutesDifference(mapped._A, mapped._B));
};

const calculateDBS2FromMapped = (mapped, isSpecial = false) => {
  if (isSpecial) return '-';
  const min = insideColdMinutes(mapped);
  return min === null ? '-' : formatMinutesToTime(min);
};

// Cold rooms (small + big, up to 7 stays) sorted by time in. DBS2 = the time spent IN them, DBS3 = the time OUTSIDE them after the first exit:
//   DBS2 = (in 1 -> out 1) + (in 2 -> out 2) + ...      DBS3 = (out 1 -> in 2) + (out 2 -> in 3) + ... + (last out -> packed)
// so DBS1 + DBS2 + DBS3 = the whole time from "prep finished" to "packed". A stay that is still open counts up to now only on a live row (mapped._now).
const ROW_OF = new WeakMap(); // mapped row -> the row it was made from
const sortedColdStays = (mapped) => {
  const row = ROW_OF.get(mapped);
  if (!row) return [];
  const pairs = [
    { in: row.come_cold_date, out: row.out_cold_date },
    { in: row.come_cold_date_two, out: row.out_cold_date_two },
    { in: row.come_cold_date_three, out: row.out_cold_date_three },
    { in: row.cs_come_cold_date, out: row.cs_out_cold_date },
    { in: row.cs_come_cold_date_two, out: row.cs_out_cold_date_two },
    { in: row.cs_come_cold_date_three, out: row.cs_out_cold_date_three },
    { in: row.cs_come_cold_date_four, out: row.cs_out_cold_date_four },
  ].filter((p) => p.in && p.in !== '-');
  pairs.sort((a, b) => { const da = new Date(a.in); const db = new Date(b.in); return (isNaN(da) ? 1 : 0) - (isNaN(db) ? 1 : 0) || da - db; });
  return pairs;
};
const insideColdMinutes = (mapped) => {
  let total = 0; let has = false;
  sortedColdStays(mapped).forEach((p) => {
    const out = p.out && p.out !== '-' ? p.out : mapped._now;
    const d = out ? calculateMinutesDifference(p.in, out) : null;
    if (d !== null) { total += d; has = true; }
  });
  return has ? total : null;
};
const outsideColdMinutes = (mapped) => {
  const pairs = sortedColdStays(mapped);
  if (!pairs.length) return null;
  let total = 0; let has = false;
  for (let i = 0; i < pairs.length; i += 1) {
    const out = pairs[i].out;
    if (!out || out === '-') break; // still in a cold room: nothing is counted after it
    const next = i + 1 < pairs.length ? pairs[i + 1].in : mapped._F;
    const gap = calculateMinutesDifference(out, next);
    if (gap !== null) { total += gap; has = true; }
  }
  return has ? total : null;
};

const calculateDBS3FromMapped = (mapped, isSpecial = false) => {
  if (isSpecial) return '-';
  if (mapped._flow) return formatMinutesToTime(calculateMinutesDifference(mapped._P, mapped._F));
  const min = outsideColdMinutes(mapped);
  return min === null ? '-' : formatMinutesToTime(min >= 0 ? min : 0);
};

const calculateDBS4FromMapped = (mapped, isSpecial = false, row = null) => {
  const gid = Number(row?.rm_group_id);

  if (gid === 46) {
    return formatMinutesToTime(calculateMinutesDifference(mapped._B, mapped._F));
  }

  if (isSpecial) {
    const part2 = calculateMinutesDifference(mapped._C, mapped._F);
    if (part2 !== null) return formatMinutesToTime(part2);
    return formatMinutesToTime(calculateMinutesDifference(mapped._A, mapped._F));
  }

  const min1 = calcDBS1Minutes(mapped, row);
  const min3 = calcDBS3Minutes(mapped, isSpecial);

  // ✅ ถ้า DBS1 และ DBS3 ไม่มีค่าทั้งคู่ → ใช้ _A ถึง _F
  if (min1 === null && min3 === null) {
    return formatMinutesToTime(calculateMinutesDifference(mapped._A, mapped._F));
  }

  if (min1 !== null && min3 !== null) return formatMinutesToTime(min1 + min3);
  if (min1 !== null) return formatMinutesToTime(min1);
  if (min3 !== null) return formatMinutesToTime(min3);
  return '-';
};

const calcDBS4Minutes = (mapped, isSpecial, row = null) => {
  const gid = Number(row?.rm_group_id);

  if (gid === 46) {
    return calculateMinutesDifference(mapped._B, mapped._F);
  }

  if (isSpecial) {
    const p2 = calculateMinutesDifference(mapped._C, mapped._F);
    if (p2 !== null) return p2;
    return calculateMinutesDifference(mapped._A, mapped._F);
  }

  const min1 = calcDBS1Minutes(mapped, row);
  const min3 = calcDBS3Minutes(mapped, isSpecial);

  // ✅ ถ้า DBS1 และ DBS3 ไม่มีค่าทั้งคู่ → ใช้ rmit_date (_A) ถึง sc_pack_date (_F)
  if (min1 === null && min3 === null) {
    return calculateMinutesDifference(mapped._A, mapped._F);
  }

  if (min1 !== null && min3 !== null) return min1 + min3;
  if (min1 !== null) return min1;
  if (min3 !== null) return min3;
  return null;
};

const calcDBS1Minutes = (mapped, row) => {
  const gid = Number(row.rm_group_id);
  if (gid === 49 || gid === 85 || gid === 46 || gid === 82) return null;
  return calculateMinutesDifference(mapped._A, mapped._B);
};

const calcDBS2Minutes = (mapped, isSpecial) => {
  if (isSpecial) return null;
  return insideColdMinutes(mapped);
};

const calcDBS3Minutes = (mapped, isSpecial) => {
  if (isSpecial) return null;
  if (mapped._flow) return calculateMinutesDifference(mapped._P, mapped._F);
  const min = outsideColdMinutes(mapped);
  return min === null ? null : (min >= 0 ? min : 0);
};

const parseStandardDBSToMinutes = (val) => {
  if (val === null || val === undefined || val === '-' || val === '') return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n * 60;
};


const parseTimeToMinutes = (txt) => {
  // "2 h 5 m" -> minutes (used only when a calculation returns text without minutes)
  if (!txt || txt === '-') return null;
  const h = /(\d+)\s*h/.exec(txt);
  const m = /(\d+)\s*m/.exec(txt);
  return (h ? parseInt(h[1], 10) * 60 : 0) + (m ? parseInt(m[1], 10) : 0);
};

// ─────────────────────────────────────────────────────────────
// LIVE TIME (the clock of the stage a material is in keeps running until the next event)
//   DBS1  rmit_date  -> come_cold_date   (running from rmit_date until the material enters a cold room)
//   DBS2  come_cold_date -> out_cold_date (running while it is in a cold room)
//   DBS3  out_cold_date  -> sc_pack_date  (running after it left the cold room, until packing is finished)
//   DBS4  DBS1 + DBS3 (special groups: whole time to packing) — so it also grows with the stage the material is in
// A finished row (sc_pack_date / "บรรจุเสร็จ" / "สำเร็จ") never runs any more.
// ─────────────────────────────────────────────────────────────
const isFinished = (row) => Boolean(row.sc_pack_date) || String(row.rm_status || '') === 'สำเร็จ' || String(row.dest || '').startsWith('บรรจุเสร็จ');

const applyLive = (m, row, nowD) => {
  if (isFinished(row)) return;
  const gid = Number(row.rm_group_id);
  if (m._flow) {
    if (m._A && !m._B) m._B = nowD;          // DBS1 running (cooked, not in a cold room yet)
    if (m._P && !m._F) m._F = nowD;          // DBS3 running (prepared, not packed yet)
    return;
  }
  if (isSpecialGroup(row)) {
    if (!m._F && (gid === 46 ? m._B : (m._C || m._A))) m._F = nowD;
    return;
  }
  if (m._A && !m._B && !m._C && !m._F) { m._B = nowD; return; }   // DBS1 running
  if (m._B && !m._C) { m._C = nowD; return; }                      // DBS2 running (first stay in a cold room)
  if (m._C && !m._F) {                                              // DBS3 running (a second / third stay in a cold room that is still open is counted up to now too)
    if (m._D && !m._E) m._E = nowD;
    if (m._D3 && !m._E3) m._E3 = nowD;
    m._F = nowD;
  }
};

const ms = (v) => { const t = v ? new Date(v).getTime() : NaN; return Number.isNaN(t) ? null : t; };
const FLOW_NONE = { text: '-', minutes: null, std: null, over: false };

/** the three extra stages of a flow group: [leave cold room -> big cold room, end of cooking -> big cold room, leave big cold room -> preparation] */
const flowStages = (mapped, row, nowD) => {
  const stays = sortedColdStays(mapped);
  const stds = [row.FLOW_CS_FREEZE, row.FLOW_COOK_FREEZE, row.FLOW_FREEZE_PREP].map(parseStandardDBSToMinutes);
  const live = nowD && !isFinished(row) ? nowD : null;
  const mk = (i, from, to) => {
    if (stds[i] === null) return FLOW_NONE;
    const end = to || live;
    const minutes = from && end ? calculateMinutesDifference(from, end) : null;
    return { text: minutes === null ? '-' : formatMinutesToTime(minutes), minutes, std: stds[i], over: minutes !== null && minutes > stds[i] };
  };
  const out0 = stays[0]?.out && stays[0].out !== '-' ? stays[0].out : null;
  const cookEnd = ms(row.cook_end_date);
  const afterCook = cookEnd === null ? null : stays.find((p) => (ms(p.in) ?? -1) > cookEnd);
  // leaving the big cold room counts from the stay AFTER the cooking (the freeze before the cooking is not the one that goes to preparation)
  const afterStays = cookEnd === null ? [] : stays.filter((p) => (ms(p.in) ?? -1) > cookEnd);
  const last = afterStays[afterStays.length - 1];
  const lastOut = last?.out && last.out !== '-' ? last.out : null;
  return [
    mk(0, out0, stays[1]?.in || null),
    mk(1, row.cook_end_date || null, afterCook?.in || null),
    mk(2, lastOut, row.rmit_date || null),
  ];
};

/** [{text, minutes, std, over}] for DBS1..DBS4 of a mapping row (over = longer than the standard of its raw material group). `now` (ms or Date) makes the running stage count up to the present. */
export const getDbs = (row, now = null) => {
  const mapped = getRemappedRow(row);
  if (now) { applyLive(mapped, row, new Date(now)); if (!isFinished(row)) mapped._now = new Date(now); }
  const special = isSpecialGroup(row);
  const std = [row.DBS1, row.DBS2, row.DBS3, row.DBS4].map(parseStandardDBSToMinutes);
  const mins = [
    calcDBS1Minutes(mapped, row),
    calcDBS2Minutes(mapped, special, row),
    calcDBS3Minutes(mapped, special),
    calcDBS4Minutes(mapped, special, row),
  ];
  const texts = [
    calculateDBS1FromMapped(mapped, row),
    calculateDBS2FromMapped(mapped, special, row),
    calculateDBS3FromMapped(mapped, special),
    calculateDBS4FromMapped(mapped, special, row),
  ];
  const out = texts.map((text, i) => {
    const minutes = mins[i] ?? parseTimeToMinutes(text);
    const skip = (i === 1 || i === 2) && special; // special groups have no DBS2/DBS3 standard
    return { text, minutes, std: skip ? null : std[i], over: !skip && std[i] !== null && minutes !== null && minutes > std[i] };
  });
  if (mapped._flow) out.push(...flowStages(mapped, row, now ? new Date(now) : null));
  return out;
};

/**
 * Which DBS colours a row (index 0..3): the DBS of the stage the row is in.
 *   finished (packed)                              -> DBS4 (the final total)
 *   in a cold room (cs_id, or an open stay)        -> DBS2
 *   out of the cold room, not finished             -> DBS3
 *   before the cold room                           -> DBS1
 * A row of a special group has no DBS1-3: the caller falls back to DBS4 when the chosen DBS has no value.
 */
export const stageDbsIndex = (row) => {
  if (isFinished(row)) return 3;
  if (isFlowGroup(row)) {
    const inRoom = Boolean(row.cs_id) || sortedColdStays(getRemappedRow(row)).some((p) => !p.out || p.out === '-');
    if (row.rmit_date) return 2;                                   // prepared: the packing clock (DBS3)
    if (inRoom) return 1;
    const cookEnd = ms(row.cook_end_date);
    if (cookEnd !== null && !sortedColdStays(getRemappedRow(row)).some((p) => (ms(p.in) ?? -1) > cookEnd)) return 5; // cooked, waiting for the big cold room
    return row.cooked_date && !row.come_cold_date && !row.cs_come_cold_date ? 0 : 1;
  }
  const inCold = Boolean(row.cs_id)
    || Boolean(row.come_cold_date && !row.out_cold_date)
    || Boolean(row.come_cold_date_two && !row.out_cold_date_two)
    || Boolean(row.come_cold_date_three && !row.out_cold_date_three);
  if (inCold) return 1;
  if (row.out_cold_date) return 2;
  return 0;
};
