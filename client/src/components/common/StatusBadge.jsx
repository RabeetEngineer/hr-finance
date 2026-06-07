import { cn } from "@/utils/cn";

const toneMap = {
  active: "bg-emerald-500/12 text-emerald-700 border-emerald-500/20",
  transferred: "bg-sky-500/12 text-sky-700 border-sky-500/20",
  retired: "bg-slate-500/12 text-slate-700 border-slate-500/20",
  deceased: "bg-rose-500/12 text-rose-700 border-rose-500/20",
  resigned: "bg-amber-500/12 text-amber-700 border-amber-500/20",
  suspended: "bg-orange-500/12 text-orange-700 border-orange-500/20",
  on_leave: "bg-violet-500/12 text-violet-700 border-violet-500/20",
  occupied: "bg-emerald-500/12 text-emerald-700 border-emerald-500/20",
  vacant: "bg-slate-500/12 text-slate-700 border-slate-500/20",
  additional_charge: "bg-amber-500/12 text-amber-700 border-amber-500/20",
  frozen: "bg-cyan-500/12 text-cyan-700 border-cyan-500/20",
  pending: "bg-amber-500/12 text-amber-700 border-amber-500/20",
  approved: "bg-emerald-500/12 text-emerald-700 border-emerald-500/20",
  rejected: "bg-rose-500/12 text-rose-700 border-rose-500/20",
  officer: "bg-sky-500/12 text-sky-700 border-sky-500/20",
  official: "bg-emerald-500/12 text-emerald-700 border-emerald-500/20",
  support_staff: "bg-amber-500/12 text-amber-700 border-amber-500/20",
  true: "bg-emerald-500/12 text-emerald-700 border-emerald-500/20",
  false: "bg-slate-500/12 text-slate-700 border-slate-500/20",
};

const labelMap = {
  active: "Active",
  on_leave: "On Leave",
  additional_charge: "Additional Charge",
  support_staff: "Support Staff",
  true: "Active",
  false: "Inactive",
};

const StatusBadge = ({ value, className = "" }) => {
  const key = String(value ?? "").toLowerCase();
  const tone = toneMap[key] || "bg-slate-500/12 text-slate-700 border-slate-500/20";
  const label = labelMap[key] || key.replaceAll("_", " ") || "-";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]",
        tone,
        className
      )}
    >
      {label}
    </span>
  );
};

export default StatusBadge;
