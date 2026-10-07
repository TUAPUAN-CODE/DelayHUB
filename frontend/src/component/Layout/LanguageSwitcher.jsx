import { useEffect, useState } from "react";
import { Select, MenuItem } from "@mui/material";
import { Languages } from "lucide-react";
import { LANGS, getLang, setLang, subscribe } from "../../i18n/translator";

const LanguageSwitcher = ({ sx }) => {
  const [lang, setLocal] = useState(getLang());
  useEffect(() => subscribe(setLocal), []);
  return (
    <Select
      size="small"
      value={lang}
      onChange={(e) => setLang(e.target.value)}
      data-no-i18n
      startAdornment={<Languages size={16} style={{ marginRight: 6 }} />}
      sx={{ minWidth: 118, height: 34, fontSize: 13, ...sx }}
      inputProps={{ "aria-label": "Language" }}
    >
      {LANGS.map((l) => (
        <MenuItem key={l.code} value={l.code} data-no-i18n>{l.label}</MenuItem>
      ))}
    </Select>
  );
};

export default LanguageSwitcher;
