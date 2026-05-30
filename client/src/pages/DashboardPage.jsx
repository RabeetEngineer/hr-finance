import { useEffect, useMemo, useState } from "react";
import { Download, Printer, Search, Users, Building2, Tags } from "lucide-react";
import { employeeService } from "@/services/employeeService";
import { designationService } from "@/services/designationService";
import { reportService } from "@/services/reportService";
import { formatDate } from "@/utils/formatDate";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { subscribeResourceChanged } from "@/utils/resourceEvents";
import { toast } from "sonner";

const compactUnitName = (unit) => {
  const name = unit?.name || unit?.code || unit?.path || "Unassigned";
  return String(name).replace(/\s+/g, " ").trim();
};

const fetchAllEmployees = async () => {
  const first = await employeeService.list({ page: 1, limit: 200, sort: "hierarchy", status: "active" });
  const rows = [...(first.data.data || [])];
  const pages = Number(first.data.meta?.pages || 1);
  for (let page = 2; page <= pages; page += 1) {
    const response = await employeeService.list({ page, limit: 200, sort: "hierarchy", status: "active" });
    rows.push(...(response.data.data || []));
  }
  return rows;
};

const retirementInfo = (employee) => {
  if (!employee.dateOfBirth) return null;
  const dob = new Date(employee.dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const retirementDate = new Date(dob);
  retirementDate.setFullYear(retirementDate.getFullYear() + 60);
  const today = new Date();
  const daysLeft = Math.ceil((retirementDate - today) / 86400000);
  return {
    ...employee,
    retirementDate,
    daysLeft,
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
  const [employees, setEmployees] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summarySearch, setSummarySearch] = useState("");
  const [showAllSummaryRows, setShowAllSummaryRows] = useState(false);
  const [selectedSummaryDesignations, setSelectedSummaryDesignations] = useState(() => {
    const saved = localStorage.getItem("hrf_summary_designations");
    return saved ? JSON.parse(saved) : null;
  });

  const load = async () => {
    setLoading(true);
    try {
      const [dashboardResponse, employeeRows, designationResponse] = await Promise.all([
        reportService.dashboard(),
        fetchAllEmployees(),
        designationService.list({ limit: 200, isActive: "true", sort: "sortOrder name" }),
      ]);
      setDashboard(dashboardResponse.data.data);
      setEmployees(employeeRows);
      setDesignations(designationResponse.data.data || []);
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
  const designationNames = useMemo(() => [...new Set(employees.map((employee) => employee.designation?.name).filter(Boolean))].sort(), [employees]);
  const summaryDesignationNames = selectedSummaryDesignations === null ? designationNames : selectedSummaryDesignations.filter((name) => designationNames.includes(name));
  const selectedDesignationMeta = useMemo(
    () => new Map(designations.map((designation) => [designation.name, designation])),
    [designations]
  );

  const officeDesignationSummary = useMemo(() => {
    const map = new Map();
    employees.forEach((employee, index) => {
      const office = compactUnitName(employee.currentOfficeSection);
      const designation = employee.designation?.name || "Unspecified";
      if (!summaryDesignationNames.includes(designation)) return;
      if (!map.has(office)) map.set(office, { office, total: 0, counts: {}, firstIndex: index });
      const group = map.get(office);
      group.total += 1;
      group.counts[designation] = (group.counts[designation] || 0) + 1;
    });
    return [...map.values()].sort((a, b) => a.firstIndex - b.firstIndex);
  }, [employees, summaryDesignationNames]);
  const visibleOfficeDesignationSummary = useMemo(() => {
    const needle = summarySearch.trim().toLowerCase();
    const rows = needle ? officeDesignationSummary.filter((row) => row.office.toLowerCase().includes(needle)) : officeDesignationSummary;
    return showAllSummaryRows ? rows : rows.slice(0, 10);
  }, [officeDesignationSummary, showAllSummaryRows, summarySearch]);

  const designationStrengthSummary = useMemo(
    () =>
      summaryDesignationNames.map((name) => {
        const filled = employees.filter((employee) => employee.designation?.name === name).length;
        const totalStrength = Number(selectedDesignationMeta.get(name)?.totalStrength || 0);
        return {
          name,
          filled,
          totalStrength,
          remaining: totalStrength ? Math.max(totalStrength - filled, 0) : null,
        };
      }),
    [employees, selectedDesignationMeta, summaryDesignationNames]
  );

  const upcomingRetirements = useMemo(
    () =>
      employees
        .map(retirementInfo)
        .filter((employee) => employee && employee.daysLeft >= 0 && employee.daysLeft <= 365)
        .sort((a, b) => a.retirementDate - b.retirementDate),
    [employees]
  );

  const filteredEmployees = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return employees.slice(0, 10);
    return employees
      .filter((employee) =>
        [employee.fullName, employee.designation?.name, compactUnitName(employee.currentOfficeSection), employee.personnelNumber, employee.cnic]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(needle)
      )
      .slice(0, 25);
  }, [employees, query]);

  const summary = [
    { label: "Total Employees", value: counts.totalEmployees || employees.length, icon: Users, sub: "Active incumbency rows" },
    { label: "Offices / Sections", value: counts.totalOrganizationUnits || officeDesignationSummary.length, icon: Building2, sub: "Structure nodes" },
    { label: "Designations", value: designationNames.length, icon: Tags, sub: `${summaryDesignationNames.length} selected for summary` },
  ];

  const saveSummarySelection = () => {
    localStorage.setItem("hrf_summary_designations", JSON.stringify(summaryDesignationNames));
    toast.success("Summary selection locked");
  };

  const toggleSummaryDesignation = (name) => {
    setSelectedSummaryDesignations((current) => {
      const base = current === null ? designationNames : current;
      return base.includes(name) ? base.filter((item) => item !== name) : [...base, name];
    });
  };

  const exportDashboardData = () => {
    downloadCsv(
      "dashboard-employees.csv",
      ["Name", "Personnel No.", "Designation", "Office / Section", "Cell", "Joining"],
      filteredEmployees.map((employee) => [
        employee.fullName || "",
        employee.personnelNumber || "",
        employee.designation?.name || "",
        compactUnitName(employee.currentOfficeSection),
        employee.mobileNumber || "",
        formatDate(employee.dateOfJoiningCurrentDepartment || employee.dateOfJoiningGovernmentService),
      ])
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface px-4 py-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-accent">Punjab Finance HR</p>
          <h1 className="mt-1 text-2xl font-black italic text-foreground">Dashboard</h1>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="flex min-w-[260px] items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input className="w-full bg-transparent outline-none" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Quick search..." />
          </label>
          <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print
          </button>
          <button type="button" className="btn-primary px-3 py-2 text-xs" onClick={exportDashboardData}>
            <Download className="h-4 w-4" />
            Export Data
          </button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-black">Office / Section Designation Summary</h3>
            <p className="text-xs text-muted-foreground">Compact summary. Search office/section or open full list only when needed.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={() => setSummaryOpen((value) => !value)}>
              {summaryDesignationNames.length ? `${summaryDesignationNames.length} designations selected` : "No designations selected"}
            </button>
            <button
              type="button"
              className="btn-secondary px-3 py-2 text-xs"
              onClick={() =>
                downloadCsv(
                  "office-designation-summary.csv",
                  ["Office / Section", "Total", ...summaryDesignationNames],
                  officeDesignationSummary.map((row) => [row.office, row.total, ...summaryDesignationNames.map((designation) => row.counts[designation] || 0)])
                )
              }
            >
              <Download className="h-4 w-4" />
              Export Summary
            </button>
          </div>
        </div>
        <div className="mb-3 grid gap-2 lg:grid-cols-[minmax(260px,1fr)_auto]">
          <label className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input className="w-full bg-transparent outline-none" value={summarySearch} onChange={(event) => setSummarySearch(event.target.value)} placeholder="Search office / section summary..." />
          </label>
          <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={() => setShowAllSummaryRows((value) => !value)}>
            {showAllSummaryRows ? "Show first 10" : `Show all ${officeDesignationSummary.length}`}
          </button>
        </div>
        {summaryOpen ? (
          <div className="mb-3 rounded-lg border border-border bg-surface-2 p-3">
            <div className="mb-2 flex flex-wrap gap-2">
              <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={() => setSelectedSummaryDesignations(designationNames)}>
                Select all
              </button>
              <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={() => setSelectedSummaryDesignations([])}>
                Unselect all
              </button>
              <button type="button" className="btn-primary px-3 py-2 text-xs" onClick={saveSummarySelection}>
                Lock default
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {designationNames.map((name) => (
                <label key={name} className="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm">
                  <input type="checkbox" checked={summaryDesignationNames.includes(name)} onChange={() => toggleSummaryDesignation(name)} />
                  <span className="truncate">{name}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {designationStrengthSummary.slice(0, 8).map((row) => (
            <div key={row.name} className="rounded-lg border border-border bg-surface-2 p-3">
              <p className="truncate text-sm font-black text-foreground">{row.name}</p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">Filled</p>
                  <p className="text-2xl font-black">{row.filled}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">Total Strength</p>
                  <p className="text-lg font-black text-primary">{row.totalStrength || "Open"}</p>
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${row.totalStrength ? Math.min((row.filled / row.totalStrength) * 100, 100) : 100}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {row.remaining === null ? "No strength limit set" : `${row.remaining} remaining`}
              </p>
            </div>
          ))}
        </div>
        <div className="max-h-[520px] overflow-auto rounded-lg border border-border bg-white shadow-inner">
          <table className="incumbency-table summary-matrix w-full min-w-[980px] border-separate border-spacing-0 text-xs">
            <thead>
              <tr>
                <th>Office / Section</th>
                <th>Total</th>
                {summaryDesignationNames.map((designation) => (
                  <th key={designation}>{designation}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {officeDesignationSummary.length ? (
                  visibleOfficeDesignationSummary.map((row) => (
                  <tr key={row.office}>
                    <td className="font-bold">{row.office}</td>
                    <td className="font-bold">{row.total}</td>
                    {summaryDesignationNames.map((designation) => (
                      <td key={designation}>
                        {row.counts[designation] || "-"}
                        {selectedDesignationMeta.get(designation)?.totalStrength ? (
                          <span className="ml-1 text-muted-foreground">/ {selectedDesignationMeta.get(designation).totalStrength}</span>
                        ) : null}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={summaryDesignationNames.length + 2} className="py-6 text-center text-muted-foreground">
                    No office / designation data available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {!showAllSummaryRows && officeDesignationSummary.length > visibleOfficeDesignationSummary.length ? (
            <p className="mt-2 text-xs font-semibold text-muted-foreground">
              Showing first {visibleOfficeDesignationSummary.length} in hierarchy order out of {officeDesignationSummary.length}. Use Show all for complete summary.
            </p>
        ) : null}
      </section>

      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-base font-black">Upcoming Retirements</h3>
            <p className="text-xs text-muted-foreground">DOB se age calculate ho rahi hai. 60 years complete hone wali records yahan show hongi.</p>
          </div>
        </div>
        <div className="overflow-auto">
          <table className="incumbency-table w-full min-w-[860px] border-collapse text-xs">
            <thead>
              <tr>
                <th>Name</th>
                <th>Designation</th>
                <th>Office / Section</th>
                <th>DOB</th>
                <th>Retirement Date</th>
                <th>Day</th>
                <th>Days Left</th>
              </tr>
            </thead>
            <tbody>
              {upcomingRetirements.length ? (
                upcomingRetirements.map((employee) => (
                  <tr key={employee.id}>
                    <td className="font-bold">{employee.fullName}</td>
                    <td>{employee.designation?.name || "-"}</td>
                    <td>{compactUnitName(employee.currentOfficeSection)}</td>
                    <td>{formatDate(employee.dateOfBirth)}</td>
                    <td>{formatDate(employee.retirementDate)}</td>
                    <td>{employee.retirementDate.toLocaleDateString(undefined, { weekday: "long" })}</td>
                    <td>{employee.daysLeft}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-muted-foreground">
                    No employees are retiring within the next 12 months.
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
