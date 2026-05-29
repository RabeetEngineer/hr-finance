import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PageHeader from "@/components/layout/PageHeader";
import EmployeeForm from "@/components/forms/EmployeeForm";
import { useReferenceOptions } from "@/hooks/useReferenceOptions";
import { employeeService } from "@/services/employeeService";
import { toast } from "sonner";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { notifyResourceChanged } from "@/utils/resourceEvents";

const normalizeEmployee = (employee) => ({
  ...employee,
  designation: employee.designation?.id || employee.designation?._id || employee.designation || "",
  currentWing: employee.currentWing?.id || employee.currentWing?._id || employee.currentWing || "",
  currentOfficeSection: employee.currentOfficeSection?.id || employee.currentOfficeSection?._id || employee.currentOfficeSection || "",
  currentSeat: employee.currentSeat?.id || employee.currentSeat?._id || employee.currentSeat || "",
  attachments: employee.attachments || [],
  dateOfBirth: employee.dateOfBirth ? String(employee.dateOfBirth).slice(0, 10) : "",
  dateOfJoiningGovernmentService: employee.dateOfJoiningGovernmentService ? String(employee.dateOfJoiningGovernmentService).slice(0, 10) : "",
  dateOfJoiningCurrentDepartment: employee.dateOfJoiningCurrentDepartment ? String(employee.dateOfJoiningCurrentDepartment).slice(0, 10) : "",
  dateOfJoiningCurrentPost: employee.dateOfJoiningCurrentPost ? String(employee.dateOfJoiningCurrentPost).slice(0, 10) : "",
});

const EditEmployeePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { loading: refLoading, designationOptions, wingOptions, officeOptions, seatOptions } = useReferenceOptions({
    includeEmployees: false,
  });
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);

  const mergeOption = (options, item, labelResolver) => {
    const currentId = item?.id || item?._id || item;
    if (!currentId || options.some((option) => option.value === String(currentId))) return options;
    return [
      {
        value: String(currentId),
        label: labelResolver(item),
      },
      ...options,
    ];
  };

  const designationOptionsForForm = useMemo(
    () =>
      mergeOption(designationOptions, employee?.designation, (item) => `${item?.name || "Designation"}${item?.bps ? ` (${item.bps})` : ""}`),
    [designationOptions, employee?.designation]
  );

  const wingOptionsForForm = useMemo(
    () => mergeOption(wingOptions, employee?.currentWing, (item) => `${item?.name || "Wing"}${item?.code ? ` (${item.code})` : ""}`),
    [wingOptions, employee?.currentWing]
  );

  const officeOptionsForForm = useMemo(
    () =>
      mergeOption(officeOptions, employee?.currentOfficeSection, (item) => `${item?.path || item?.name || "Organization Unit"}${item?.code ? ` (${item.code})` : ""}`),
    [officeOptions, employee?.currentOfficeSection]
  );

  const seatOptionsForForm = useMemo(() => {
    const options = [...seatOptions];
    const currentSeat = employee?.currentSeat;
    const currentSeatId = currentSeat?.id || currentSeat?._id || currentSeat;
    if (currentSeatId && !options.some((option) => option.value === String(currentSeatId))) {
      options.unshift({
        value: String(currentSeatId),
        label: `${currentSeat.seatTitle || "Seat"}${currentSeat.seatCode ? ` (${currentSeat.seatCode})` : ""}`,
      });
    }
    return options;
  }, [employee, seatOptions]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const response = await employeeService.get(id);
        setEmployee(normalizeEmployee(response.data.data));
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to load employee"));
        navigate("/employees");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id, navigate]);

  const handleSubmit = async (payload) => {
    try {
      await employeeService.update(id, payload);
      toast.success("Employee updated");
      notifyResourceChanged("employees");
      navigate(`/employees/${id}`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to update employee"));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Employee"
        description="Update service details, posting context, and personal information."
      />
      <div className="section-shell">
        {loading || refLoading || !employee ? (
          <div className="rounded-3xl border border-dashed border-border p-8 text-sm text-muted-foreground">
            Loading employee record...
          </div>
        ) : (
            <EmployeeForm
              defaultValues={employee}
              onSubmit={handleSubmit}
              designationOptions={designationOptionsForForm}
              wingOptions={wingOptionsForForm}
              officeOptions={officeOptionsForForm}
              seatOptions={seatOptionsForForm}
              submitLabel="Update Employee"
            />
        )}
      </div>
    </div>
  );
};

export default EditEmployeePage;
