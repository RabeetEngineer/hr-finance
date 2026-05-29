import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CalendarDays, Edit3, FileText, Printer, ScrollText, ShieldCheck, UserSquare2 } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import MetricCard from "@/components/common/MetricCard";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/common/StatusBadge";
import PrintButton from "@/components/common/PrintButton";
import { employeeService } from "@/services/employeeService";
import { formatDate } from "@/utils/formatDate";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { toast } from "sonner";

const tabs = [
  { key: "profile", label: "Profile", icon: UserSquare2 },
  { key: "posting", label: "Posting History", icon: ScrollText },
  { key: "transfers", label: "Transfers", icon: FileText },
  { key: "leave", label: "Leave", icon: CalendarDays },
  { key: "charges", label: "Additional Charge", icon: ShieldCheck },
];

const EmployeeDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("profile");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const response = await employeeService.get(id);
        setEmployee(response.data.data);
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to load employee"));
        navigate("/employees");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id, navigate]);

  const summaryCards = useMemo(
    () => [
      { label: "Personnel No.", value: employee?.personnelNumber || "-", icon: FileText },
      { label: "Designation", value: employee?.designation?.name || "-", icon: UserSquare2 },
      { label: "Organization Unit", value: employee?.currentOfficeSection?.name || "-", icon: ScrollText },
      { label: "Seat", value: employee?.currentSeat?.seatTitle || "No seat", icon: ShieldCheck },
    ],
    [employee]
  );

  const postingColumns = [
    { key: "actionType", header: "Action", render: (row) => <StatusBadge value={row.actionType} /> },
    { key: "effectiveDate", header: "Effective", render: (row) => formatDate(row.effectiveDate) },
    { key: "from", header: "From", render: (row) => row.fromOfficeSection?.name || row.fromWing?.name || "-" },
    { key: "to", header: "To", render: (row) => row.toOfficeSection?.name || row.toWing?.name || "-" },
  ];

  const transferColumns = [
    { key: "transferDate", header: "Transfer Date", render: (row) => formatDate(row.transferDate) },
    { key: "fromWing", header: "From", render: (row) => row.fromOfficeSection?.name || row.fromWing?.name || "-" },
    { key: "toWing", header: "To", render: (row) => row.toOfficeSection?.name || row.toWing?.name || "-" },
    { key: "orderNumber", header: "Order", render: (row) => row.orderNumber || "-" },
  ];

  const leaveColumns = [
    { key: "leaveType", header: "Leave Type", render: (row) => <StatusBadge value={row.leaveType} /> },
    { key: "startDate", header: "Start", render: (row) => formatDate(row.startDate) },
    { key: "endDate", header: "End", render: (row) => formatDate(row.endDate) },
    { key: "approvalStatus", header: "Approval", render: (row) => <StatusBadge value={row.approvalStatus} /> },
  ];

  const chargeColumns = [
    { key: "vacantSeat", header: "Seat", render: (row) => row.vacantSeat?.seatTitle || "-" },
    { key: "startDate", header: "Start", render: (row) => formatDate(row.startDate) },
    { key: "endDate", header: "End", render: (row) => formatDate(row.endDate) },
    { key: "isActive", header: "Active", render: (row) => <StatusBadge value={String(row.isActive)} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={loading ? "Employee Detail" : employee?.fullName || "Employee Detail"}
        description="Profile, posting, transfer, leave, and additional charge history in one official record."
        actions={
          <>
            <PrintButton />
            <Link to={`/employees/${id}/edit`} className="btn-primary">
              <Edit3 className="h-4 w-4" />
              Edit Employee
            </Link>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <MetricCard key={card.label} {...card} value={loading ? "..." : card.value} />
        ))}
      </div>

      <div className="section-shell">
        <div className="flex flex-wrap gap-2 border-b border-border pb-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  activeTab === tab.key ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/70"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="pt-6">
          {activeTab === "profile" && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[
                ["Father Name", employee?.fatherName],
                ["CNIC", employee?.cnic],
                ["Gender", employee?.gender],
                ["DOB", formatDate(employee?.dateOfBirth)],
                ["Govt Service Join", formatDate(employee?.dateOfJoiningGovernmentService)],
                ["Department Join", formatDate(employee?.dateOfJoiningCurrentDepartment)],
                ["Current Post Join", formatDate(employee?.dateOfJoiningCurrentPost)],
                ["Mobile", employee?.mobileNumber],
                ["WhatsApp", employee?.whatsappNumber],
                ["Email", employee?.email],
                ["District", employee?.district],
                ["Domicile", employee?.domicile],
              ].map(([label, value]) => (
                <div key={label} className="rounded-3xl border border-border bg-surface-2/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                  <p className="mt-2 text-sm font-medium text-foreground">{value || "-"}</p>
                </div>
              ))}
              <div className="rounded-3xl border border-border bg-surface-2/60 p-4 md:col-span-2 xl:col-span-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Remarks</p>
                <p className="mt-2 text-sm leading-6 text-foreground/80">{employee?.remarks || "-"}</p>
              </div>
            </div>
          )}

          {activeTab === "posting" && (
            <DataTable
              loading={loading}
              data={employee?.postingHistory || []}
              columns={postingColumns}
              emptyState="No posting history found."
            />
          )}

          {activeTab === "transfers" && (
            <DataTable
              loading={loading}
              data={employee?.transfers || []}
              columns={transferColumns}
              emptyState="No transfer records found."
            />
          )}

          {activeTab === "leave" && (
            <DataTable
              loading={loading}
              data={employee?.leaves || []}
              columns={leaveColumns}
              emptyState="No leave records found."
            />
          )}

          {activeTab === "charges" && (
            <DataTable
              loading={loading}
              data={employee?.chargeRecords || []}
              columns={chargeColumns}
              emptyState="No additional charge records found."
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeeDetailPage;
