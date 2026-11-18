import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

/**
 * The plan lists of the modals (/api/fetchProduction?includeWc=1) also hold products that exist only in the recipe database (WC):
 * { prod_id: null, source: "wc", wc_code_id, code, doc_no, line_type_id }.
 * Picking one must give it a prod_id first: the server uses the PFCM plan if it exists by now, else creates it (POST /api/production/ensurePlan).
 * Anything else (a normal plan, or the field being cleared) is returned as it is, with no request.
 * On failure the user is told and null is returned, so the field is cleared rather than left on a plan that has no prod_id.
 */
export const ensurePlan = async (plan) => {
  if (!plan || plan.source !== "wc" || (plan.prod_id !== null && plan.prod_id !== undefined)) return plan;
  try {
    const res = await axios.post(`${API_URL}/api/production/ensurePlan`, { wc_code_id: plan.wc_code_id });
    const made = res.data.data;
    return { ...plan, prod_id: made.prod_id, code: made.code, doc_no: made.doc_no, line_type_id: made.line_type_id, source: "pfcm" };
  } catch (err) {
    console.error("ensurePlan error:", err);
    window.alert(err.response?.data?.error || "สร้างแผนการผลิตไม่สำเร็จ");
    return null;
  }
};
