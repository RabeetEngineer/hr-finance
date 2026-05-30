import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { applyUiSettings } from "@/utils/applyUiSettings";

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
