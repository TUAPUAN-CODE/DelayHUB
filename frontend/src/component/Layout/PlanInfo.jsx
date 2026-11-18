import { useEffect, useState } from "react";
import axios from "axios";
import { Box, Chip, Typography } from "@mui/material";

const API_URL = import.meta.env.VITE_API_URL;

// One lookup per plan for the whole session: the same plan is picked again and again in the modals.
// Only answers are kept (a plan that has no match is an answer too); a failed request is retried next time.
const cache = new Map();
const lookup = (code, docNo) => {
  const key = `${code}|${docNo}`;
  if (!cache.has(key)) {
    const request = axios
      .get(`${API_URL}/api/recipe/fetchPlanInfo`, { params: { code, docNo } })
      .then((res) => res.data.data ?? null);
    request.catch(() => cache.delete(key));
    cache.set(key, request);
  }
  return cache.get(key);
};

const num = (v) => (Number(v) > 0 ? String(Number(Number(v).toFixed(2))) : "-");

/**
 * What the picked production plan is, under the "แผนการผลิต" field of a modal: its product code and doc no (PFCM keeps them in two columns)
 * and — when the recipe database knows the product — customer, market, package and the target weights.
 * `plan` is a row of Production ({ prod_id, code, doc_no }) or null (nothing is shown until a plan is picked).
 */
const PlanInfo = ({ plan }) => {
  const code = plan?.code ? String(plan.code).trim() : "";
  const docNo = plan?.doc_no ? String(plan.doc_no).trim() : "";
  const [state, setState] = useState({ key: "", loading: false, info: null, failed: false });
  const key = code && docNo ? `${code}|${docNo}` : "";

  useEffect(() => {
    if (!key) return undefined;
    let alive = true;
    setState({ key, loading: true, info: null, failed: false });
    lookup(code, docNo)
      .then((info) => alive && setState({ key, loading: false, info, failed: false }))
      .catch((err) => {
        console.error("fetchPlanInfo error:", err);
        if (alive) setState({ key, loading: false, info: null, failed: true });
      });
    return () => {
      alive = false;
    };
  }, [key, code, docNo]);

  if (!code) return null;
  const { info, loading, failed } = state.key === key ? state : { info: null, loading: true, failed: false };

  return (
    <Box sx={{ mb: 2, px: 1.5, py: 1, borderRadius: 1, bgcolor: "#f5f8ff", border: "1px solid #e1e8f7" }}>
      <Typography variant="body2" sx={{ color: "#333" }}>
        <b>รหัสสินค้า</b> {code}
        {docNo && (
          <>
            {" · "}
            <b>เลขที่เอกสาร</b> {docNo}
          </>
        )}
      </Typography>

      {loading && <Typography variant="caption" color="text.secondary">กำลังโหลดข้อมูลสินค้า...</Typography>}
      {failed && <Typography variant="caption" color="error">โหลดข้อมูลสินค้าไม่สำเร็จ</Typography>}
      {!loading && !failed && !info && <Typography variant="caption" color="text.secondary">ไม่พบข้อมูลสินค้าในระบบสูตร</Typography>}

      {info && (
        <>
          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75, mt: 0.5 }}>
            {info.customer && <Chip size="small" label={info.customer} />}
            {info.market && <Chip size="small" color="success" variant="outlined" label={info.market} />}
            {info.package && <Typography variant="caption" color="text.secondary">{info.package}</Typography>}
          </Box>
          <Typography variant="body2" sx={{ mt: 0.5, color: "#333" }}>
            {`NW ${num(info.targetNW)} · FW ${num(info.targetFW)} · Label ${num(info.labelNW)}`}
          </Typography>
          {info.match === "partial" && (
            <Typography variant="caption" color="text.secondary">{`จับคู่โดยประมาณ: ${info.productCode}`}</Typography>
          )}
        </>
      )}
    </Box>
  );
};

export default PlanInfo;
