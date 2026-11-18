import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@mui/material";
import theme from "../../theme/dochubTheme";
import LineTypeDialog from "./LineTypeDialog";

/**
 * Asks which line type a new plan gets and resolves with its line_type_id, or null when the user cancels.
 * ensurePlan() is a plain function called from the modals' onChange, so the dialog is mounted on its own React root and removed when answered.
 */
const askLineType = ({ plan, lineTypes, suggestedId }) =>
  new Promise((resolve) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const finish = (value) => {
      root.unmount();
      host.remove();
      resolve(value);
    };
    root.render(
      <ThemeProvider theme={theme}>
        <LineTypeDialog plan={plan} lineTypes={lineTypes} suggestedId={suggestedId} onSave={finish} onCancel={() => finish(null)} />
      </ThemeProvider>
    );
  });

export default askLineType;
