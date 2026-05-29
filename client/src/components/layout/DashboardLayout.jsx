import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

const applyUiSettings = () => {
  const saved = JSON.parse(localStorage.getItem("hrf_ui_settings") || "{}");
  const root = document.documentElement;
  root.style.setProperty("--app-font-size", `${saved.fontSize || 14}px`);
  root.style.setProperty("--app-heading-weight", saved.headingWeight || 800);
  root.style.setProperty("--app-table-font-size", `${saved.tableFontSize || 12}px`);
  root.style.setProperty("--app-print-font-size", `${saved.printFontSize || 12}px`);
  root.style.setProperty("--primary", saved.primaryColor || "151 69% 19%");
  root.style.setProperty("--accent", saved.accentColor || "142 68% 29%");
  root.dataset.fontFamily = saved.fontFamily || "manrope";
  root.dataset.density = saved.density || "compact";
};

const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    applyUiSettings();
    window.addEventListener("hrf-ui-settings-changed", applyUiSettings);
    return () => window.removeEventListener("hrf-ui-settings-changed", applyUiSettings);
  }, []);

  return (
    <div className="min-h-screen bg-grid-fade">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="md:pl-60">
        <Topbar onMenuToggle={() => setSidebarOpen((value) => !value)} />
        <main className="px-2 pb-5 pt-2 md:px-3 md:pt-2 lg:px-4">
          <div className="mx-auto max-w-[1800px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
