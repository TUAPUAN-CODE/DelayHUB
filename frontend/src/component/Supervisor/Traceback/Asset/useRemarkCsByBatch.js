import { useEffect, useState } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

/** every HU of these batches with its Remark CS, the mappings of the HU and who typed / changed the note (GET /api/prep/remark-cs/by-batch) */
const useRemarkCsByBatch = (batches) => {
  const [state, setState] = useState({ loading: false, rows: [], error: '' });
  const sig = (batches || []).filter(Boolean).join(',');
  useEffect(() => {
    if (!sig) { setState({ loading: false, rows: [], error: '' }); return undefined; }
    let alive = true;
    const load = async () => {
      setState((s) => ({ ...s, loading: true, error: '' }));
      try {
        const res = await axios.get(`${API_URL}/api/prep/remark-cs/by-batch`, { params: { batches: sig } });
        if (alive) setState({ loading: false, rows: res.data?.data ?? [], error: '' });
      } catch (err) {
        console.error('[Traceback] remark cs by batch error:', err);
        if (alive) setState({ loading: false, rows: [], error: 'โหลด Remark CS แยกตาม HU ไม่สำเร็จ' });
      }
    };
    load();
    return () => { alive = false; };
  }, [sig]);
  return state;
};

export default useRemarkCsByBatch;
