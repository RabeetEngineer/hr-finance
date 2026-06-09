import { useMemo } from "react";
import { CheckCircle2 } from "lucide-react";
import { formatDateTime } from "@/utils/formatDate";

const dayStart = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const groupLabel = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Older";
  const today = dayStart(new Date());
  const target = dayStart(date);
  if (target === today) return "Today";
  if (target === today - 86400000) return "Yesterday";
  return "Older";
};

const shortSummary = (log) =>
  String(log?.summary || `${log?.entityType || "Record"} ${log?.action || "updated"}`)
    .replace(/^Created employee /i, "Added ")
    .replace(/^Updated employee /i, "Edited ")
    .replace(/^Deleted employee /i, "Deleted ")
    .replace(/^Updated organization unit /i, "Updated section ")
    .replace(/^Created organization unit /i, "Added section ")
    .replace(/^Deleted organization unit /i, "Deleted section ");

const ActivityTimeline = ({ logs = [], loading = false, compact = false }) => {
  const groups = useMemo(() => {
    const next = new Map([
      ["Today", []],
      ["Yesterday", []],
      ["Older", []],
    ]);
    logs.forEach((log) => {
      const label = groupLabel(log.createdAt);
      next.get(label).push(log);
    });
    return [...next.entries()].filter(([, rows]) => rows.length);
  }, [logs]);

  return (
    <aside className={compact ? "rounded-lg border border-border bg-surface p-3" : "rounded-lg border border-border bg-surface p-4 shadow-sm"}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black">Activity Timeline</h3>
          <p className="text-xs text-muted-foreground">Recent system changes</p>
        </div>
      </div>
      <div className="mt-3 max-h-[28rem] space-y-4 overflow-auto pr-1">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-9 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : groups.length ? (
          groups.map(([label, rows]) => (
            <div key={label}>
              <p className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
              <div className="space-y-2">
                {rows.map((log) => (
                  <div key={log.id} className="flex gap-2 rounded-md bg-surface-2 px-2.5 py-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-foreground">{shortSummary(log)}</p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {log.actorUser?.fullName || "System"} - {formatDateTime(log.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-md border border-dashed border-border p-4 text-center text-xs font-semibold text-muted-foreground">
            No recent activity yet.
          </div>
        )}
      </div>
    </aside>
  );
};

export default ActivityTimeline;
