import { useEffect, useMemo, useState } from "react";
import { Eye, Pencil, Plus, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/layout/PageHeader";
import DataTable from "@/components/common/DataTable";
import MetricCard from "@/components/common/MetricCard";
import SearchInput from "@/components/common/SearchInput";
import StatusBadge from "@/components/common/StatusBadge";
import Modal from "@/components/common/Modal";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import AdditionalChargeForm from "@/components/forms/AdditionalChargeForm";
import { additionalChargeService } from "@/services/additionalChargeService";
import { seatService } from "@/services/seatService";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { formatDate } from "@/utils/formatDate";
import { notifyResourceChanged } from "@/utils/resourceEvents";
import { useReferenceOptions } from "@/hooks/useReferenceOptions";
import { toSelectOptions } from "@/utils/toOptions";

const normalizeRecord = (record) => ({
  ...record,
  vacantSeat: record.vacantSeat?.id || record.vacantSeat?._id || record.vacantSeat || "",
  additionalChargeHolder: record.additionalChargeHolder?.id || record.additionalChargeHolder?._id || record.additionalChargeHolder || "",
  startDate: record.startDate ? String(record.startDate).slice(0, 10) : "",
  endDate: record.endDate ? String(record.endDate).slice(0, 10) : "",
});

const AdditionalChargePage = () => {
  const { employeeOptions, loading: refLoading } = useReferenceOptions({
    includeEmployees: true,
    includeSeats: false,
  });
  const [charges, setCharges] = useState([]);
  const [vacantSeatOptions, setVacantSeatOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("true");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [viewRecord, setViewRecord] = useState(null);
  const [confirmEnd, setConfirmEnd] = useState(null);
  const [ending, setEnding] = useState(false);

  const employeeOptionsForEdit = useMemo(() => {
    const options = [...employeeOptions];
    const currentEmployee = editingRecord?._source?.additionalChargeHolder || editingRecord?.additionalChargeHolder;
    const currentEmployeeId = currentEmployee?.id || currentEmployee?._id || currentEmployee;
    if (currentEmployeeId && !options.some((option) => option.value === String(currentEmployeeId))) {
      options.unshift({
        value: String(currentEmployeeId),
        label: `${currentEmployee.fullName || "Employee"}${currentEmployee.personnelNumber ? ` (${currentEmployee.personnelNumber})` : ""}`,
      });
    }
    return options;
  }, [editingRecord, employeeOptions]);

  const seatOptionsForEdit = useMemo(() => {
    const options = [...vacantSeatOptions];
    const currentSeat = editingRecord?._source?.vacantSeat || editingRecord?.vacantSeat;
    const currentSeatId = currentSeat?.id || currentSeat?._id || currentSeat;
    if (currentSeatId && !options.some((option) => option.value === String(currentSeatId))) {
      options.unshift({
        value: String(currentSeatId),
        label: `${currentSeat.seatTitle || "Seat"}${currentSeat.seatCode ? ` (${currentSeat.seatCode})` : ""}`,
      });
    }
    return options;
  }, [editingRecord, vacantSeatOptions]);

  const loadVacantSeats = async () => {
    try {
      const response = await seatService.vacant({ limit: 1000 });
      const seats = (response.data.data || []).filter((item) => item.seatStatus === "vacant");
      setVacantSeatOptions(toSelectOptions(seats, (item) => `${item?.seatTitle || "Seat"}${item?.seatCode ? ` (${item.seatCode})` : ""}`));
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load vacant seats"));
    }
  };

  const loadCharges = async (params = {}) => {
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

      const response = await additionalChargeService.list(query);
      setCharges(response.data.data || []);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load additional charge records"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.all([loadVacantSeats(), loadCharges({ isActive: statusFilter })]).catch((error) => {
      toast.error(getErrorMessage(error, "Failed to load additional charge data"));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const query = (overrides = {}) => ({
    isActive: statusFilter,
    ...overrides,
  });

  const handleRefresh = async () => {
    await Promise.all([loadVacantSeats(), loadCharges(query())]);
  };

  const handleClear = async () => {
    setSearchTerm("");
    setStatusFilter("true");
    await Promise.all([loadVacantSeats(), loadCharges({ isActive: "true" })]);
  };

  const handleCreate = async (values) => {
    try {
      await additionalChargeService.create(values);
      toast.success("Additional charge created successfully");
      setCreateOpen(false);
      notifyResourceChanged("additional-charges");
      await Promise.all([loadVacantSeats(), loadCharges(query())]);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to create additional charge"));
      throw error;
    }
  };

  const handleUpdate = async (values) => {
    if (!editingRecord) return;
    try {
      await additionalChargeService.update(editingRecord.id, values);
      toast.success("Additional charge updated successfully");
      setEditingRecord(null);
      notifyResourceChanged("additional-charges");
      await Promise.all([loadVacantSeats(), loadCharges(query())]);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to update additional charge"));
      throw error;
    }
  };

  const handleEnd = async () => {
    if (!confirmEnd) return;
    setEnding(true);
    try {
      await additionalChargeService.end(confirmEnd.id, {});
      toast.success("Additional charge ended successfully");
      setConfirmEnd(null);
      notifyResourceChanged("additional-charges");
      await Promise.all([loadVacantSeats(), loadCharges(query())]);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to end additional charge"));
    } finally {
      setEnding(false);
    }
  };

  const filteredCharges = useMemo(() => {
    const text = searchTerm.trim().toLowerCase();
    return charges.filter((record) => {
      if (!text) return true;
      return [
        record.vacantSeat?.seatTitle,
        record.vacantSeat?.seatCode,
        record.additionalChargeHolder?.fullName,
        record.orderNumber,
        record.remarks,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(text));
    });
  }, [charges, searchTerm]);

  const metrics = useMemo(() => {
    const total = filteredCharges.length;
    const active = filteredCharges.filter((record) => record.isActive).length;
    const ended = total - active;
    return [
      { label: "Records", value: total, icon: ShieldCheck },
      { label: "Active", value: active },
      { label: "Ended", value: ended },
    ];
  }, [filteredCharges]);

  const columns = [
    { key: "vacantSeat", header: "Vacant Seat", render: (row) => row.vacantSeat?.seatTitle || "-" },
    { key: "additionalChargeHolder", header: "Holder", render: (row) => row.additionalChargeHolder?.fullName || "-" },
    { key: "startDate", header: "Start", render: (row) => formatDate(row.startDate) },
    { key: "endDate", header: "End", render: (row) => formatDate(row.endDate) },
    { key: "status", header: "Status", render: (row) => <StatusBadge value={String(row.isActive)} /> },
  ];

  const viewFields = (record) => [
    ["Vacant Seat", record.vacantSeat?.seatTitle],
    ["Seat Code", record.vacantSeat?.seatCode],
    ["Additional Charge Holder", record.additionalChargeHolder?.fullName],
    ["Start Date", formatDate(record.startDate)],
    ["End Date", formatDate(record.endDate)],
    ["Order Number", record.orderNumber],
    ["Remarks", record.remarks],
    ["Ended At", formatDate(record.endedAt)],
    ["Status", record.isActive ? "Active" : "Ended"],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Additional Charge"
        description="Track additional charge arrangements against vacant posts."
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
              Add Additional Charge
            </button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} label={metric.label} value={loading ? "..." : metric.value} icon={metric.icon} />
        ))}
      </div>

      <div className="section-shell">
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <SearchInput
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            onSearch={() => setSearchTerm((value) => value.trim())}
            placeholder="Search by seat or holder..."
          />
          <select
            className="input-shell"
            value={statusFilter}
            onChange={async (event) => {
              const nextStatus = event.target.value;
              setStatusFilter(nextStatus);
              await loadCharges({ isActive: nextStatus });
            }}
          >
            <option value="true">Active</option>
            <option value="false">Ended</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      <div className="section-shell">
        <DataTable
          loading={loading || refLoading}
          data={filteredCharges}
          columns={columns}
          emptyState="No additional charge records found."
          actions={(row) => (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button type="button" className="btn-ghost px-3 py-2 text-xs" onClick={() => setViewRecord(row)}>
                <Eye className="h-4 w-4" />
                View
              </button>
              <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={() => setEditingRecord({ ...normalizeRecord(row), _source: row })}>
                <Pencil className="h-4 w-4" />
                Edit
              </button>
              {row.isActive ? (
                <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={() => setConfirmEnd(row)}>
                  End
                </button>
              ) : null}
            </div>
          )}
        />
      </div>

      <Modal
        open={createOpen}
        title="Add Additional Charge"
        description="Assign additional charge to a vacant seat."
        onClose={() => setCreateOpen(false)}
        size="lg"
      >
        <AdditionalChargeForm
          seatOptions={vacantSeatOptions}
          employeeOptions={employeeOptions}
          onSubmit={handleCreate}
          submitLabel="Create Additional Charge"
        />
      </Modal>

      <Modal
        open={Boolean(editingRecord)}
        title="Edit Additional Charge"
        description="Update additional charge holder, dates, or order number."
        onClose={() => setEditingRecord(null)}
        size="lg"
      >
        {editingRecord ? (
          <AdditionalChargeForm
            defaultValues={editingRecord}
            seatOptions={seatOptionsForEdit}
            employeeOptions={employeeOptionsForEdit}
            onSubmit={handleUpdate}
            submitLabel="Update Additional Charge"
          />
        ) : null}
      </Modal>

      <Modal
        open={Boolean(viewRecord)}
        title="Additional Charge Details"
        description="Record details and status."
        onClose={() => setViewRecord(null)}
        size="lg"
      >
        {viewRecord ? (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {viewFields(viewRecord).map(([label, value]) => (
                <div key={label} className="rounded-3xl border border-border bg-surface-2/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                  <p className="mt-2 text-sm font-medium text-foreground">{value || "-"}</p>
                </div>
              ))}
            </div>
            {viewRecord.isActive ? (
              <div className="flex gap-3">
                <button type="button" className="btn-secondary" onClick={() => setConfirmEnd(viewRecord)}>
                  End Charge
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmEnd)}
        title="End additional charge"
        description={`End additional charge for ${confirmEnd?.vacantSeat?.seatTitle || "this seat"}?`}
        confirmLabel="End"
        loading={ending}
        onConfirm={handleEnd}
        onCancel={() => setConfirmEnd(null)}
      />
    </div>
  );
};

export default AdditionalChargePage;
