import { useEffect, useMemo, useState } from "react";
import { Search, UserX } from "lucide-react";
import { toast } from "sonner";
import { employeeService } from "@/services/employeeService";
import { formatDate } from "@/utils/formatDate";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { subscribeResourceChanged } from "@/utils/resourceEvents";

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

const fetchAll = async (status) => {
  const first = await employeeService.list({ page: 1, limit: 200, status, sort: "-updatedAt" });
  const rows = [...(first.data.data || [])];
  const pages = Number(first.data.meta?.pages || 1);
  for (let page = 2; page <= pages; page += 1) {
    const response = await employeeService.list({ page, limit: 200, status, sort: "-updatedAt" });
    rows.push(...(response.data.data || []));
  }
  return rows;
};

const OldEmployeesPage = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  const load = async () => {
    setLoading(true);
    try {
      const [transferred, retired] = await Promise.all([fetchAll("transferred"), fetchAll("retired")]);
      setRows([...transferred, ...retired].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)));
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load old employees"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const unsubscribe = subscribeResourceChanged(({ resource }) => {
      if (resource === "employees") load();
    });
    return unsubscribe;
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((employee) => {
      if (status !== "all" && employee.employmentStatus !== status) return false;
      if (!needle) return true;
      return [
        employee.fullName,
        employee.fatherName,
        employee.personnelNumber,
        employee.cnic,
        employee.designation?.name,
        compactUnitName(employee.currentOfficeSection),
        employee.transferredToDepartment,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [query, rows, status]);

  const transferredCount = rows.filter((employee) => employee.employmentStatus === "transferred").length;
  const retiredCount = rows.filter((employee) => employee.employmentStatus === "retired").length;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">Finance Department</p>
            <h1 className="mt-1 text-2xl font-black">Old Employees</h1>
            <p className="mt-1 text-sm text-muted-foreground">Transferred-out and retired employees remain here for history and record keeping.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg bg-surface-2 px-4 py-3">
              <p className="text-xs font-bold text-muted-foreground">Total</p>
              <p className="text-xl font-black">{rows.length}</p>
            </div>
            <div className="rounded-lg bg-surface-2 px-4 py-3">
              <p className="text-xs font-bold text-muted-foreground">Transferred</p>
              <p className="text-xl font-black">{transferredCount}</p>
            </div>
            <div className="rounded-lg bg-surface-2 px-4 py-3">
              <p className="text-xs font-bold text-muted-foreground">Retired</p>
              <p className="text-xl font-black">{retiredCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-2 rounded-lg border border-border bg-surface p-3 shadow-sm md:grid-cols-[1fr_220px]">
        <label className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input className="w-full bg-transparent text-sm outline-none" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, CNIC, designation, department..." />
        </label>
        <select className="input-shell" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">All old employees</option>
          <option value="transferred">Transferred out</option>
          <option value="retired">Retired</option>
        </select>
      </div>

      <section className="rounded-lg border border-border bg-surface p-3 shadow-sm">
        <div className="overflow-auto">
          <table className="incumbency-table w-full min-w-[980px] border-collapse text-xs">
            <thead>
              <tr>
                <th>Sr.</th>
                <th>Name</th>
                <th>Designation</th>
                <th>Last Office / Section</th>
                <th>Status</th>
                <th>Exit Date</th>
                <th>Transferred To</th>
                <th>Personnel No.</th>
                <th>CNIC</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground">Loading old employees...</td>
                </tr>
              ) : filtered.length ? (
                filtered.map((employee, index) => {
                  const exitDate = employee.employmentStatus === "retired" ? employee.retirementDate : employee.transferredOutDate;
                  return (
                    <tr key={employee.id}>
                      <td>{index + 1}</td>
                      <td>
                        <span className="font-bold">{employee.fullName || "-"}</span>
                        {employee.fatherName ? <span className="block text-xs text-muted-foreground">S/O {employee.fatherName}</span> : null}
                      </td>
                      <td>{employee.designation?.name || "-"}</td>
                      <td>{compactUnitName(employee.currentOfficeSection)}</td>
                      <td>
                        <span className="inline-flex rounded-md bg-surface-2 px-2 py-1 text-xs font-bold capitalize">{employee.employmentStatus?.replaceAll("_", " ")}</span>
                      </td>
                      <td>{formatDate(exitDate || employee.updatedAt)}</td>
                      <td>{employee.employmentStatus === "transferred" ? employee.transferredToDepartment || "-" : "-"}</td>
                      <td>{employee.personnelNumber || "-"}</td>
                      <td>{employee.cnic || "-"}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground">
                    <UserX className="mx-auto mb-2 h-6 w-6" />
                    No old employee records found.
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

export default OldEmployeesPage;
