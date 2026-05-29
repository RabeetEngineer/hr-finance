import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { seatStatusOptions } from "@/constants/statusOptions";

const schema = z.object({
  seatTitle: z.string().min(2, "Seat title is required"),
  seatCode: z.string().optional(),
  designation: z.string().min(1, "Designation is required"),
  officeSection: z.string().min(1, "Organization unit is required"),
  wing: z.string().optional().nullable(),
  bps: z.string().optional(),
  seatStatus: z.enum(["occupied", "vacant", "additional_charge", "frozen"]),
  currentEmployee: z.string().optional().nullable(),
  additionalChargeHolder: z.string().optional().nullable(),
  remarks: z.string().optional(),
  isActive: z.coerce.boolean().default(true),
});

const SeatForm = ({
  defaultValues,
  onSubmit,
  designationOptions = [],
  officeOptions = [],
  wingOptions = [],
  employeeOptions = [],
  submitLabel = "Save Seat",
}) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: defaultValues || {
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
    },
  });

  useEffect(() => {
    if (defaultValues) reset(defaultValues);
  }, [defaultValues, reset]);

  const submit = (values) =>
    onSubmit({
      ...values,
      currentEmployee: values.currentEmployee || null,
      additionalChargeHolder: values.additionalChargeHolder || null,
      seatCode: values.seatCode || "",
      bps: values.bps || "",
    });

  return (
    <form className="space-y-4" onSubmit={handleSubmit(submit)}>
      <div>
        <label className="label-shell">Seat Title</label>
        <input className="input-shell" {...register("seatTitle")} placeholder="Section Officer Budget-I" />
        {errors.seatTitle ? <p className="mt-2 text-xs text-danger">{errors.seatTitle.message}</p> : null}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label-shell">Seat Code</label>
          <input className="input-shell" {...register("seatCode")} placeholder="SO-B1" />
        </div>
        <div>
          <label className="label-shell">BPS</label>
          <input className="input-shell" {...register("bps")} placeholder="17" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="label-shell">Designation</label>
          <select className="input-shell" {...register("designation")}>
            <option value="">Select designation</option>
            {designationOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-shell">Organization Unit</label>
          <select className="input-shell" {...register("officeSection")}>
            <option value="">Select organization unit</option>
            {officeOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-shell">Wing (Optional)</label>
          <select className="input-shell" {...register("wing")}>
            <option value="">No wing</option>
            {wingOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="label-shell">Seat Status</label>
          <select className="input-shell" {...register("seatStatus")}>
            {seatStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-shell">Current Employee</label>
          <select className="input-shell" {...register("currentEmployee")}>
            <option value="">Not assigned</option>
            {employeeOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-shell">Additional Charge Holder</label>
          <select className="input-shell" {...register("additionalChargeHolder")}>
            <option value="">None</option>
            {employeeOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="label-shell">Remarks</label>
        <textarea className="input-shell min-h-28" {...register("remarks")} placeholder="Optional notes" />
      </div>
      <label className="flex items-center gap-3 text-sm font-medium text-foreground/80">
        <input type="checkbox" {...register("isActive")} />
        Active
      </label>
      <button type="submit" className="btn-primary" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : submitLabel}
      </button>
    </form>
  );
};

export default SeatForm;
