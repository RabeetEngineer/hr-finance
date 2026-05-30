import { useEffect, useMemo, useState } from "react";
import { Pencil, Save, Search, Trash2, UserX, X } from "lucide-react";
import { toast } from "sonner";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import Modal from "@/components/common/Modal";
import { employeeService } from "@/services/employeeService";
import { formatDate } from "@/utils/formatDate";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { notifyResourceChanged, subscribeResourceChanged } from "@/utils/resourceEvents";
import { useAuth } from "@/hooks/useAuth";

const compactUnitName = (unit) => {
  const name = unit?.name || unit?.code || unit?.path || "Unassigned";
  return String(name).replace(/\s+/g, " ").trim();
};

const dateInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const editFormFromEmployee = (employee) => ({
  fullName: employee.fullName || "",
  fatherName: employee.fatherName || "",
  personnelNumber: employee.personnelNumber || "",
  cnic: employee.cnic || "",
  mobileNumber: employee.mobileNumber || "",
  employmentStatus: employee.employmentStatus || "transferred",
  transferredToDepartment: employee.transferredToDepartment || "",
  transferredOutDate: dateInputValue(employee.transferredOutDate),
  retirementDate: dateInputValue(employee.retirementDate),
});

const fetchAll = async (status) => {
  const first = await employeeService.list({ page: 1, limit: 800, status, sort: "-updatedAt" });
  const rows = [...(first.data.data || [])];
  const pages = Number(first.data.meta?.pages || 1);
  for (let page = 2; page <= pages; page += 1) {
    const response = await employeeService.list({ page, limit: 800, status, sort: "-updatedAt" });
    rows.push(...(response.data.data || []));
  }
  return rows;
};

const OldEmployeesPage = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [form, setForm] = useState(editFormFromEmployee({}));
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  const canEdit = ["super_admin", "admin", "data_entry"].includes(user?.role);
  const canDelete = ["super_admin", "admin"].includes(user?.role);

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

  const openEdit = (employee) => {
    setEditingEmployee(employee);
    setForm(editFormFromEmployee(employee));
  };

  const saveOldEmployee = async () => {
    if (!editingEmployee) return;
    setSaving(true);
    try {
      await employeeService.update(editingEmployee.id, {
        ...form,
        transferredOutDate: form.transferredOutDate || null,
        retirementDate: form.retirementDate || null,
      });
      toast.success("Old employee updated");
      setEditingEmployee(null);
      notifyResourceChanged("employees");
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not update old employee"));
    } finally {
      setSaving(false);
    }
  };

  const deleteOldEmployee = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await employeeService.remove(deleteTarget.id);
      toast.success("Old employee deleted");
      setDeleteTarget(null);
      notifyResourceChanged("employees");
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not delete old employee"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">Finance Department</p>
            <h1 className="mt-1 text-xl font-black">Old Employees</h1>
            <p className="mt-1 text-xs text-muted-foreground">Transferred-out and retired employees remain here for history and record keeping.</p>
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
                {(canEdit || canDelete) ? <th className="text-right">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={(canEdit || canDelete) ? 10 : 9} className="py-8 text-center text-muted-foreground">Loading old employees...</td>
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
                      {(canEdit || canDelete) ? (
                        <td>
                          <div className="flex justify-end gap-1">
                            {canEdit ? (
                              <button type="button" className="icon-action" title="Edit old employee" onClick={() => openEdit(employee)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                            {canDelete ? (
                              <button type="button" className="icon-action text-danger" title="Delete old employee" onClick={() => setDeleteTarget(employee)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={(canEdit || canDelete) ? 10 : 9} className="py-8 text-center text-muted-foreground">
                    <UserX className="mx-auto mb-2 h-6 w-6" />
                    No old employee records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal open={Boolean(editingEmployee)} title="Edit Old Employee" description="Update transfer, retirement, and record details." onClose={() => setEditingEmployee(null)} size="lg">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="label-shell">Name</span>
            <input className="input-shell" value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} />
          </label>
          <label className="block">
            <span className="label-shell">Father Name</span>
            <input className="input-shell" value={form.fatherName} onChange={(event) => setForm((current) => ({ ...current, fatherName: event.target.value }))} />
          </label>
          <label className="block">
            <span className="label-shell">Personnel No.</span>
            <input className="input-shell" value={form.personnelNumber} onChange={(event) => setForm((current) => ({ ...current, personnelNumber: event.target.value }))} />
          </label>
          <label className="block">
            <span className="label-shell">CNIC</span>
            <input className="input-shell" value={form.cnic} onChange={(event) => setForm((current) => ({ ...current, cnic: event.target.value }))} />
          </label>
          <label className="block">
            <span className="label-shell">Cell No.</span>
            <input className="input-shell" value={form.mobileNumber} onChange={(event) => setForm((current) => ({ ...current, mobileNumber: event.target.value }))} />
          </label>
          <label className="block">
            <span className="label-shell">Status</span>
            <select className="input-shell" value={form.employmentStatus} onChange={(event) => setForm((current) => ({ ...current, employmentStatus: event.target.value }))}>
              <option value="transferred">Transferred</option>
              <option value="retired">Retired</option>
              <option value="deceased">Deceased</option>
              <option value="resigned">Resigned</option>
            </select>
          </label>
          <label className="block">
            <span className="label-shell">Transferred To Department</span>
            <input className="input-shell" value={form.transferredToDepartment} onChange={(event) => setForm((current) => ({ ...current, transferredToDepartment: event.target.value }))} />
          </label>
          <label className="block">
            <span className="label-shell">Transferred Out Date</span>
            <input type="date" className="input-shell" value={form.transferredOutDate} onChange={(event) => setForm((current) => ({ ...current, transferredOutDate: event.target.value }))} />
          </label>
          <label className="block">
            <span className="label-shell">Retirement Date</span>
            <input type="date" className="input-shell" value={form.retirementDate} onChange={(event) => setForm((current) => ({ ...current, retirementDate: event.target.value }))} />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => setEditingEmployee(null)}>
            <X className="h-4 w-4" />
            Cancel
          </button>
          <button type="button" className="btn-primary" disabled={saving} onClick={saveOldEmployee}>
            <Save className="h-4 w-4" />
            Save
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete old employee"
        description={`Delete ${deleteTarget?.fullName || "this old employee"} permanently?`}
        confirmLabel="Delete"
        loading={saving}
        onConfirm={deleteOldEmployee}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default OldEmployeesPage;
