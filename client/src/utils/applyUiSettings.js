export const applyUiSettings = () => {
  const saved = JSON.parse(localStorage.getItem("hrf_ui_settings") || "{}");
  const root = document.documentElement;
  root.style.setProperty("--app-font-size", `${saved.fontSize || 14}px`);
  root.style.setProperty("--app-heading-weight", saved.headingWeight || 800);
  root.style.setProperty("--app-table-font-size", `${saved.tableFontSize || 12}px`);
  root.style.setProperty("--app-print-font-size", `${saved.printFontSize || 12}px`);
  root.style.setProperty("--primary", saved.primaryColor || "151 69% 19%");
  root.style.setProperty("--accent", saved.accentColor || "142 68% 29%");
  root.dataset.fontFamily = "inter";
  root.dataset.density = saved.density || "compact";
};
