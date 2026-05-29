import { useEffect, useMemo, useState } from "react";
import { Download, Printer, Search, Users, Building2, Tags } from "lucide-react";
import { employeeService } from "@/services/employeeService";
import { reportService } from "@/services/reportService";
import { formatDate } from "@/utils/formatDate";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { subscribeResourceChanged } from "@/utils/resourceEvents";
import { toast } from "sonner";

const compactUnitName = (unit) => {
  const name = unit?.code || unit?.name || unit?.path || "Unassigned";
  return String(name)
    .replace(/^O\/O\s+/i, "")
    .replace(/\bAdditional\b/gi, "Addl.")
    .replace(/\bDeputy\b/gi, "Dy.")
    .replace(/\bSecretary\b/gi, "Secy")
    .replace(/\bFinance\b/gi, "Fin.")
    .replace(/\s+/g, " ");
};

const fetchAllEmployees = async () => {
  const first = await employeeService.list({ page: 1, limit: 200, sort: "sortOrder fullName", status: "active" });
  const rows = [...(first.data.data || [])];
  const pages = Number(first.data.meta?.pages || 1);
  for (let page = 2; page <= pages; page += 1) {
    const response = await employeeService.list({ page, limit: 200, sort: "sortOrder fullName", status: "active" });
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
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [dashboardResponse, employeeRows] = await Promise.all([reportService.dashboard(), fetchAllEmployees()]);
      setDashboard(dashboardResponse.data.data);
      setEmployees(employeeRows);
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

  const officeDesignationSummary = useMemo(() => {
    const map = new Map();
    employees.forEach((employee) => {
      const office = compactUnitName(employee.currentOfficeSection);
      const designation = employee.designation?.name || "Unspecified";
      if (!map.has(office)) map.set(office, { office, total: 0, counts: {} });
      const group = map.get(office);
      group.total += 1;
      group.counts[designation] = (group.counts[designation] || 0) + 1;
    });
    return [...map.values()].sort((a, b) => b.total - a.total || a.office.localeCompare(b.office));
  }, [employees]);

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
    { label: "Designations", value: designationNames.length, icon: Tags, sub: "Used in active records" },
  ];

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
            <p className="text-xs text-muted-foreground">Each office shows count by designation, for example Assistants, Junior Clerks, Drivers, and so on.</p>
          </div>
          <button
            type="button"
            className="btn-secondary px-3 py-2 text-xs"
            onClick={() =>
              downloadCsv(
                "office-designation-summary.csv",
                ["Office / Section", "Total", ...designationNames],
                officeDesignationSummary.map((row) => [row.office, row.total, ...designationNames.map((designation) => row.counts[designation] || 0)])
              )
            }
          >
            <Download className="h-4 w-4" />
            Export Summary
          </button>
        </div>
        <div className="overflow-auto">
          <table className="incumbency-table w-full min-w-[980px] border-collapse text-xs">
            <thead>
              <tr>
                <th>Office / Section</th>
                <th>Total</th>
                {designationNames.map((designation) => (
                  <th key={designation}>{designation}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {officeDesignationSummary.length ? (
                officeDesignationSummary.map((row) => (
                  <tr key={row.office}>
                    <td className="font-bold">{row.office}</td>
                    <td className="font-bold">{row.total}</td>
                    {designationNames.map((designation) => (
                      <td key={designation}>{row.counts[designation] || "-"}</td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={designationNames.length + 2} className="py-6 text-center text-muted-foreground">
                    No office / designation data available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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

      <section className="rounded-lg border border-border bg-surface p-3 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
          <div>
            <h3 className="text-base font-black">Recent Employee Records</h3>
            <p className="text-xs text-muted-foreground">Dashboard preview only. Full data stays in Incumbency Sheet.</p>
          </div>
        </div>
        <div className="overflow-auto">
          <table className="incumbency-table w-full min-w-[820px] border-collapse text-xs">
            <thead>
              <tr>
                <th>Name</th>
                <th>Personnel No.</th>
                <th>Designation</th>
                <th>Office / Section</th>
                <th>Cell</th>
                <th>Joining</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.length ? (
                filteredEmployees.map((employee) => (
                  <tr key={employee.id}>
                    <td className="font-bold">{employee.fullName}</td>
                    <td>{employee.personnelNumber || "-"}</td>
                    <td>{employee.designation?.name || "-"}</td>
                    <td>{compactUnitName(employee.currentOfficeSection)}</td>
                    <td>{employee.mobileNumber || "-"}</td>
                    <td>{formatDate(employee.dateOfJoiningCurrentDepartment || employee.dateOfJoiningGovernmentService)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted-foreground">
                    No records match the dashboard search.
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
