import { useEffect, useState } from "react";
import { BarChart3, FileDown, FileText, Printer, Table2 } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import MetricCard from "@/components/common/MetricCard";
import PrintButton from "@/components/common/PrintButton";
import DataTable from "@/components/common/DataTable";
import { useReferenceOptions } from "@/hooks/useReferenceOptions";
import { reportService } from "@/services/reportService";
import { toast } from "sonner";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { formatDate } from "@/utils/formatDate";

const reportCards = [
  { key: "incumbency", title: "Complete Incumbency", description: "All active incumbency records" },
  { key: "vacant", title: "Vacant Seats", description: "Vacant and additional-charge seats" },
  { key: "transfers", title: "Transfers", description: "Transfer / posting history" },
  { key: "leaves", title: "Leave Report", description: "Employee leave records" },
  { key: "retirements", title: "Retirement Due", description: "Upcoming retirement planning list" },
];

const ReportsPage = () => {
  const { officeOptions: organizationUnitOptions } = useReferenceOptions({
    includeEmployees: false,
    includeSeats: false,
  });
  const [summary, setSummary] = useState(null);
  const [activeReport, setActiveReport] = useState("incumbency");
  const [reportRows, setReportRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [organizationUnit, setOrganizationUnit] = useState("");
  const [includeChildren, setIncludeChildren] = useState("true");

  useEffect(() => {
    const loadSummary = async () => {
      setLoading(true);
      try {
        const response = await reportService.dashboard();
        setSummary(response.data.data?.counts || {});
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to load report summary"));
      } finally {
        setLoading(false);
      }
    };

    loadSummary();
  }, []);

  const loadReport = async (type = activeReport) => {
    setActiveReport(type);
    setReportLoading(true);
    try {
      const params = {
        organizationUnit: organizationUnit || undefined,
        includeChildren,
      };
      let response;
      if (type === "incumbency") response = await reportService.incumbency(params);
      if (type === "vacant") response = await reportService.vacantSeats(params);
      if (type === "transfers") response = await reportService.transfers(params);
      if (type === "leaves") response = await reportService.leaves(params);
      if (type === "retirements") response = await reportService.retirementsDue(params);
      setReportRows(response?.data?.data || []);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load report"));
      setReportRows([]);
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    loadReport("incumbency");
  }, []);

  useEffect(() => {
    loadReport(activeReport);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationUnit, includeChildren]);

  const renderReportTable = () => {
    if (activeReport === "incumbency") {
      return (
        <DataTable
          loading={reportLoading}
          data={reportRows}
          columns={[
            { key: "fullName", header: "Employee", render: (row) => row.fullName || "-" },
            { key: "personnelNumber", header: "Personnel No.", render: (row) => row.personnelNumber || "-" },
            { key: "designation", header: "Designation", render: (row) => row.designation?.name || "-" },
            { key: "unit", header: "Organization Unit", render: (row) => row.currentOfficeSection?.name || "-" },
            { key: "seat", header: "Seat", render: (row) => row.currentSeat?.seatTitle || "-" },
          ]}
        />
      );
    }

    if (activeReport === "vacant") {
      return (
        <DataTable
          loading={reportLoading}
          data={reportRows}
          columns={[
            { key: "seatTitle", header: "Seat", render: (row) => row.seatTitle || "-" },
            { key: "designation", header: "Designation", render: (row) => row.designation?.name || "-" },
            { key: "office", header: "Organization Unit", render: (row) => row.officeSection?.path || row.officeSection?.name || "-" },
            { key: "status", header: "Status", render: (row) => row.seatStatus || "-" },
          ]}
        />
      );
    }

    if (activeReport === "transfers") {
      return (
        <DataTable
          loading={reportLoading}
          data={reportRows}
          columns={[
            { key: "employee", header: "Employee", render: (row) => row.employee?.fullName || "-" },
            { key: "from", header: "From", render: (row) => row.fromOfficeSection?.name || row.fromWing?.name || "-" },
            { key: "to", header: "To", render: (row) => row.toOfficeSection?.name || row.toWing?.name || "-" },
            { key: "date", header: "Date", render: (row) => formatDate(row.transferDate) },
          ]}
        />
      );
    }

    if (activeReport === "leaves") {
      return (
        <DataTable
          loading={reportLoading}
          data={reportRows}
          columns={[
            { key: "employee", header: "Employee", render: (row) => row.employee?.fullName || "-" },
            { key: "leaveType", header: "Leave Type", render: (row) => row.leaveType?.replaceAll("_", " ") || "-" },
            { key: "startDate", header: "Start", render: (row) => formatDate(row.startDate) },
            { key: "approvalStatus", header: "Status", render: (row) => row.approvalStatus || "-" },
          ]}
        />
      );
    }

    return (
      <DataTable
        loading={reportLoading}
        data={reportRows}
        columns={[
          { key: "fullName", header: "Employee", render: (row) => row.fullName || "-" },
          { key: "personnelNumber", header: "Personnel No.", render: (row) => row.personnelNumber || "-" },
          { key: "dateOfBirth", header: "DOB", render: (row) => formatDate(row.dateOfBirth) },
          { key: "employmentStatus", header: "Status", render: (row) => row.employmentStatus || "-" },
        ]}
      />
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Generate clean, official, print-friendly reports for incumbency, transfers, vacancies, leave, and retirement planning."
        actions={
          <>
            <PrintButton label="Print Current" />
            <button type="button" className="btn-secondary">
              <FileDown className="h-4 w-4" />
              Export PDF
            </button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Employees" value={loading ? "..." : summary?.totalEmployees || 0} icon={BarChart3} />
        <MetricCard label="Vacant Seats" value={loading ? "..." : summary?.vacantSeats || 0} icon={Table2} />
        <MetricCard label="Additional Charge" value={loading ? "..." : summary?.additionalChargeCases || 0} icon={FileText} />
        <MetricCard label="On Leave" value={loading ? "..." : summary?.onLeaveCount || 0} icon={Printer} />
      </div>

      <div className="section-shell">
        <div className="grid gap-3 md:grid-cols-[1fr_220px] xl:grid-cols-[1fr_220px_220px]">
          <select className="input-shell" value={organizationUnit} onChange={(event) => setOrganizationUnit(event.target.value)}>
            <option value="">All Organization Units</option>
            {organizationUnitOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select className="input-shell" value={includeChildren} onChange={(event) => setIncludeChildren(event.target.value)}>
            <option value="true">Include Child Units</option>
            <option value="false">Selected Unit Only</option>
          </select>
          <button type="button" className="btn-secondary" onClick={() => loadReport(activeReport)}>
            Apply Filters
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {reportCards.map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => loadReport(card.key)}
            className={`rounded-3xl border px-4 py-5 text-left transition ${
              activeReport === card.key ? "border-primary bg-primary text-primary-foreground shadow-soft" : "border-border bg-surface hover:bg-muted"
            }`}
          >
            <p className="text-sm font-semibold">{card.title}</p>
            <p className={`mt-2 text-sm leading-6 ${activeReport === card.key ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
              {card.description}
            </p>
          </button>
        ))}
      </div>

      <div className="section-shell">
        {renderReportTable()}
      </div>
    </div>
  );
};

export default ReportsPage;
