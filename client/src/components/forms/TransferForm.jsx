import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  transferDate: z.string().min(1, "Transfer date is required"),
  orderNumber: z.string().optional(),
  remarks: z.string().optional(),
  toWing: z.string().optional().nullable(),
  toOfficeSection: z.string().optional().nullable(),
  toSeat: z.string().optional().nullable(),
});

const TransferForm = ({
  defaultValues,
  onSubmit,
  employeeOptions = [],
  wingOptions = [],
  officeOptions = [],
  seatOptions = [],
  submitLabel = "Save Transfer",
}) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: defaultValues || {
      employeeId: "",
      transferDate: "",
      orderNumber: "",
      remarks: "",
      toWing: "",
      toOfficeSection: "",
      toSeat: "",
    },
  });

  useEffect(() => {
    if (defaultValues) reset(defaultValues);
  }, [defaultValues, reset]);

  const submit = (values) =>
    onSubmit({
      ...values,
      toWing: values.toWing || null,
      toOfficeSection: values.toOfficeSection || null,
      toSeat: values.toSeat || null,
      orderNumber: values.orderNumber || "",
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
          <label className="label-shell">Transfer Date</label>
          <input className="input-shell" type="date" {...register("transferDate")} />
        </div>
        <div>
          <label className="label-shell">Order Number</label>
          <input className="input-shell" {...register("orderNumber")} placeholder="SO/FIN/123" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="label-shell">To Wing (Optional)</label>
          <select className="input-shell" {...register("toWing")}>
            <option value="">Optional</option>
            {wingOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-shell">To Organization Unit</label>
          <select className="input-shell" {...register("toOfficeSection")}>
            <option value="">Optional</option>
            {officeOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-shell">To Seat</label>
          <select className="input-shell" {...register("toSeat")}>
            <option value="">Optional</option>
            {seatOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label-shell">Remarks</label>
        <textarea className="input-shell min-h-28" {...register("remarks")} placeholder="Additional notes" />
      </div>

      <button type="submit" className="btn-primary" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : submitLabel}
      </button>
    </form>
  );
};

export default TransferForm;
