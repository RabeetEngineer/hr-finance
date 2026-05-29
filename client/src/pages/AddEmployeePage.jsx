import { useNavigate } from "react-router-dom";
import PageHeader from "@/components/layout/PageHeader";
import EmployeeForm from "@/components/forms/EmployeeForm";
import { useReferenceOptions } from "@/hooks/useReferenceOptions";
import { employeeService } from "@/services/employeeService";
import { toast } from "sonner";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { notifyResourceChanged } from "@/utils/resourceEvents";

const AddEmployeePage = () => {
  const navigate = useNavigate();
  const { loading, designationOptions, wingOptions, officeOptions, seatOptions } = useReferenceOptions({
    includeEmployees: false,
  });

  const handleSubmit = async (payload) => {
    try {
      const response = await employeeService.create(payload);
      toast.success("Employee created");
      notifyResourceChanged("employees");
      navigate(`/employees/${response.data.data.id}`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to create employee"));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add Employee"
        description="Create a complete employee profile with service history, posting, and contact information."
      />
      <div className="section-shell">
        {loading ? (
          <div className="rounded-3xl border border-dashed border-border p-8 text-sm text-muted-foreground">
            Loading reference data...
          </div>
        ) : (
          <EmployeeForm
            onSubmit={handleSubmit}
            designationOptions={designationOptions}
            wingOptions={wingOptions}
            officeOptions={officeOptions}
            seatOptions={seatOptions}
            submitLabel="Create Employee"
          />
        )}
      </div>
    </div>
  );
};

export default AddEmployeePage;
