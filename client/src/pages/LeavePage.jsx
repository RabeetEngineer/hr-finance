import { useEffect, useMemo, useState } from "react";
import { Eye, Pencil, Plus, RefreshCw, Stamp } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/layout/PageHeader";
import DataTable from "@/components/common/DataTable";
import MetricCard from "@/components/common/MetricCard";
import SearchInput from "@/components/common/SearchInput";
import StatusBadge from "@/components/common/StatusBadge";
import Modal from "@/components/common/Modal";
import LeaveForm from "@/components/forms/LeaveForm";
import { leaveService } from "@/services/leaveService";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { formatDate } from "@/utils/formatDate";
import { notifyResourceChanged } from "@/utils/resourceEvents";
import { useReferenceOptions } from "@/hooks/useReferenceOptions";

const normalizeLeave = (leave) => ({
  ...leave,
  employeeId: leave.employee?.id || leave.employee?._id || leave.employee || "",
  startDate: leave.startDate ? String(leave.startDate).slice(0, 10) : "",
  endDate: leave.endDate ? String(leave.endDate).slice(0, 10) : "",
});

const LeavePage = () => {
  const { employeeOptions, loading: refLoading } = useReferenceOptions({
    includeEmployees: true,
    includeSeats: false,
  });
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState("");
  const [approvalFilter, setApprovalFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingLeave, setEditingLeave] = useState(null);
  const [viewLeave, setViewLeave] = useState(null);
  const [approvalLoadingKey, setApprovalLoadingKey] = useState("");

  const employeeOptionsForEdit = useMemo(() => {
    const options = [...employeeOptions];
    const currentEmployee = editingLeave?.employee;
    const currentEmployeeId = currentEmployee?.id || currentEmployee?._id || currentEmployee;
    if (currentEmployeeId && !options.some((option) => option.value === String(currentEmployeeId))) {
      options.unshift({
        value: String(currentEmployeeId),
        label: `${currentEmployee.fullName || "Employee"}${currentEmployee.personnelNumber ? ` (${currentEmployee.personnelNumber})` : ""}`,
      });
    }
    return options;
  }, [editingLeave, employeeOptions]);

  const loadLeaves = async (params = {}) => {
    setLoading(true);
    try {
      const query = {
        limit: 500,
        sort: "-startDate",
        ...params,
      };

      Object.keys(query).forEach((key) => {
        if (query[key] === "" || query[key] === undefined || query[key] === null) {
          delete query[key];
        }
      });

      const response = await leaveService.list(query);
      setLeaves(response.data.data || []);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load leaves"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaves(query());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeFilter, leaveTypeFilter, approvalFilter, fromDate, toDate]);

  const query = (overrides = {}) => ({
    employee: employeeFilter || undefined,
    leaveType: leaveTypeFilter || undefined,
    approvalStatus: approvalFilter || undefined,
    ...overrides,
  });

  const handleSearch = () => loadLeaves(query());
  const handleRefresh = () => loadLeaves(query());
  const handleClear = () => {
    setSearchTerm("");
    setEmployeeFilter("");
    setLeaveTypeFilter("");
    setApprovalFilter("");
    setFromDate("");
    setToDate("");
  };

  const handleCreate = async (values) => {
    try {
      await leaveService.create(values);
      toast.success("Leave record created successfully");
      setCreateOpen(false);
      notifyResourceChanged("leaves");
      await loadLeaves(query());
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to create leave record"));
      throw error;
    }
  };

  const handleUpdate = async (values) => {
    if (!editingLeave) return;
    try {
      await leaveService.update(editingLeave.id, values);
      toast.success("Leave record updated successfully");
      setEditingLeave(null);
      notifyResourceChanged("leaves");
      await loadLeaves(query());
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to update leave record"));
      throw error;
    }
  };

  const handleApprove = async (leaveId, approvalStatus = "approved") => {
    const key = `${leaveId}:${approvalStatus}`;
    setApprovalLoadingKey(key);
    try {
      await leaveService.approve(leaveId, { approvalStatus });
      toast.success(`Leave ${approvalStatus === "approved" ? "approved" : "rejected"} successfully`);
      setViewLeave(null);
      notifyResourceChanged("leaves");
      await loadLeaves(query());
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to update leave approval"));
    } finally {
      setApprovalLoadingKey("");
    }
  };

  const filteredLeaves = useMemo(() => {
    const text = searchTerm.trim().toLowerCase();
    const from = fromDate ? new Date(fromDate) : null;
    const to = toDate ? new Date(toDate) : null;

    return leaves.filter((leave) => {
      const matchesText =
        !text ||
        [leave.employee?.fullName, leave.employee?.personnelNumber, leave.leaveType, leave.reason, leave.remarks]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(text));

      const leaveStart = leave.startDate ? new Date(leave.startDate) : null;
      const matchesFrom = !from || !leaveStart || leaveStart >= from;
      const matchesTo = !to || !leaveStart || leaveStart <= to;

      return matchesText && matchesFrom && matchesTo;
    });
  }, [leaves, searchTerm, fromDate, toDate]);

  const metrics = useMemo(() => {
    const total = filteredLeaves.length;
    const pending = filteredLeaves.filter((leave) => leave.approvalStatus === "pending").length;
    const approved = filteredLeaves.filter((leave) => leave.approvalStatus === "approved").length;
    const rejected = filteredLeaves.filter((leave) => leave.approvalStatus === "rejected").length;
    return [
      { label: "Leave Records", value: total, icon: Stamp },
      { label: "Pending", value: pending },
      { label: "Approved", value: approved },
      { label: "Rejected", value: rejected },
    ];
  }, [filteredLeaves]);

  const columns = [
    { key: "employee", header: "Employee", render: (row) => row.employee?.fullName || "-" },
    { key: "leaveType", header: "Leave Type", render: (row) => <StatusBadge value={row.leaveType} /> },
    { key: "startDate", header: "Start", render: (row) => formatDate(row.startDate) },
    { key: "endDate", header: "End", render: (row) => formatDate(row.endDate) },
    { key: "approvalStatus", header: "Approval", render: (row) => <StatusBadge value={row.approvalStatus} /> },
    { key: "numberOfDays", header: "Days", render: (row) => row.numberOfDays || "-" },
  ];

  const viewFields = (leave) => [
    ["Employee", leave.employee?.fullName],
    ["Personnel No.", leave.employee?.personnelNumber],
    ["Leave Type", leave.leaveType],
    ["Start Date", formatDate(leave.startDate)],
    ["End Date", formatDate(leave.endDate)],
    ["Number of Days", leave.numberOfDays],
    ["Reason", leave.reason],
    ["Remarks", leave.remarks],
    ["Approval Status", leave.approvalStatus],
    ["Approved By", leave.approvedBy?.fullName],
    ["Approved At", formatDate(leave.approvedAt)],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Management"
        description="Manage employee leave requests, approval status, and leave records."
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={handleClear}>
              Clear
            </button>
            <button type="button" className="btn-secondary" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Leave
            </button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} label={metric.label} value={loading ? "..." : metric.value} icon={metric.icon} />
        ))}
      </div>

      <div className="section-shell">
        <div className="grid gap-3 xl:grid-cols-4">
          <div className="xl:col-span-2">
            <SearchInput
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              onSearch={handleSearch}
              placeholder="Search leave records..."
            />
          </div>
          <select className="input-shell" value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)}>
            <option value="">All Employees</option>
            {employeeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select className="input-shell" value={leaveTypeFilter} onChange={(event) => setLeaveTypeFilter(event.target.value)}>
            <option value="">All Leave Types</option>
            <option value="casual_leave">Casual Leave</option>
            <option value="earned_leave">Earned Leave</option>
            <option value="medical_leave">Medical Leave</option>
            <option value="ex_pakistan_leave">Ex-Pakistan Leave</option>
            <option value="study_leave">Study Leave</option>
            <option value="maternity_leave">Maternity Leave</option>
            <option value="other">Other</option>
          </select>
          <select className="input-shell" value={approvalFilter} onChange={(event) => setApprovalFilter(event.target.value)}>
            <option value="">All Approvals</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <input className="input-shell" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          <input className="input-shell" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        </div>
      </div>

      <div className="section-shell">
        <DataTable
          loading={loading || refLoading}
          data={filteredLeaves}
          columns={columns}
          emptyState="No leave records found."
          actions={(row) => (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button type="button" className="btn-ghost px-3 py-2 text-xs" onClick={() => setViewLeave(row)}>
                <Eye className="h-4 w-4" />
                View
              </button>
              <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={() => setEditingLeave(normalizeLeave(row))}>
                <Pencil className="h-4 w-4" />
                Edit
              </button>
              {row.approvalStatus === "pending" ? (
                <button
                  type="button"
                  className="btn-secondary px-3 py-2 text-xs"
                  disabled={approvalLoadingKey === `${row.id}:approved`}
                  onClick={() => handleApprove(row.id, "approved")}
                >
                  {approvalLoadingKey === `${row.id}:approved` ? "Approving..." : "Approve"}
                </button>
              ) : null}
            </div>
          )}
        />
      </div>

      <Modal
        open={createOpen}
        title="Add Leave"
        description="Capture leave requests and approval workflow."
        onClose={() => setCreateOpen(false)}
        size="lg"
      >
        <LeaveForm
          employeeOptions={employeeOptions}
          onSubmit={handleCreate}
          submitLabel="Create Leave"
        />
      </Modal>

      <Modal
        open={Boolean(editingLeave)}
        title="Edit Leave"
        description="Update leave dates, days, reason, or approval status."
        onClose={() => setEditingLeave(null)}
        size="lg"
      >
        {editingLeave ? (
          <LeaveForm
            defaultValues={editingLeave}
            employeeOptions={employeeOptionsForEdit}
            onSubmit={handleUpdate}
            submitLabel="Update Leave"
          />
        ) : null}
      </Modal>

      <Modal
        open={Boolean(viewLeave)}
        title="Leave Details"
        description="Record details and approval actions."
        onClose={() => setViewLeave(null)}
        size="lg"
      >
        {viewLeave ? (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {viewFields(viewLeave).map(([label, value]) => (
                <div key={label} className="rounded-3xl border border-border bg-surface-2/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                  <p className="mt-2 text-sm font-medium text-foreground">{value || "-"}</p>
                </div>
              ))}
              <div className="rounded-3xl border border-border bg-surface-2/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Approval</p>
                <div className="mt-2">
                  <StatusBadge value={viewLeave.approvalStatus} />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="btn-primary"
                disabled={approvalLoadingKey === `${viewLeave.id}:approved`}
                onClick={() => handleApprove(viewLeave.id, "approved")}
              >
                {approvalLoadingKey === `${viewLeave.id}:approved` ? "Approving..." : "Approve"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={approvalLoadingKey === `${viewLeave.id}:rejected`}
                onClick={() => handleApprove(viewLeave.id, "rejected")}
              >
                {approvalLoadingKey === `${viewLeave.id}:rejected` ? "Rejecting..." : "Reject"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default LeavePage;
