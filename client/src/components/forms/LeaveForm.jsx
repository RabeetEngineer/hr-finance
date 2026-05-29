import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { leaveTypeOptions, approvalStatusOptions } from "@/constants/statusOptions";

const schema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  leaveType: z.enum(["casual_leave", "earned_leave", "medical_leave", "ex_pakistan_leave", "study_leave", "maternity_leave", "other"]),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  numberOfDays: z.coerce.number().min(1, "Number of days is required"),
  reason: z.string().optional(),
  approvalStatus: z.enum(["pending", "approved", "rejected"]),
  remarks: z.string().optional(),
});

const LeaveForm = ({ defaultValues, onSubmit, employeeOptions = [], submitLabel = "Save Leave" }) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: defaultValues || {
      employeeId: "",
      leaveType: "casual_leave",
      startDate: "",
      endDate: "",
      numberOfDays: 1,
      reason: "",
      approvalStatus: "pending",
      remarks: "",
    },
  });

  useEffect(() => {
    if (defaultValues) reset(defaultValues);
  }, [defaultValues, reset]);

  const submit = (values) =>
    onSubmit({
      ...values,
      reason: values.reason || "",
      remarks: values.remarks || "",
    });

  return (
    <form className="space-y-4" onSubmit={handleSubmit(submit)}>
      <div>
        <label className="label-shell">Employee</label>
        <select className="input-shell" {...register("employeeId")}>
          <option value="">Select employee</option>
          {employeeOptions.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        {errors.employeeId ? <p className="mt-2 text-xs text-danger">{errors.employeeId.message}</p> : null}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label-shell">Leave Type</label>
          <select className="input-shell" {...register("leaveType")}>
            {leaveTypeOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-shell">Approval Status</label>
          <select className="input-shell" {...register("approvalStatus")}>
            {approvalStatusOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="label-shell">Start Date</label>
          <input className="input-shell" type="date" {...register("startDate")} />
        </div>
        <div>
          <label className="label-shell">End Date</label>
          <input className="input-shell" type="date" {...register("endDate")} />
        </div>
        <div>
          <label className="label-shell">No. of Days</label>
          <input className="input-shell" type="number" {...register("numberOfDays")} />
        </div>
      </div>
      <div>
        <label className="label-shell">Reason</label>
        <textarea className="input-shell min-h-28" {...register("reason")} />
      </div>
      <div>
        <label className="label-shell">Remarks</label>
        <textarea className="input-shell min-h-28" {...register("remarks")} />
      </div>
      <button type="submit" className="btn-primary" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : submitLabel}
      </button>
    </form>
  );
};

export default LeaveForm;
