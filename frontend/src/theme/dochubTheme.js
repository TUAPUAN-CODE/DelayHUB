import { createTheme } from "@mui/material/styles";

/**
 * Design tokens of the whole app — "clean white" theme: near-white page, blue top bar and table headers,
 * orange for the main action of a page (palette.secondary), white cards with a soft blue shadow, Prompt font.
 * Keep the values in sync with the CSS variables in index.css.
 */
export const TOKENS = {
  primary: "#1552F0",
  primaryDark: "#0F3FC4",
  primarySoft: "#EAF0FF",
  accent: "#F26B1D",
  accentLight: "#FF9A4D",
  accentSoft: "#FFF1E6",
  bg: "#F4F7FD",
  surface: "#FFFFFF",
  text: "#13213F",
  muted: "#5B6B8C",
  border: "#E1E9FA",
  success: "#16A34A",
  warning: "#F59E0B",
  danger: "#E5484D",
  radius: 12,
};

const FONT = "'Prompt', 'Noto Sans Thai', system-ui, sans-serif";

/**
 * GLASS = cards / tables / panels (almost opaque white: easy to read on the floor), GLASS_STRONG = dialogs / menus.
 * Only the short-lived surfaces (GLASS_STRONG) blur what is behind them: a backdrop-filter on every card / table panel made scrolling a big table
 * (the work table) re-blur the whole page background at every frame -> stutter. The panels are .88 white, so the blur was hardly visible anyway.
 */
export const GLASS = {
  backgroundColor: "rgba(255,255,255,.88)",
  border: `1px solid ${TOKENS.border}`,
  boxShadow: "0 1px 2px rgba(19,33,63,.04), 0 6px 24px rgba(21,82,240,.08)",
};
export const GLASS_STRONG = {
  ...GLASS,
  backdropFilter: "blur(12px) saturate(140%)",
  WebkitBackdropFilter: "blur(12px) saturate(140%)",
  backgroundColor: "rgba(255,255,255,.96)",
  boxShadow: "0 24px 64px rgba(19,33,63,.22)",
};
const ORANGE = `linear-gradient(135deg, ${TOKENS.accentLight}, ${TOKENS.accent})`;
const BLUE = "linear-gradient(135deg, #3B7BFF, #1552F0)";

const theme = createTheme({
  palette: {
    primary: { main: TOKENS.primary, dark: TOKENS.primaryDark, light: "#4D7BF5", contrastText: "#fff" },
    secondary: { main: TOKENS.accent, light: TOKENS.accentLight, dark: "#D95A10", contrastText: "#fff" },
    success: { main: TOKENS.success },
    warning: { main: TOKENS.warning },
    error: { main: TOKENS.danger },
    background: { default: "transparent", paper: "#FFFFFF" },
    text: { primary: TOKENS.text, secondary: TOKENS.muted },
    divider: TOKENS.border,
  },
  shape: { borderRadius: TOKENS.radius },
  typography: {
    fontFamily: FONT,
    button: { textTransform: "none", fontWeight: 500, letterSpacing: 0 },
    h1: { fontWeight: 600 }, h2: { fontWeight: 600 }, h3: { fontWeight: 600 },
    h4: { fontWeight: 600 }, h5: { fontWeight: 600 }, h6: { fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: { styleOverrides: { body: { fontFamily: FONT } } },
    MuiButtonBase: { defaultProps: { disableRipple: false } },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 999, padding: "6px 18px", fontWeight: 500, transition: "background .15s, box-shadow .15s, transform .1s, border-color .15s", "&:active": { transform: "scale(.98)" } },
        containedPrimary: { background: BLUE, boxShadow: "0 3px 10px rgba(21,82,240,.25)", "&:hover": { background: BLUE, filter: "brightness(1.06)", boxShadow: "0 6px 16px rgba(21,82,240,.32)" } },
        containedSecondary: { background: ORANGE, boxShadow: "0 3px 10px rgba(242,107,29,.30)", "&:hover": { background: ORANGE, filter: "brightness(1.06)", boxShadow: "0 6px 16px rgba(242,107,29,.38)" } },
        contained: { "&.Mui-disabled": { background: "#EEF2FA", color: "#A3AFC6", boxShadow: "none" } },
        outlined: { backgroundColor: "#fff" },
        outlinedPrimary: { borderColor: "rgba(21,82,240,.4)", "&:hover": { backgroundColor: TOKENS.primarySoft, borderColor: TOKENS.primary } },
        textPrimary: { "&:hover": { backgroundColor: TOKENS.primarySoft } },
        sizeSmall: { padding: "4px 14px", fontSize: 13 },
        startIcon: { marginRight: 6 },
      },
    },
    MuiIconButton: { styleOverrides: { root: { borderRadius: 10, transition: "background-color .15s, transform .1s", "&:active": { transform: "scale(.94)" } } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" }, rounded: { borderRadius: 16 }, outlined: { borderColor: TOKENS.border } } },
    MuiCard: { styleOverrides: { root: { borderRadius: 16, ...GLASS } } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 20, ...GLASS_STRONG } } },
    MuiPopover: { styleOverrides: { paper: { ...GLASS_STRONG, boxShadow: "0 12px 32px rgba(16,24,60,.18)" } } },
    MuiDrawer: { styleOverrides: { paper: { ...GLASS_STRONG } } },
    MuiAccordion: { styleOverrides: { root: { ...GLASS, "&:before": { display: "none" } } } },
    MuiAppBar: { styleOverrides: { root: { background: "linear-gradient(90deg, #1552F0, #3B7BFF)" } } },
    MuiDialogTitle: { styleOverrides: { root: { fontWeight: 600, fontSize: 18, borderBottom: `1px solid ${TOKENS.border}` } } },
    MuiDialogActions: { styleOverrides: { root: { padding: "12px 20px 16px", gap: 4 } } },
    MuiBackdrop: { styleOverrides: { root: { backgroundColor: "rgba(19,33,63,.35)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(4px)", "&.MuiBackdrop-invisible": { backgroundColor: "transparent", backdropFilter: "none", WebkitBackdropFilter: "none" } } } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 12, backgroundColor: "#fff", transition: "box-shadow .15s",
          "& .MuiOutlinedInput-notchedOutline": { borderColor: "#D5DFF2" },
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#C5CEE0" },
          "&.Mui-focused": { boxShadow: "0 0 0 3px rgba(21,82,240,.14)" },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: TOKENS.primary, borderWidth: 1 },
        },
      },
    },
    MuiInputLabel: { styleOverrides: { root: { "&.Mui-focused": { color: TOKENS.primary } } } },
    MuiSelect: { styleOverrides: { select: { borderRadius: 10 } } },
    MuiMenu: { styleOverrides: { paper: { borderRadius: 12, ...GLASS_STRONG, boxShadow: "0 12px 32px rgba(16,24,60,.18)" } } },
    MuiMenuItem: { styleOverrides: { root: { borderRadius: 8, margin: "2px 6px", "&.Mui-selected": { backgroundColor: TOKENS.primarySoft } } } },
    MuiChip: { styleOverrides: { root: { borderRadius: 999, fontWeight: 500 } } },
    MuiTooltip: { styleOverrides: { tooltip: { backgroundColor: "#13213F", borderRadius: 8, fontSize: 12, padding: "6px 10px" }, arrow: { color: "#13213F" } } },
    MuiTabs: { styleOverrides: { indicator: { height: 3, borderRadius: 3, backgroundColor: TOKENS.accent } } },
    MuiTab: { styleOverrides: { root: { textTransform: "none", fontWeight: 600, minHeight: 44, color: TOKENS.muted, "&.Mui-selected": { color: TOKENS.accent } } } },
    MuiToggleButton: { styleOverrides: { root: { textTransform: "none", borderColor: TOKENS.border, "&.Mui-selected": { backgroundColor: TOKENS.primarySoft, color: TOKENS.primary, "&:hover": { backgroundColor: "#DCE6FF" } } } } },
    MuiLinearProgress: { styleOverrides: { root: { height: 3 } } },
    MuiTableContainer: { styleOverrides: { root: { borderRadius: 12 } } },
    // header stays nearly opaque: it is sticky, the scrolled rows must not show through it
    MuiTableHead: { styleOverrides: { root: { "& .MuiTableCell-root": { backgroundColor: TOKENS.primary, color: "#fff", fontWeight: 600, borderColor: "rgba(255,255,255,.18)" } } } },
    MuiTableRow: { styleOverrides: { root: { transition: "background-color .12s", "&.MuiTableRow-hover:hover": { backgroundColor: "rgba(21,82,240,.045)" } } } },
    MuiTableCell: { styleOverrides: { root: { borderColor: "#E8EEF9", fontFamily: FONT } } },
    MuiAlert: { styleOverrides: { root: { borderRadius: 12 } } },
    MuiTablePagination: { styleOverrides: { root: { color: TOKENS.muted }, selectLabel: { fontSize: 13 }, displayedRows: { fontSize: 13 } } },
    MuiPaginationItem: { styleOverrides: { root: { borderRadius: 8 } } },
    MuiSwitch: { styleOverrides: { root: { padding: 8 } } },
    MuiCircularProgress: { defaultProps: { thickness: 4 } },
  },
});

export default theme;
