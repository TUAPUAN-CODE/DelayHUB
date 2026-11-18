import axios from "axios";
import askLineType from "./askLineType";

const API_URL = import.meta.env.VITE_API_URL;

let lineTypesRequest = null; // the 5 rows of LineType: asked once

const getLineTypes = () => {
  if (!lineTypesRequest) {
    lineTypesRequest = axios.get(`${API_URL}/api/production/fetchLineTypes`).then((res) => res.data.data ?? []);
    lineTypesRequest.catch(() => { lineTypesRequest = null; });
  }
  return lineTypesRequest;
};

const ensure = (body) => axios.post(`${API_URL}/api/production/ensurePlan`, body).then((res) => res.data.data);

const asPlan = (plan, made) => ({ ...plan, prod_id: made.prod_id, code: made.code, doc_no: made.doc_no, line_type_id: made.line_type_id, source: "pfcm" });

/**
 * The plan lists of the modals (/api/fetchProduction?includeWc=1) also hold products that exist only in the recipe database (WC):
 * { prod_id: null, source: "wc", wc_code_id, code, doc_no, line_type_id }.
 * Picking one must give it a prod_id first:
 *   1. ask the server (dry run): if the PFCM plan exists by now it is used as it is — nothing is created;
 *   2. otherwise the user picks the line type by its name (the one suggested from the package is pre-selected) and the plan is saved.
 * Anything else (a normal plan, or the field being cleared) is returned as it is, with no request.
 * Cancelling or a failure gives null, so the field is cleared rather than left on a plan that has no prod_id.
 */
export const ensurePlan = async (plan) => {
  if (!plan || plan.source !== "wc" || (plan.prod_id !== null && plan.prod_id !== undefined)) return plan;
  try {
    const preview = await ensure({ wc_code_id: plan.wc_code_id, dry_run: true });
    if (preview.action === "reuse") return asPlan(plan, preview);
    if (preview.action === "reject") {
      window.alert(preview.reason);
      return null;
    }

    const lineTypes = await getLineTypes();
    const lineTypeId = await askLineType({ plan, lineTypes, suggestedId: preview.plan.line_type_id });
    if (lineTypeId === null) return null; // cancelled: nothing is saved

    return asPlan(plan, await ensure({ wc_code_id: plan.wc_code_id, line_type_id: lineTypeId }));
  } catch (err) {
    console.error("ensurePlan error:", err);
    window.alert(err.response?.data?.error || "สร้างแผนการผลิตไม่สำเร็จ");
    return null;
  }
};
