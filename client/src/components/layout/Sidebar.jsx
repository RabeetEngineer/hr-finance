import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import {
  GitBranch,
  Import,
  LayoutDashboard,
  LogOut,
  Settings,
  Tags,
  ShieldCheck,
  Users,
  UserRound,
  UserX,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/utils/cn";

const navigation = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/employees", label: "Incumbency Sheet", icon: Users },
  { to: "/structure", label: "Offices / Sections", icon: GitBranch },
  { to: "/designations", label: "Designations", icon: Tags, roles: ["super_admin", "admin"] },
  { to: "/import", label: "Import Data", icon: Import, roles: ["super_admin", "admin"] },
  { to: "/old-employees", label: "Old Employees", icon: UserX },
  { to: "/users-roles", label: "Users & Roles", icon: ShieldCheck, roles: ["super_admin"] },
  { to: "/settings", label: "Settings", icon: Settings, roles: ["super_admin", "admin"] },
];

const Sidebar = ({ open, onClose }) => {
  const { user, logout } = useAuth();
  const visibleNavigation = navigation.filter((item) => !item.roles || item.roles.includes(user?.role));

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm transition md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-border bg-surface/95 shadow-soft backdrop-blur-xl transition-transform duration-300 md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Punjab Finance</p>
            <h1 className="mt-1 text-lg font-bold text-foreground">HR Incumbency</h1>
          </div>
          <button
            type="button"
            className="rounded-2xl border border-border p-2 text-foreground md:hidden"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-3 border-b border-border px-4 py-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <UserRound className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{user?.fullName || "Guest User"}</p>
            <p className="text-xs text-muted-foreground capitalize">{user?.role?.replaceAll("_", " ") || "viewer"}</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-1">
            {visibleNavigation.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-glow"
                        : "text-foreground/75 hover:bg-muted hover:text-foreground"
                    )
                  }
                  onClick={onClose}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-border p-4">
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-muted"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
