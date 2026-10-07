import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { buildUnifiedRows } from './unify';
import { formatDateTime, todayLocal } from './timeFields';

axios.defaults.withCredentials = true;
const API_URL = import.meta.env.VITE_API_URL;

const prepRow = (r) => ({ ...r, CookedDateTime: r.CookedDateTime ? formatDateTime(r.CookedDateTime) : null, withdraw_date: r.withdraw_date ? formatDateTime(r.withdraw_date) : null });
/** The server pushes the whole production-plan list (same shape as /api/prep/manage/fetchRMForProd) every time somebody loads it */
const isPlanList = (p) => Array.isArray(p) && p.length > 0 && p[0] && typeof p[0] === 'object' && 'rmfp_id' in p[0] && 'rm_group_name' in p[0] && 'level_eu' in p[0];

/**
 * Data of the Time Stamp page: SAP rows of the chosen day + the production-plan rows to manage, joined (see unify.js), kept fresh by socket.io.
 *
 * About the socket: the server broadcasts "dataUpdated" to every client each time ANY client loads the plan list. Reloading on that event
 * made every open page reload again and again for ever, so a pushed plan list is used directly (no reload) and a reload caused by other
 * events is limited to once per MIN_GAP_MS.
 */
export function useTimeStampData() {
  const [date, setDate] = useState(todayLocal());
  const [sapRows, setSapRows] = useState([]);
  const [planRows, setPlanRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [updatedAt, setUpdatedAt] = useState(null);
  const rmTypeIds = useMemo(() => { try { return JSON.parse(localStorage.getItem('rm_type_id') || '[]'); } catch { return []; } }, []);
  const dateRef = useRef(date);
  dateRef.current = date;
  const seq = useRef(0);

  const load = useCallback(async () => {
    const my = ++seq.current;   // an older answer never overwrites a newer one
    setLoading(true);
    const [sap, plan] = await Promise.allSettled([
      axios.get(`${API_URL}/api/coldstorages/scan/sap/month`, { params: { rm_type_ids: rmTypeIds.join(','), withdraw_date: dateRef.current } }),
      rmTypeIds.length ? axios.get(`${API_URL}/api/prep/manage/fetchRMForProd`, { params: { rm_type_ids: rmTypeIds.join(',') } }) : Promise.resolve({ data: { success: true, data: [] } }),
    ]);
    if (my !== seq.current) return;
    const errs = [];
    if (sap.status === 'fulfilled') {
      const d = sap.value.data;
      setSapRows(Array.isArray(d) ? d : d?.success ? d.data ?? [] : []);
    } else { console.error('โหลดรายการ SAP ไม่สำเร็จ:', sap.reason); errs.push('โหลดรายการวัตถุดิบ (SAP) ไม่สำเร็จ'); }
    if (plan.status === 'fulfilled') setPlanRows((plan.value.data?.data ?? []).map(prepRow));
    else { console.error('โหลดรายการจัดการวัตถุดิบไม่สำเร็จ:', plan.reason); errs.push('โหลดรายการจัดการวัตถุดิบไม่สำเร็จ'); }
    setErrors(errs);
    setUpdatedAt(new Date());
    setLoading(false);
  }, [rmTypeIds]);

  useEffect(() => { void load(); }, [load, date]);

  useEffect(() => {
    const socket = io(API_URL, { transports: ['websocket'], reconnectionAttempts: 5, reconnectionDelay: 1000, autoConnect: true });
    socket.on('connect_error', (e) => console.error('Socket connect error:', e.message));
    socket.on('error', (e) => console.error('Socket error:', e));
    socket.emit('joinRoom', 'saveRMForProdRoom');
    const MIN_GAP_MS = 8000;
    let last = 0; let timer = null;
    const refresh = (gap) => {
      if (timer) return;
      const wait = Math.max(300, last + gap - Date.now());
      timer = setTimeout(() => { timer = null; last = Date.now(); void load(); }, wait);
    };
    const onUpdated = (payload) => {
      if (isPlanList(payload)) {
        const mine = rmTypeIds.length ? payload.filter((r) => rmTypeIds.map(String).includes(String(r.rm_type_id))) : [];
        setPlanRows(mine.map(prepRow));
        return;
      }
      refresh(Array.isArray(payload) ? MIN_GAP_MS : 1000);
    };
    const onChanged = () => refresh(1000);
    socket.on('dataUpdated', onUpdated);
    socket.on('dataDelete', onChanged);
    socket.on('rawMaterialSaved', onChanged);
    return () => {
      socket.off('dataUpdated', onUpdated); socket.off('dataDelete', onChanged); socket.off('rawMaterialSaved', onChanged);
      socket.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [load, rmTypeIds]);

  const rows = useMemo(() => buildUnifiedRows(sapRows, planRows), [sapRows, planRows]);
  return { date, setDate, rows, loading, errors, updatedAt, refresh: load, rmTypeIds };
}
