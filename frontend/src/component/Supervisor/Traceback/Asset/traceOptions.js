import { useEffect, useState } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;
const EMPTY = { code: [], doc_no: [], mat: [], mat_name: [], rmm_line_name: [], supplier: [], batch: [] };
let pending = null;   // one request shared by every section of the page (the server keeps the lists 10 minutes too)

/** the dropdown lists of /api/traceback/filters: loaded once, shared by the sections of the Traceback page */
export const useTraceOptions = () => {
  const [state, setState] = useState({ opts: EMPTY, loading: true });
  useEffect(() => {
    let alive = true;
    if (!pending) {
      pending = axios.get(`${API_URL}/api/traceback/filters`).then((r) => r.data?.data || {}).catch((e) => { pending = null; throw e; });
    }
    pending
      .then((data) => { if (alive) setState({ opts: { ...EMPTY, ...data }, loading: false }); })
      .catch((e) => { console.warn('โหลดรายการตัวกรองไม่สำเร็จ:', e.message); if (alive) setState({ opts: EMPTY, loading: false }); });
    return () => { alive = false; };
  }, []);
  return state;
};
