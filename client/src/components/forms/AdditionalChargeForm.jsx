import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  vacantSeat: z.string().min(1, "Vacant seat is required"),
  additionalChargeHolder: z.string().min(1, "Employee is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  orderNumber: z.string().optional(),
  remarks: z.string().optional(),
});

const AdditionalChargeForm = ({
  defaultValues,
  onSubmit,
  seatOptions = [],
  employeeOptions = [],
  submitLabel = "Save Additional Charge",
}) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: defaultValues || {
      vacantSeat: "",
      additionalChargeHolder: "",
      startDate: "",
      endDate: "",
      orderNumber: "",
      remarks: "",
    },
  });

  useEffect(() => {
    if (defaultValues) reset(defaultValues);
  }, [defaultValues, reset]);

  const submit = (values) =>
    onSubmit({
      ...values,
      endDate: values.endDate || null,
      orderNumber: values.orderNumber || "",
      remarks: values.remarks || "",
    });

  return (
    <form className="space-y-4" onSubmit={handleSubmit(submit)}>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label-shell">Vacant Seat</label>
          <select className="input-shell" {...register("vacantSeat")}>
            <option value="">Select seat</option>
            {seatOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          {errors.vacantSeat ? <p className="mt-2 text-xs text-danger">{errors.vacantSeat.message}</p> : null}
        </div>
        <div>
          <label className="label-shell">Additional Charge Holder</label>
          <select className="input-shell" {...register("additionalChargeHolder")}>
            <option value="">Select employee</option>
            {employeeOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          {errors.additionalChargeHolder ? (
            <p className="mt-2 text-xs text-danger">{errors.additionalChargeHolder.message}</p>
          ) : null}
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
          <label className="label-shell">Order Number</label>
          <input className="input-shell" {...register("orderNumber")} />
        </div>
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

export default AdditionalChargeForm;
