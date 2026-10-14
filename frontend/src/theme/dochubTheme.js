import { createTheme } from "@mui/material/styles";

/**
 * Design tokens of the whole app: dark "smoked glass" (glassmorphism) — translucent dark surfaces + blur over a dark gradient
 * background, white text, orange accent. Keep the values in sync with the CSS variables in index.css.
 */
export const TOKENS = {
  primary: "#FF8A3D",
  primaryDark: "#F26B1D",
  primarySoft: "rgba(255,138,61,.16)",
  bg: "#0F1218",
  surface: "rgba(255,255,255,.07)",
  text: "#F1F4FA",
  muted: "rgba(241,244,250,.62)",
  border: "rgba(255,255,255,.14)",
  success: "#34D399",
  warning: "#FBBF24",
  danger: "#F87171",
  radius: 14,
};

const FONT = "'Prompt', 'Noto Sans Thai', system-ui, sans-serif";

/** GLASS = cards / tables / panels, GLASS_STRONG = dialogs / menus (darker, so the text on top stays easy to read on the floor) */
export const GLASS = {
  backgroundColor: "rgba(255,255,255,.07)",
  backdropFilter: "blur(20px) saturate(140%)",
  WebkitBackdropFilter: "blur(20px) saturate(140%)",
  border: "1px solid rgba(255,255,255,.14)",
  boxShadow: "0 10px 40px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.10)",
};
export const GLASS_STRONG = {
  ...GLASS,
  backgroundColor: "rgba(30,33,42,.78)",
  backdropFilter: "blur(28px) saturate(150%)",
  WebkitBackdropFilter: "blur(28px) saturate(150%)",
  boxShadow: "0 30px 80px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.10)",
};

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: TOKENS.primary, dark: TOKENS.primaryDark, light: "#FFB27A", contrastText: "#1A1206" },
    secondary: { main: "#A5B4CF" },
    success: { main: TOKENS.success, contrastText: "#06281A" },
    warning: { main: TOKENS.warning, contrastText: "#2A1D02" },
    error: { main: TOKENS.danger, contrastText: "#2B0A0A" },
    info: { main: "#7EA6FF" },
    background: { default: "transparent", paper: "rgba(30,33,42,.72)" },
    text: { primary: TOKENS.text, secondary: TOKENS.muted, disabled: "rgba(241,244,250,.38)" },
    divider: TOKENS.border,
    action: { hover: "rgba(255,255,255,.08)", selected: "rgba(255,138,61,.16)", disabledBackground: "rgba(255,255,255,.08)", disabled: "rgba(241,244,250,.35)" },
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
        root: { borderRadius: 999, padding: "6px 16px", transition: "background-color .15s, box-shadow .15s, transform .1s, border-color .15s", "&:active": { transform: "scale(.98)" } },
        containedPrimary: { color: "#fff", background: "linear-gradient(135deg, #FF9A4D, #F26B1D)", "&:hover": { background: "linear-gradient(135deg, #FFA862, #E55F12)", boxShadow: "0 6px 18px rgba(255,122,40,.35)" } },
        outlined: { borderColor: "rgba(255,255,255,.28)", color: TOKENS.text, backgroundColor: "rgba(255,255,255,.04)", "&:hover": { borderColor: "rgba(255,255,255,.5)", backgroundColor: "rgba(255,255,255,.10)" } },
        outlinedPrimary: { borderColor: "rgba(255,138,61,.55)", color: "#FFB27A", "&:hover": { backgroundColor: TOKENS.primarySoft, borderColor: TOKENS.primary } },
        text: { color: TOKENS.text, "&:hover": { backgroundColor: "rgba(255,255,255,.08)" } },
        textPrimary: { color: "#FFB27A", "&:hover": { backgroundColor: TOKENS.primarySoft } },
        sizeSmall: { padding: "3px 12px" },
        // disabled must look disabled (the gradient of containedPrimary would otherwise stay orange)
        contained: { "&.Mui-disabled": { background: "rgba(255,255,255,.08)", color: "rgba(241,244,250,.35)", boxShadow: "none" } },
      },
    },
    MuiIconButton: { styleOverrides: { root: { borderRadius: 12, color: TOKENS.text, transition: "background-color .15s, transform .1s", "&:hover": { backgroundColor: "rgba(255,255,255,.10)" }, "&:active": { transform: "scale(.94)" } } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" }, rounded: { borderRadius: 16 }, outlined: { borderColor: TOKENS.border } } },
    MuiCard: { styleOverrides: { root: { borderRadius: 18, ...GLASS } } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 22, ...GLASS_STRONG } } },
    MuiPopover: { styleOverrides: { paper: { ...GLASS_STRONG, boxShadow: "0 16px 40px rgba(0,0,0,.5)" } } },
    MuiDrawer: { styleOverrides: { paper: { ...GLASS_STRONG } } },
    MuiAccordion: { styleOverrides: { root: { ...GLASS, "&:before": { display: "none" } } } },
    MuiAppBar: { styleOverrides: { root: { backgroundColor: "rgba(20,23,30,.6)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" } } },
    MuiDialogTitle: { styleOverrides: { root: { fontWeight: 600, fontSize: 18 } } },
    MuiDialogActions: { styleOverrides: { root: { padding: "12px 20px 16px", gap: 4 } } },
    MuiBackdrop: { styleOverrides: { root: { backgroundColor: "rgba(5,7,12,.45)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", "&.MuiBackdrop-invisible": { backgroundColor: "transparent", backdropFilter: "none", WebkitBackdropFilter: "none" } } } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 12, backgroundColor: "rgba(255,255,255,.06)", transition: "box-shadow .15s, background-color .15s",
          "&:hover": { backgroundColor: "rgba(255,255,255,.09)" },
          "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,.18)" },
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,.35)" },
          "&.Mui-focused": { boxShadow: "0 0 0 3px rgba(255,138,61,.22)" },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: TOKENS.primary, borderWidth: 1 },
        },
      },
    },
    MuiInputLabel: { styleOverrides: { root: { color: TOKENS.muted, "&.Mui-focused": { color: "#FFB27A" } } } },
    MuiSelect: { styleOverrides: { select: { borderRadius: 12 } } },
    MuiMenu: { styleOverrides: { paper: { borderRadius: 14, ...GLASS_STRONG, boxShadow: "0 16px 40px rgba(0,0,0,.5)" } } },
    MuiMenuItem: { styleOverrides: { root: { borderRadius: 8, margin: "2px 6px", "&.Mui-selected": { backgroundColor: TOKENS.primarySoft } } } },
    MuiChip: { styleOverrides: { root: { borderRadius: 999, fontWeight: 500 } } },
    MuiTooltip: { styleOverrides: { tooltip: { backgroundColor: "rgba(20,23,30,.9)", border: "1px solid rgba(255,255,255,.12)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 10, fontSize: 12, padding: "6px 10px" } } },
    MuiTabs: { styleOverrides: { indicator: { height: 3, borderRadius: 3 } } },
    MuiTab: { styleOverrides: { root: { textTransform: "none", fontWeight: 500, minHeight: 44, color: TOKENS.muted, "&.Mui-selected": { color: "#FFB27A" } } } },
    MuiToggleButton: { styleOverrides: { root: { textTransform: "none", borderColor: TOKENS.border, color: TOKENS.muted, "&.Mui-selected": { backgroundColor: TOKENS.primarySoft, color: "#FFB27A", "&:hover": { backgroundColor: "rgba(255,138,61,.24)" } } } } },
    MuiAlert: { styleOverrides: { root: { borderRadius: 14, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" } } },
    MuiLinearProgress: { styleOverrides: { root: { height: 3 } } },
    MuiTableContainer: { styleOverrides: { root: { borderRadius: 14 } } },
    // header stays nearly opaque: it is sticky, the scrolled rows must not show through it
    MuiTableHead: { styleOverrides: { root: { "& .MuiTableCell-root": { backgroundColor: "rgba(32,36,46,.92)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", color: "#fff", fontWeight: 600, borderColor: "rgba(255,255,255,.12)" } } } },
    MuiTableRow: { styleOverrides: { root: { transition: "background-color .12s", "&.MuiTableRow-hover:hover": { backgroundColor: "rgba(255,255,255,.06)" } } } },
    MuiTableCell: { styleOverrides: { root: { borderColor: "rgba(255,255,255,.08)", fontFamily: FONT } } },
    MuiTablePagination: { styleOverrides: { root: { color: TOKENS.muted }, selectLabel: { fontSize: 13 }, displayedRows: { fontSize: 13 } } },
    MuiPaginationItem: { styleOverrides: { root: { borderRadius: 8 } } },
    MuiSwitch: { styleOverrides: { root: { padding: 8 } } },
    MuiCircularProgress: { defaultProps: { thickness: 4 } },
  },
});

export default theme;
