import { TONE_CLASS, decisionTone } from "./supFormat";

// Quality decision of an inspection lot (A01 ACCEPT, A03 ACCEPT WITH CONDITION, A04 COMPLAINT, R01 REJECT ...).
const DecisionBadge = ({ code, description, ar }) => {
  const tone = decisionTone(code, ar);
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASS[tone]}`}>
      {code ? `${code}${description ? ` · ${description}` : ""}` : "รอผล"}
    </span>
  );
};

export default DecisionBadge;
