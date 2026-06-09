import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Plus, RefreshCw, ShieldCheck, Trash2, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/layout/PageHeader";
import DataTable from "@/components/common/DataTable";
import MetricCard from "@/components/common/MetricCard";
import SearchInput from "@/components/common/SearchInput";
import StatusBadge from "@/components/common/StatusBadge";
import Modal from "@/components/common/Modal";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import SeatForm from "@/components/forms/SeatForm";
import { seatService } from "@/services/seatService";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { formatDate } from "@/utils/formatDate";
import { getEntityId } from "@/utils/formHelpers";
import { notifyResourceChanged } from "@/utils/resourceEvents";
import { useReferenceOptions } from "@/hooks/useReferenceOptions";

const emptySeat = {
  seatTitle: "",
  seatCode: "",
  designation: "",
  officeSection: "",
  wing: "",
  bps: "",
  seatStatus: "vacant",
  currentEmployee: "",
  additionalChargeHolder: "",
  remarks: "",
  isActive: true,
};

const assignSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  orderNumber: z.string().optional(),
  remarks: z.string().optional(),
});

const chargeSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  orderNumber: z.string().optional(),
  remarks: z.string().optional(),
});

const normalizeSeat = (seat) => ({
  ...seat,
  designation: getEntityId(seat.designation),
  officeSection: getEntityId(seat.officeSection),
  wing: getEntityId(seat.wing),
  currentEmployee: getEntityId(seat.currentEmployee),
  additionalChargeHolder: getEntityId(seat.additionalChargeHolder),
});

const ActionForm = ({ description, defaultValues, schema, fields, submitLabel, onSubmit, onClose }) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const submit = async (values) => {
    await onSubmit(values);
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit(submit)}>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      <div className="space-y-4">{fields({ register, errors })}</div>
      <div className="flex items-center justify-end gap-3 pt-2">
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
};

const SeatsPage = () => {
  const { wingOptions, officeOptions, designationOptions, employeeOptions, loading: refLoading } = useReferenceOptions({
    includeEmployees: true,
    includeSeats: false,
  });
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("true");
  const [wingFilter, setWingFilter] = useState("");
  const [officeFilter, setOfficeFilter] = useState("");
  const [designationFilter, setDesignationFilter] = useState("");
  const [seatStatusFilter, setSeatStatusFilter] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSeat, setEditingSeat] = useState(null);
  const [viewSeat, setViewSeat] = useState(null);
  const [assignSeat, setAssignSeat] = useState(null);
  const [chargeSeat, setChargeSeat] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmVacate, setConfirmVacate] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [vacating, setVacating] = useState(false);

  const employeeOptionsForEdit = useMemo(() => {
    const options = [...employeeOptions];
    const mergeCurrent = (item) => {
      const source = editingSeat?._source || {};
      const resolved = typeof item === "string" ? null : item;
      const currentObject = resolved || source.currentEmployee || source.additionalChargeHolder || null;
      const currentId = item?.id || item?._id || item || currentObject?.id || currentObject?._id;
      if (!currentId || options.some((option) => option.value === String(currentId))) return;
      options.unshift({
        value: String(currentId),
        label: `${currentObject?.fullName || "Employee"}${currentObject?.personnelNumber ? ` (${currentObject.personnelNumber})` : ""}`,
      });
    };

    mergeCurrent(editingSeat?.currentEmployee);
    mergeCurrent(editingSeat?.additionalChargeHolder);
    return options;
  }, [editingSeat, employeeOptions]);

  const loadSeats = async (params = {}) => {
    setLoading(true);
    try {
      const query = {
        limit: 500,
        sort: "seatTitle",
        ...params,
      };

      Object.keys(query).forEach((key) => {
        if (query[key] === "" || query[key] === undefined || query[key] === null) {
          delete query[key];
        }
      });

      const response = await seatService.list(query);
      setSeats(response.data.data || []);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load seats"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSeats(query());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, wingFilter, officeFilter, designationFilter, seatStatusFilter]);

  const query = (overrides = {}) => ({
    q: searchTerm.trim() || undefined,
    isActive: statusFilter,
    wing: wingFilter || undefined,
    officeSection: officeFilter || undefined,
    designation: designationFilter || undefined,
    seatStatus: seatStatusFilter || undefined,
    ...overrides,
  });

  const handleSearch = () => loadSeats(query());
  const handleRefresh = () => loadSeats(query());
  const handleClear = () => {
    setSearchTerm("");
    setStatusFilter("true");
    setWingFilter("");
    setOfficeFilter("");
    setDesignationFilter("");
    setSeatStatusFilter("");
  };

  const handleOpenCreate = () => {
    setEditingSeat(null);
    setEditorOpen(true);
  };

  const handleOpenEdit = (seat) => {
    setEditingSeat({ ...normalizeSeat(seat), _source: seat });
    setEditorOpen(true);
  };

  const handleSave = async (values) => {
    try {
      if (editingSeat) {
        await seatService.update(editingSeat.id, values);
        toast.success("Seat updated successfully");
      } else {
        await seatService.create(values);
        toast.success("Seat created successfully");
      }

      setEditorOpen(false);
      setEditingSeat(null);
      notifyResourceChanged("seats");
      await loadSeats(query());
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to save seat"));
      throw error;
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await seatService.remove(confirmDelete.id);
      toast.success("Seat deleted successfully");
      setConfirmDelete(null);
      notifyResourceChanged("seats");
      await loadSeats(query());
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to delete seat"));
    } finally {
      setDeleting(false);
    }
  };

  const handleAssign = async (values) => {
    if (!assignSeat) return;
    try {
      await seatService.assign(assignSeat.id, {
        employeeId: values.employeeId,
        orderNumber: values.orderNumber || "",
        remarks: values.remarks || "",
      });
      toast.success("Seat assigned successfully");
      setAssignSeat(null);
      setViewSeat(null);
      notifyResourceChanged("seats");
      await loadSeats(query());
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to assign seat"));
      throw error;
    }
  };

  const handleVacate = async () => {
    if (!confirmVacate) return;
    setVacating(true);
    try {
      await seatService.vacate(confirmVacate.id);
      toast.success("Seat vacated successfully");
      setConfirmVacate(null);
      setViewSeat(null);
      notifyResourceChanged("seats");
      await loadSeats(query());
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to vacate seat"));
    } finally {
      setVacating(false);
    }
  };

  const handleCharge = async (values) => {
    if (!chargeSeat) return;
    try {
      await seatService.additionalCharge(chargeSeat.id, {
        employeeId: values.employeeId,
        startDate: values.startDate,
        endDate: values.endDate || null,
        orderNumber: values.orderNumber || "",
        remarks: values.remarks || "",
      });
      toast.success("Additional charge assigned successfully");
      setChargeSeat(null);
      setViewSeat(null);
      notifyResourceChanged("seats");
      await loadSeats(query());
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to assign additional charge"));
      throw error;
    }
  };

  const metrics = useMemo(() => {
    const total = seats.length;
    const occupied = seats.filter((seat) => seat.seatStatus === "occupied").length;
    const vacant = seats.filter((seat) => seat.seatStatus === "vacant").length;
    const additionalCharge = seats.filter((seat) => seat.seatStatus === "additional_charge").length;
    const frozen = seats.filter((seat) => seat.seatStatus === "frozen").length;
    return [
      { label: "Visible Seats", value: total, icon: Users },
      { label: "Occupied", value: occupied, icon: UserRound },
      { label: "Vacant", value: vacant, icon: Plus },
      { label: "Additional Charge", value: additionalCharge, icon: ShieldCheck },
      { label: "Frozen", value: frozen, icon: Trash2 },
    ];
  }, [seats]);

  const columns = [
    {
      key: "seatTitle",
      header: "Seat",
      render: (row) => (
        <div>
          <p className="font-semibold text-foreground">{row.seatTitle}</p>
          <p className="text-xs text-muted-foreground">{row.seatCode || "No code"}</p>
        </div>
      ),
    },
    { key: "designation", header: "Designation", render: (row) => row.designation?.name || "-" },
    { key: "officeSection", header: "Organization Unit", render: (row) => row.officeSection?.path || row.officeSection?.name || "-" },
    { key: "wing", header: "Wing", render: (row) => row.wing?.name || "-" },
    { key: "seatStatus", header: "Status", render: (row) => <StatusBadge value={row.seatStatus} /> },
    { key: "currentEmployee", header: "Current Employee", render: (row) => row.currentEmployee?.fullName || "-" },
    { key: "additionalChargeHolder", header: "Additional Charge", render: (row) => row.additionalChargeHolder?.fullName || "-" },
  ];

  const viewFields = (seat) => [
    ["Seat Title", seat.seatTitle],
    ["Seat Code", seat.seatCode],
    ["Designation", seat.designation?.name],
    ["Organization Unit", seat.officeSection?.path || seat.officeSection?.name],
    ["Wing", seat.wing?.name],
    ["BPS", seat.bps],
    ["Status", seat.seatStatus],
    ["Current Employee", seat.currentEmployee?.fullName],
    ["Additional Charge Holder", seat.additionalChargeHolder?.fullName],
    ["Created", formatDate(seat.createdAt)],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Seats / Posts"
        description="Manage current occupants, vacant seats, additional charge cases, and frozen posts."
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={handleClear}>
              Clear
            </button>
            <button type="button" className="btn-secondary" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button type="button" className="btn-primary" onClick={handleOpenCreate}>
              <Plus className="h-4 w-4" />
              Add Seat
            </button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} label={metric.label} value={loading ? "..." : metric.value} icon={metric.icon} />
        ))}
      </div>

      <div className="section-shell">
        <div className="grid gap-3 xl:grid-cols-5">
          <div className="xl:col-span-2">
            <SearchInput
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              onSearch={handleSearch}
              placeholder="Search seat title or code..."
            />
          </div>
          <select className="input-shell" value={wingFilter} onChange={(event) => setWingFilter(event.target.value)}>
            <option value="">All Wings</option>
            {wingOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select className="input-shell" value={officeFilter} onChange={(event) => setOfficeFilter(event.target.value)}>
            <option value="">All Organization Units</option>
            {officeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select className="input-shell" value={designationFilter} onChange={(event) => setDesignationFilter(event.target.value)}>
            <option value="">All Designations</option>
            {designationOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select className="input-shell" value={seatStatusFilter} onChange={(event) => setSeatStatusFilter(event.target.value)}>
            <option value="">All Seat Status</option>
            <option value="occupied">Occupied</option>
            <option value="vacant">Vacant</option>
            <option value="additional_charge">Additional Charge</option>
            <option value="frozen">Frozen</option>
          </select>
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          <select className="input-shell w-full max-w-[220px]" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      <div className="section-shell">
        <DataTable
          loading={loading || refLoading}
          data={seats}
          columns={columns}
          emptyState="No seats found. Create the first seat to begin."
          actions={(row) => (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button type="button" className="btn-ghost px-3 py-2 text-xs" onClick={() => setViewSeat(row)}>
                View
              </button>
              <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={() => handleOpenEdit(row)}>
                <Pencil className="h-4 w-4" />
                Edit
              </button>
              {row.seatStatus === "vacant" ? (
                <>
                  <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={() => setAssignSeat(row)}>
                    Assign
                  </button>
                  <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={() => setChargeSeat(row)}>
                    Charge
                  </button>
                </>
              ) : null}
              {row.seatStatus === "occupied" ? (
                <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={() => setConfirmVacate(row)}>
                  Vacate
                </button>
              ) : null}
              <button type="button" className="btn-ghost px-3 py-2 text-xs text-danger" onClick={() => setConfirmDelete(row)}>
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          )}
        />
      </div>

      <Modal
        open={editorOpen}
        title={editingSeat ? "Edit Seat / Post" : "Add Seat / Post"}
        description="Create a seat, assign a designation, and bind it to an office section and wing."
        onClose={() => {
          setEditorOpen(false);
          setEditingSeat(null);
        }}
        size="lg"
      >
        <SeatForm
          defaultValues={editingSeat || emptySeat}
          designationOptions={designationOptions}
          officeOptions={officeOptions}
          wingOptions={wingOptions}
          employeeOptions={employeeOptionsForEdit}
          onSubmit={handleSave}
          submitLabel={editingSeat ? "Update Seat" : "Create Seat"}
        />
      </Modal>

      <Modal
        open={Boolean(viewSeat)}
        title={viewSeat?.seatTitle || "Seat Details"}
        description="Current status and workflow actions for this seat."
        onClose={() => setViewSeat(null)}
        size="lg"
      >
        {viewSeat ? (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {viewFields(viewSeat).map(([label, value]) => (
                <div key={label} className="rounded-3xl border border-border bg-surface-2/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                  <p className="mt-2 text-sm font-medium text-foreground">{value || "-"}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              {viewSeat.seatStatus === "vacant" ? (
                <>
                  <button type="button" className="btn-primary" onClick={() => setAssignSeat(viewSeat)}>
                    Assign Employee
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => setChargeSeat(viewSeat)}>
                    Add Additional Charge
                  </button>
                </>
              ) : null}
              {viewSeat.seatStatus === "occupied" ? (
                <button type="button" className="btn-secondary" onClick={() => setConfirmVacate(viewSeat)}>
                  Vacate Seat
                </button>
              ) : null}
              <button type="button" className="btn-ghost text-danger" onClick={() => setConfirmDelete(viewSeat)}>
                Delete Seat
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(assignSeat)}
        title={`Assign ${assignSeat?.seatTitle || "Seat"}`}
        description="Assign an active employee to this vacant seat."
        onClose={() => setAssignSeat(null)}
      >
        {assignSeat ? (
          <ActionForm
            title="Assign seat"
            defaultValues={{ employeeId: "", orderNumber: "", remarks: "" }}
            schema={assignSchema}
            submitLabel="Assign"
            onClose={() => setAssignSeat(null)}
            onSubmit={handleAssign}
            fields={({ register, errors }) => (
              <>
                <div>
                  <label className="label-shell">Employee</label>
                  <select className="input-shell" {...register("employeeId")}>
                    <option value="">Select employee</option>
                    {employeeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {errors.employeeId ? <p className="mt-2 text-xs text-danger">{errors.employeeId.message}</p> : null}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="label-shell">Order Number</label>
                    <input className="input-shell" {...register("orderNumber")} placeholder="SO/FIN/123" />
                  </div>
                  <div>
                    <label className="label-shell">Remarks</label>
                    <input className="input-shell" {...register("remarks")} placeholder="Optional remarks" />
                  </div>
                </div>
              </>
            )}
          />
        ) : null}
      </Modal>

      <Modal
        open={Boolean(chargeSeat)}
        title={`Additional Charge - ${chargeSeat?.seatTitle || "Seat"}`}
        description="Assign additional charge to a vacant seat."
        onClose={() => setChargeSeat(null)}
        size="lg"
      >
        {chargeSeat ? (
          <ActionForm
            title="Additional charge"
            defaultValues={{ employeeId: "", startDate: "", endDate: "", orderNumber: "", remarks: "" }}
            schema={chargeSchema}
            submitLabel="Assign Charge"
            onClose={() => setChargeSeat(null)}
            onSubmit={handleCharge}
            fields={({ register, errors }) => (
              <>
                <div>
                  <label className="label-shell">Employee</label>
                  <select className="input-shell" {...register("employeeId")}>
                    <option value="">Select employee</option>
                    {employeeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {errors.employeeId ? <p className="mt-2 text-xs text-danger">{errors.employeeId.message}</p> : null}
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="label-shell">Start Date</label>
                    <input className="input-shell" type="date" {...register("startDate")} />
                    {errors.startDate ? <p className="mt-2 text-xs text-danger">{errors.startDate.message}</p> : null}
                  </div>
                  <div>
                    <label className="label-shell">End Date</label>
                    <input className="input-shell" type="date" {...register("endDate")} />
                  </div>
                  <div>
                    <label className="label-shell">Order Number</label>
                    <input className="input-shell" {...register("orderNumber")} placeholder="SO/FIN/123" />
                  </div>
                </div>
                <div>
                  <label className="label-shell">Remarks</label>
                  <textarea className="input-shell min-h-28" {...register("remarks")} />
                </div>
              </>
            )}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete seat"
        description={`Delete ${confirmDelete?.seatTitle || "this seat"}? Seats with employees, additional charge, posting, or transfer history cannot be deleted until they are cleared.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />

      <ConfirmDialog
        open={Boolean(confirmVacate)}
        title="Vacate seat"
        description={`Vacate ${confirmVacate?.seatTitle || "this seat"} and remove the current occupant?`}
        confirmLabel="Vacate"
        loading={vacating}
        onConfirm={handleVacate}
        onCancel={() => setConfirmVacate(null)}
      />
    </div>
  );
};

export default SeatsPage;
