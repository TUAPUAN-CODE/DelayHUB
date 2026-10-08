import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider, CssBaseline } from "@mui/material";
import theme from "/src/theme/dochubTheme";
import "/src/index.css";
import AppPrep from "/src/component/Prep/AppPrep";
const role = location.hash.slice(1) || "prep";
const path = { prep: "/prep/Sheet", pack: "/packaging/Sheet" }[role];
localStorage.setItem("rm_type_id", "[1]"); localStorage.setItem("pos_id", "3"); localStorage.setItem("first_name", "ทดสอบ"); localStorage.setItem("last_name", "ระบบ");
createRoot(document.getElementById("root")).render(
  <ThemeProvider theme={theme}><MemoryRouter initialEntries={[path]}><Routes><Route path="/prep/*" element={<AppPrep />} />
  </Routes></MemoryRouter></ThemeProvider>);
