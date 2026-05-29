import { useEffect, useMemo, useState } from "react";
import { Eye, Plus, RefreshCw, ScrollText } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/layout/PageHeader";
import DataTable from "@/components/common/DataTable";
import MetricCard from "@/components/common/MetricCard";
import SearchInput from "@/components/common/SearchInput";
import StatusBadge from "@/components/common/StatusBadge";
import Modal from "@/components/common/Modal";
import TransferForm from "@/components/forms/TransferForm";
import { transferService } from "@/services/transferService";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { formatDate } from "@/utils/formatDate";
import { notifyResourceChanged } from "@/utils/resourceEvents";
import { useReferenceOptions } from "@/hooks/useReferenceOptions";

const TransfersPage = () => {
  const { employeeOptions, wingOptions, officeOptions, seatOptions, loading: refLoading } = useReferenceOptions({
    includeEmployees: true,
  });
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [viewRecord, setViewRecord] = useState(null);

  const loadTransfers = async (params = {}) => {
    setLoading(true);
    try {
      const query = {
        limit: 500,
        sort: "-transferDate",
        ...params,
      };

      Object.keys(query).forEach((key) => {
        if (query[key] === "" || query[key] === undefined || query[key] === null) {
          delete query[key];
        }
      });

      const response = await transferService.list(query);
      setTransfers(response.data.data || []);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load transfers"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransfers(query());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeFilter, fromDate, toDate]);

  const query = (overrides = {}) => ({
    employee: employeeFilter || undefined,
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
    ...overrides,
  });

  const handleClear = () => {
    setSearchTerm("");
    setEmployeeFilter("");
    setFromDate("");
    setToDate("");
  };

  const handleCreate = async (values) => {
    try {
      await transferService.create(values);
      toast.success("Transfer recorded successfully");
      setCreateOpen(false);
      notifyResourceChanged("transfers");
      await loadTransfers(query());
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to record transfer"));
      throw error;
    }
  };

  const filteredTransfers = useMemo(() => {
    const text = searchTerm.trim().toLowerCase();
    if (!text) return transfers;

    return transfers.filter((record) =>
      [
        record.employee?.fullName,
        record.employee?.personnelNumber,
        record.orderNumber,
        record.fromOfficeSection?.path || record.fromWing?.name,
        record.fromOfficeSection?.name,
        record.toOfficeSection?.path || record.toWing?.name,
        record.toOfficeSection?.name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(text))
    );
  }, [searchTerm, transfers]);

  const metrics = useMemo(() => {
    const total = filteredTransfers.length;
    const uniqueEmployees = new Set(filteredTransfers.map((record) => record.employee?.id || record.employee?._id || record.employee)).size;
    return [
      { label: "Transfers", value: total, icon: ScrollText },
      { label: "Employees Moved", value: uniqueEmployees, icon: Eye },
    ];
  }, [filteredTransfers]);

  const columns = [
    { key: "employee", header: "Employee", render: (row) => row.employee?.fullName || "-" },
    { key: "from", header: "From", render: (row) => row.fromOfficeSection?.name || row.fromWing?.name || "-" },
    { key: "to", header: "To", render: (row) => row.toOfficeSection?.name || row.toWing?.name || "-" },
    { key: "transferDate", header: "Transfer Date", render: (row) => formatDate(row.transferDate) },
    { key: "orderNumber", header: "Order No.", render: (row) => row.orderNumber || "-" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transfers"
        description="Record transfer and posting changes with full history and seat vacancy updates."
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={handleClear}>
              Clear
            </button>
            <button type="button" className="btn-secondary" onClick={() => loadTransfers(query())}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Transfer
            </button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
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
            onSearch={() => setSearchTerm((value) => value.trim())}
            placeholder="Search transfers by employee..."
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
          <input className="input-shell" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          <input className="input-shell" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        </div>
      </div>

      <div className="section-shell">
          <DataTable
          loading={loading || refLoading}
          data={filteredTransfers}
          columns={columns}
          emptyState="No transfer records found."
          actions={(row) => (
            <div className="flex items-center justify-end gap-2">
              <button type="button" className="btn-ghost px-3 py-2 text-xs" onClick={() => setViewRecord(row)}>
                <Eye className="h-4 w-4" />
                View
              </button>
            </div>
          )}
        />
      </div>

      <Modal
        open={createOpen}
        title="Add Transfer"
        description="Record a transfer with from/to office, wing, and seat information."
        onClose={() => setCreateOpen(false)}
        size="lg"
      >
        <TransferForm
          employeeOptions={employeeOptions}
          wingOptions={wingOptions}
          officeOptions={officeOptions}
          seatOptions={seatOptions}
          onSubmit={handleCreate}
          submitLabel="Create Transfer"
        />
      </Modal>

      <Modal
        open={Boolean(viewRecord)}
        title="Transfer Details"
        description="Full transfer history entry."
        onClose={() => setViewRecord(null)}
        size="lg"
      >
        {viewRecord ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[
              ["Employee", viewRecord.employee?.fullName],
              ["From Wing", viewRecord.fromWing?.name],
              ["From Organization Unit", viewRecord.fromOfficeSection?.name],
              ["From Seat", viewRecord.fromSeat?.seatTitle],
              ["To Wing", viewRecord.toWing?.name],
              ["To Organization Unit", viewRecord.toOfficeSection?.name],
              ["To Seat", viewRecord.toSeat?.seatTitle],
              ["Transfer Date", formatDate(viewRecord.transferDate)],
              ["Order Number", viewRecord.orderNumber],
              ["Remarks", viewRecord.remarks],
            ].map(([label, value]) => (
              <div key={label} className="rounded-3xl border border-border bg-surface-2/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                <p className="mt-2 text-sm font-medium text-foreground">{value || "-"}</p>
              </div>
            ))}
            <div className="rounded-3xl border border-border bg-surface-2/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Status</p>
              <div className="mt-2">
                <StatusBadge value="active" />
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default TransfersPage;
