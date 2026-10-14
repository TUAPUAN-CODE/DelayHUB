import { createTheme } from "@mui/material/styles";

/**
 * Design tokens shared by the whole app (same look as DocHUB): blue #1552F0, soft page background, rounded cards, Prompt font.
 * Keep the values in sync with the CSS variables in index.css.
 */
export const TOKENS = {
  primary: "#1552F0",
  primaryDark: "#0F3FC4",
  primarySoft: "#EAF0FF",
  bg: "#F1F4FB",
  surface: "#FFFFFF",
  text: "#1B2333",
  muted: "#6B7489",
  border: "#E3E8F2",
  success: "#16A34A",
  warning: "#F59E0B",
  danger: "#E5484D",
  radius: 12,
};

const FONT = "'Prompt', 'Noto Sans Thai', system-ui, sans-serif";

/**
 * Glassmorphism: translucent white surfaces + blur over the colourful page background (index.css body::before).
 * GLASS = cards / tables / panels, GLASS_STRONG = dialogs / menus (more opaque so the text stays easy to read on the floor).
 */
export const GLASS = {
  backgroundColor: "rgba(255,255,255,.58)",
  backdropFilter: "blur(18px) saturate(160%)",
  WebkitBackdropFilter: "blur(18px) saturate(160%)",
  border: "1px solid rgba(255,255,255,.65)",
  boxShadow: "0 8px 32px rgba(31,45,110,.12), inset 0 1px 0 rgba(255,255,255,.6)",
};
export const GLASS_STRONG = {
  ...GLASS,
  backgroundColor: "rgba(255,255,255,.80)",
  backdropFilter: "blur(24px) saturate(170%)",
  WebkitBackdropFilter: "blur(24px) saturate(170%)",
  boxShadow: "0 24px 60px rgba(16,24,60,.25), inset 0 1px 0 rgba(255,255,255,.7)",
};

const theme = createTheme({
  palette: {
    primary: { main: TOKENS.primary, dark: TOKENS.primaryDark, light: "#4D7BF5", contrastText: "#fff" },
    secondary: { main: "#64748B" },
    success: { main: TOKENS.success },
    warning: { main: TOKENS.warning },
    error: { main: TOKENS.danger },
    background: { default: "transparent", paper: "rgba(255,255,255,.72)" },
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
        root: { borderRadius: 10, padding: "6px 16px", transition: "background-color .15s, box-shadow .15s, transform .1s, border-color .15s", "&:active": { transform: "scale(.98)" } },
        containedPrimary: { "&:hover": { backgroundColor: TOKENS.primaryDark, boxShadow: "0 4px 12px rgba(21,82,240,.28)" } },
        outlinedPrimary: { borderColor: "rgba(21,82,240,.4)", "&:hover": { backgroundColor: TOKENS.primarySoft, borderColor: TOKENS.primary } },
        textPrimary: { "&:hover": { backgroundColor: TOKENS.primarySoft } },
        sizeSmall: { padding: "3px 10px", borderRadius: 8 },
      },
    },
    MuiIconButton: { styleOverrides: { root: { borderRadius: 10, transition: "background-color .15s, transform .1s", "&:active": { transform: "scale(.94)" } } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" }, rounded: { borderRadius: 14 }, outlined: { borderColor: "rgba(255,255,255,.65)" } } },
    MuiCard: { styleOverrides: { root: { borderRadius: 14, ...GLASS } } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 18, ...GLASS_STRONG } } },
    MuiPopover: { styleOverrides: { paper: { ...GLASS_STRONG, boxShadow: "0 12px 32px rgba(16,24,60,.18)" } } },
    MuiDrawer: { styleOverrides: { paper: { ...GLASS_STRONG } } },
    MuiAccordion: { styleOverrides: { root: { ...GLASS, "&:before": { display: "none" } } } },
    MuiAppBar: { styleOverrides: { root: { backgroundColor: "rgba(21,82,240,.82)", backdropFilter: "blur(16px) saturate(160%)", WebkitBackdropFilter: "blur(16px) saturate(160%)" } } },
    MuiDialogTitle: { styleOverrides: { root: { fontWeight: 600, fontSize: 18 } } },
    MuiDialogActions: { styleOverrides: { root: { padding: "12px 20px 16px", gap: 4 } } },
    MuiBackdrop: { styleOverrides: { root: { backgroundColor: "rgba(15,23,42,.30)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", "&.MuiBackdrop-invisible": { backgroundColor: "transparent", backdropFilter: "none", WebkitBackdropFilter: "none" } } } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10, backgroundColor: "rgba(255,255,255,.72)", transition: "box-shadow .15s, background-color .15s",
          "&.Mui-focused, &:hover": { backgroundColor: "rgba(255,255,255,.9)" },
          "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(120,140,190,.35)" },
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
    MuiChip: { styleOverrides: { root: { borderRadius: 8, fontWeight: 500 } } },
    MuiTooltip: { styleOverrides: { tooltip: { backgroundColor: "rgba(27,35,51,.86)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", borderRadius: 8, fontSize: 12, padding: "6px 10px" } } },
    MuiTabs: { styleOverrides: { indicator: { height: 3, borderRadius: 3 } } },
    MuiTab: { styleOverrides: { root: { textTransform: "none", fontWeight: 500, minHeight: 44 } } },
    MuiToggleButton: { styleOverrides: { root: { textTransform: "none", borderColor: TOKENS.border, "&.Mui-selected": { backgroundColor: TOKENS.primarySoft, color: TOKENS.primary, "&:hover": { backgroundColor: "#DCE6FF" } } } } },
    MuiLinearProgress: { styleOverrides: { root: { height: 3 } } },
    MuiTableContainer: { styleOverrides: { root: { borderRadius: 12 } } },
    // header stays nearly opaque: it is sticky, the scrolled rows must not show through it
    MuiTableHead: { styleOverrides: { root: { "& .MuiTableCell-root": { backgroundColor: "rgba(21,82,240,.88)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", color: "#fff", fontWeight: 600, borderColor: "rgba(255,255,255,.22)" } } } },
    MuiTableRow: { styleOverrides: { root: { transition: "background-color .12s", "&.MuiTableRow-hover:hover": { backgroundColor: "rgba(21,82,240,.045)" } } } },
    MuiTableCell: { styleOverrides: { root: { borderColor: "rgba(120,140,190,.22)", fontFamily: FONT } } },
    MuiAlert: { styleOverrides: { root: { borderRadius: 12, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" } } },
    MuiTablePagination: { styleOverrides: { root: { color: TOKENS.muted }, selectLabel: { fontSize: 13 }, displayedRows: { fontSize: 13 } } },
    MuiPaginationItem: { styleOverrides: { root: { borderRadius: 8 } } },
    MuiSwitch: { styleOverrides: { root: { padding: 8 } } },
    MuiCircularProgress: { defaultProps: { thickness: 4 } },
  },
});

export default theme;
