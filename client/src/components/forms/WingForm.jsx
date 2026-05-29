import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2, "Wing name is required"),
  code: z.string().optional(),
  description: z.string().optional(),
  sortOrder: z.coerce.number().optional(),
  isActive: z.coerce.boolean().default(true),
});

const WingForm = ({ defaultValues, onSubmit, submitLabel = "Save Wing" }) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: defaultValues || {
      name: "",
      code: "",
      description: "",
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
        <label className="label-shell">Wing Name</label>
        <input className="input-shell" {...register("name")} placeholder="Budget Wing" />
        {errors.name ? <p className="mt-2 text-xs text-danger">{errors.name.message}</p> : null}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label-shell">Wing Code</label>
          <input className="input-shell" {...register("code")} placeholder="BW" />
        </div>
        <div>
          <label className="label-shell">Display Order</label>
          <input className="input-shell" type="number" {...register("sortOrder")} />
        </div>
      </div>
      <div>
        <label className="label-shell">Description</label>
        <textarea className="input-shell min-h-28" {...register("description")} placeholder="Optional description" />
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

export default WingForm;

