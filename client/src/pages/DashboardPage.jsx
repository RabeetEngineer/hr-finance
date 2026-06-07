import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Check, ChevronDown, Download, ListChecks, Printer, Search, UserRoundCheck, Users, X } from "lucide-react";
import { reportService } from "@/services/reportService";
import { formatDate } from "@/utils/formatDate";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { subscribeResourceChanged } from "@/utils/resourceEvents";
import { toast } from "sonner";

const retirementInfo = (employee) => {
  if (!employee.dateOfBirth) return null;
  const dob = new Date(employee.dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const retirementDate = new Date(dob);
  retirementDate.setFullYear(retirementDate.getFullYear() + 60);
  return {
    ...employee,
    retirementDate,
    daysLeft: Math.ceil((retirementDate - new Date()) / 86400000),
  };
};

const downloadCsv = (filename, header, rows) => {
  const csv = [header, ...rows].map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const DashboardPage = () => {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showComposition, setShowComposition] = useState(true);
  const [compositionSearch, setCompositionSearch] = useState("");
  const [selectedCompositionIds, setSelectedCompositionIds] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const response = await reportService.dashboard();
      setDashboard(response.data.data);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load dashboard"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const unsubscribe = subscribeResourceChanged(({ resource }) => {
      if (["employees", "organization-units", "designations"].includes(resource)) load();
    });
    return unsubscribe;
  }, []);

  const counts = dashboard?.counts || {};
  const compositionRules = dashboard?.compositionRules || [];
  const upcomingRetirements = useMemo(
    () =>
      (dashboard?.upcomingRetirements || [])
        .map(retirementInfo)
        .filter(Boolean)
        .sort((a, b) => a.retirementDate - b.retirementDate),
    [dashboard]
  );

  const summary = [
    { label: "Total Current Staff", value: counts.totalCurrentStaff ?? counts.totalEmployees ?? 0, icon: Users, sub: "Active plus vacant rows" },
    { label: "Total Vacant Seats", value: counts.totalVacantSeats ?? counts.vacantSeats ?? 0, icon: Building2, sub: "Incumbency Action = Vacant" },
    { label: "Total Active", value: counts.totalActiveInFinance ?? 0, icon: UserRoundCheck, sub: "Currently posted officers/officials" },
  ];

  const exportDashboardData = () => {
    downloadCsv(
      "dashboard-summary.csv",
      ["Metric", "Value"],
      [
        ["Total Current Staff", counts.totalCurrentStaff || counts.totalEmployees || 0],
        ["Total Vacant Seats", counts.totalVacantSeats ?? counts.vacantSeats ?? 0],
        ["Total Active", counts.totalActiveInFinance || 0],
      ]
    );
  };

  const badgeClass = (status) => {
    const key = String(status || "").toLowerCase();
    if (key === "ok" || key === "both present") return "border-emerald-500/20 bg-emerald-50 text-emerald-700";
    if (key === "missing") return "border-orange-500/20 bg-orange-50 text-orange-700";
    if (key === "excess") return "border-rose-500/20 bg-rose-50 text-rose-700";
    return "border-slate-500/20 bg-slate-100 text-slate-700";
  };

  const compositionOptions = useMemo(() => {
    const needle = compositionSearch.trim().toLowerCase();
    return compositionRules.filter((section) => {
      if (!needle) return true;
      return `${section.section} ${(section.designationBreakdown || []).map((item) => item.designation).join(" ")}`.toLowerCase().includes(needle);
    });
  }, [compositionRules, compositionSearch]);

  const selectedCompositionCards = useMemo(() => {
    const selected = new Set(selectedCompositionIds);
    return compositionRules.filter((section) => selected.has(section.sectionId));
  }, [compositionRules, selectedCompositionIds]);

  const removeCompositionCard = (sectionId) => {
    setSelectedCompositionIds((current) => current.filter((id) => id !== sectionId));
  };

  const toggleCompositionCard = (sectionId) => {
    if (!sectionId) return;
    setSelectedCompositionIds((current) =>
      current.includes(sectionId) ? current.filter((id) => id !== sectionId) : [...current, sectionId]
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface px-4 py-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-accent">Punjab Finance HR</p>
          <h1 className="mt-1 text-2xl font-black text-foreground">Dashboard</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/lists" className="btn-secondary px-3 py-2 text-xs">
            <ListChecks className="h-4 w-4" />
            Open Lists
          </Link>
          <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print
          </button>
          <button type="button" className="btn-primary px-3 py-2 text-xs" onClick={exportDashboardData}>
            <Download className="h-4 w-4" />
            Export Summary
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {summary.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-lg border border-border bg-surface p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-muted-foreground">{item.label}</p>
                  <p className="mt-3 text-3xl font-black">{loading ? "..." : item.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.sub}</p>
                </div>
                <div className="rounded-lg bg-surface-2 p-2 text-accent">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-black">Staff Composition</h3>
            <p className="text-xs text-muted-foreground">Select offices or sections to compare designation-wise staff position.</p>
          </div>
          <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={() => setShowComposition((value) => !value)}>
            <ChevronDown className={showComposition ? "h-4 w-4 rotate-180 transition" : "h-4 w-4 transition"} />
            Show / Hide
          </button>
        </div>
        {showComposition ? (
          <>
            <div className="mt-4 grid gap-2 lg:grid-cols-[minmax(240px,0.75fr)_minmax(320px,1.25fr)_auto_auto]">
              <label className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input className="w-full bg-transparent text-sm outline-none" value={compositionSearch} onChange={(event) => setCompositionSearch(event.target.value)} placeholder="Search office / section..." />
              </label>
              <div className="max-h-72 overflow-auto rounded-lg border border-border bg-white p-2">
                {compositionOptions.length ? (
                  compositionOptions.map((section) => {
                    const selected = selectedCompositionIds.includes(section.sectionId);
                    return (
                      <button
                        key={section.sectionId}
                        type="button"
                        className={selected ? "mb-1 flex w-full items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-left text-sm font-bold text-primary" : "mb-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold text-foreground hover:bg-muted"}
                        onClick={() => toggleCompositionCard(section.sectionId)}
                      >
                        <span className={selected ? "flex h-5 w-5 shrink-0 items-center justify-center rounded border border-primary bg-primary text-primary-foreground" : "flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border bg-white"}>
                          {selected ? <Check className="h-3.5 w-3.5" /> : null}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{section.section}</span>
                        <span className="rounded-md bg-surface-2 px-2 py-1 text-xs font-black text-foreground">{section.totalStaff || 0}</span>
                      </button>
                    );
                  })
                ) : (
                  <p className="px-3 py-4 text-center text-sm font-semibold text-muted-foreground">No matching office / section.</p>
                )}
              </div>
              <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={() => setSelectedCompositionIds(compositionOptions.map((section) => section.sectionId))}>
                Select Filtered
              </button>
              <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={() => setSelectedCompositionIds([])}>
                Clear
              </button>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {selectedCompositionCards.length ? (
                selectedCompositionCards.map((section) => (
                  <div key={section.sectionId} className={section.skipped ? "rounded-lg border border-sky-200 bg-sky-50/70 p-3" : "rounded-lg border border-emerald-200/70 bg-emerald-50/40 p-3"}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-black">{section.section}</h4>
                        <p className="text-xs text-muted-foreground">Total Staff: {section.totalStaff || 0}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" className="icon-action" title="Remove card" onClick={() => removeCompositionCard(section.sectionId)}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {(section.designationBreakdown || []).length ? (
                        section.designationBreakdown.map((item) => (
                          <div key={item.designation} className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2">
                            <span className="min-w-0 truncate text-xs font-bold text-foreground">{item.designation}</span>
                            <span className="rounded-md bg-surface-2 px-2 py-1 text-xs font-black">{item.count}</span>
                          </div>
                        ))
                      ) : (
                        <p className="rounded-md bg-white px-3 py-3 text-xs font-semibold text-muted-foreground sm:col-span-2">No current staff rows in this office / section.</p>
                      )}
                    </div>

                    {!section.skipped ? <div className="mt-3 flex flex-wrap gap-2">
                      {(section.rules || []).map((rule) => (
                        <span key={rule.cadre} className={`rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.1em] ${badgeClass(rule.status)}`}>
                          {rule.cadre}: {rule.status}{rule.detail ? ` (${rule.detail})` : ""}
                        </span>
                      ))}
                    </div> : null}
                  </div>
                ))
              ) : (
                <p className="rounded-lg border border-border bg-surface-2 p-4 text-sm text-muted-foreground lg:col-span-2">Select one or more offices / sections to display composition cards.</p>
              )}
            </div>
          </>
        ) : null}
      </section>

      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <div className="mb-3">
          <h3 className="text-base font-black">Upcoming Retirements</h3>
          <p className="text-xs text-muted-foreground">Loaded from dashboard aggregate endpoint.</p>
        </div>
        <div className="overflow-auto">
          <table className="incumbency-table w-full min-w-[720px] border-collapse text-xs">
            <thead>
              <tr>
                <th>Name</th>
                <th>Personnel No.</th>
                <th>DOB</th>
                <th>Retirement Date</th>
                <th>Days Left</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {upcomingRetirements.length ? (
                upcomingRetirements.map((employee) => (
                  <tr key={employee._id || employee.id}>
                    <td className="font-bold">{employee.fullName}</td>
                    <td>{employee.personnelNumber || "-"}</td>
                    <td>{formatDate(employee.dateOfBirth)}</td>
                    <td>{formatDate(employee.retirementDate)}</td>
                    <td>{employee.daysLeft}</td>
                    <td className="capitalize">{employee.employmentStatus || "-"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted-foreground">
                    No upcoming retirement records available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default DashboardPage;
