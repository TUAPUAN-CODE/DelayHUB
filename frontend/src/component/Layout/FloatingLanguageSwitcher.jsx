import LanguageSwitcher from "./LanguageSwitcher";

// language switcher for pages without the shared Header (login, signup, workplace selection)
const FloatingLanguageSwitcher = () => (
  <div style={{ position: "fixed", top: 12, right: 12, zIndex: 1300 }}>
    <LanguageSwitcher sx={{ background: "#fff" }} />
  </div>
);

export default FloatingLanguageSwitcher;
