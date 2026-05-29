import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2, "Designation name is required"),
  bps: z.string().optional(),
  service: z.string().optional(),
  category: z.enum(["officer", "official", "support_staff"]),
  sortOrder: z.coerce.number().optional(),
  isActive: z.coerce.boolean().default(true),
});

const DesignationForm = ({ defaultValues, onSubmit, submitLabel = "Save Designation" }) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: defaultValues || {
      name: "",
      bps: "",
      service: "",
      category: "official",
      sortOrder: 0,
      isActive: true,
    },
  });

  useEffect(() => {
    if (defaultValues) reset(defaultValues);
  }, [defaultValues, reset]);

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label className="label-shell">Designation Name</label>
        <input className="input-shell" {...register("name")} placeholder="Section Officer, Assistant, Junior Clerk..." />
        {errors.name ? <p className="mt-2 text-xs text-danger">{errors.name.message}</p> : null}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label-shell">BPS / Grade</label>
          <input className="input-shell" {...register("bps")} placeholder="BPS-17" />
        </div>
        <div>
          <label className="label-shell">Service</label>
          <input className="input-shell" {...register("service")} placeholder="PMS, Secretariat, Technical..." />
        </div>
      </div>
      <input type="hidden" {...register("sortOrder")} value={defaultValues?.sortOrder || 0} />
      <input type="hidden" {...register("category")} value="official" />
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

export default DesignationForm;
