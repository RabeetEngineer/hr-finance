import { useEffect, useMemo, useState } from "react";
import { Eye, RefreshCw, Workflow } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import PageHeader from "@/components/layout/PageHeader";
import DataTable from "@/components/common/DataTable";
import MetricCard from "@/components/common/MetricCard";
import SearchInput from "@/components/common/SearchInput";
import StatusBadge from "@/components/common/StatusBadge";
import Modal from "@/components/common/Modal";
import { seatService } from "@/services/seatService";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { formatDate } from "@/utils/formatDate";
import { useReferenceOptions } from "@/hooks/useReferenceOptions";

const VacantSeatsPage = () => {
  const navigate = useNavigate();
  const { wingOptions, officeOptions, designationOptions, loading: refLoading } = useReferenceOptions({
    includeEmployees: false,
    includeSeats: false,
  });
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [wingFilter, setWingFilter] = useState("");
  const [officeFilter, setOfficeFilter] = useState("");
  const [designationFilter, setDesignationFilter] = useState("");
  const [viewSeat, setViewSeat] = useState(null);

  const loadSeats = async (params = {}) => {
    setLoading(true);
    try {
      const response = await seatService.vacant({ limit: 1000, ...params });
      setSeats(response.data.data || []);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load vacant seats"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSeats();
  }, []);

  const filteredSeats = useMemo(() => {
    const text = searchTerm.trim().toLowerCase();
    return seats.filter((seat) => {
      const matchesText =
        !text ||
        [seat.seatTitle, seat.seatCode, seat.designation?.name, seat.officeSection?.name, seat.wing?.name, seat.additionalChargeHolder?.fullName]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(text));
      const matchesWing = !wingFilter || String(seat.wing?.id || seat.wing?._id || seat.wing) === wingFilter;
      const matchesOffice = !officeFilter || String(seat.officeSection?.id || seat.officeSection?._id || seat.officeSection) === officeFilter;
      const matchesDesignation =
        !designationFilter || String(seat.designation?.id || seat.designation?._id || seat.designation) === designationFilter;
      return matchesText && matchesWing && matchesOffice && matchesDesignation;
    });
  }, [designationFilter, officeFilter, searchTerm, seats, wingFilter]);

  const metrics = useMemo(() => {
    const total = filteredSeats.length;
    const vacant = filteredSeats.filter((seat) => seat.seatStatus === "vacant").length;
    return [
      { label: "Visible Seats", value: total, icon: Workflow },
      { label: "Vacant", value: vacant },
    ];
  }, [filteredSeats]);

  const columns = [
    { key: "seatTitle", header: "Seat", render: (row) => row.seatTitle },
    { key: "designation", header: "Designation", render: (row) => row.designation?.name || "-" },
    { key: "officeSection", header: "Organization Unit", render: (row) => row.officeSection?.path || row.officeSection?.name || "-" },
    { key: "wing", header: "Wing", render: (row) => row.wing?.name || "-" },
    { key: "seatStatus", header: "Status", render: (row) => <StatusBadge value={row.seatStatus} /> },
    { key: "updatedAt", header: "Updated", render: (row) => formatDate(row.updatedAt) },
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
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vacant Seats"
        description="A focused list of seats that are currently vacant and ready for assignment."
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={() => loadSeats()}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button type="button" className="btn-primary" onClick={() => navigate("/seats")}>
              Open Seats
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
        <div className="grid gap-3 xl:grid-cols-5">
          <div className="xl:col-span-2">
            <SearchInput
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              onSearch={() => setSearchTerm((value) => value.trim())}
              placeholder="Search seat, wing, section..."
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
        </div>
      </div>

      <div className="section-shell">
        <DataTable
          loading={loading || refLoading}
          data={filteredSeats}
          columns={columns}
          emptyState="No vacant seats found."
          actions={(row) => (
            <div className="flex items-center justify-end gap-2">
              <button type="button" className="btn-ghost px-3 py-2 text-xs" onClick={() => setViewSeat(row)}>
                <Eye className="h-4 w-4" />
                View
              </button>
            </div>
          )}
        />
      </div>

      <Modal
        open={Boolean(viewSeat)}
        title={viewSeat?.seatTitle || "Seat Details"}
        description="Vacancy and assignment summary."
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
            <div className="flex gap-3">
              <button type="button" className="btn-primary" onClick={() => navigate("/seats")}>
                Open Seat Management
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default VacantSeatsPage;
