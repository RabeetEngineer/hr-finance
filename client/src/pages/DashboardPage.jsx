import { useEffect, useMemo, useState } from "react";
import { Building2, Download, Printer, Tags, UserRoundCheck, Users } from "lucide-react";
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
  const designationCounts = dashboard?.charts?.designationCounts || [];
  const unitCounts = dashboard?.charts?.unitCounts || [];
  const upcomingRetirements = useMemo(
    () =>
      (dashboard?.upcomingRetirements || [])
        .map(retirementInfo)
        .filter(Boolean)
        .sort((a, b) => a.retirementDate - b.retirementDate),
    [dashboard]
  );

  const summary = [
    { label: "Total Employees", value: counts.totalEmployees || 0, icon: Users, sub: "Active incumbency rows" },
    { label: "Offices / Sections", value: counts.totalOrganizationUnits || 0, icon: Building2, sub: `${counts.topLevelUnits || 0} top level` },
    { label: "Designations", value: designationCounts.length || 0, icon: Tags, sub: "Top active designations" },
    { label: "Officers", value: counts.totalOfficers || 0, icon: UserRoundCheck, sub: `${counts.totalOfficials || 0} officials` },
  ];

  const exportDashboardData = () => {
    downloadCsv(
      "dashboard-summary.csv",
      ["Metric", "Value"],
      [
        ["Total Employees", counts.totalEmployees || 0],
        ["Offices / Sections", counts.totalOrganizationUnits || 0],
        ["Top Level Units", counts.topLevelUnits || 0],
        ["Officers", counts.totalOfficers || 0],
        ["Officials", counts.totalOfficials || 0],
        ["Vacant Seats", counts.vacantSeats || 0],
      ]
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

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="mb-3">
            <h3 className="text-base font-black">Top Designations</h3>
            <p className="text-xs text-muted-foreground">From dashboard aggregate report only.</p>
          </div>
          <div className="space-y-2">
            {designationCounts.length ? (
              designationCounts.map((row) => (
                <div key={row._id || row.name} className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-3 py-2">
                  <span className="text-sm font-bold">{row.name || "Unspecified"}</span>
                  <span className="rounded-md bg-white px-2 py-1 text-xs font-black">{row.count}</span>
                </div>
              ))
            ) : (
              <p className="rounded-lg border border-border bg-surface-2 p-4 text-sm text-muted-foreground">No designation summary available.</p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="mb-3">
            <h3 className="text-base font-black">Office / Section Counts</h3>
            <p className="text-xs text-muted-foreground">Top active offices and sections by employee count.</p>
          </div>
          <div className="space-y-2">
            {unitCounts.length ? (
              unitCounts.map((row) => (
                <div key={row._id || row.name} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2">
                  <span className="truncate text-sm font-bold">{row.name || row.code || "Unassigned"}</span>
                  <span className="rounded-md bg-white px-2 py-1 text-xs font-black">{row.count}</span>
                </div>
              ))
            ) : (
              <p className="rounded-lg border border-border bg-surface-2 p-4 text-sm text-muted-foreground">No office summary available.</p>
            )}
          </div>
        </section>
      </div>

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
