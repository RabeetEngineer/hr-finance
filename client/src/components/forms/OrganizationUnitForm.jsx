import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

export const organizationUnitTypeOptions = [
  { value: "department", label: "Department" },
  { value: "office", label: "Office" },
  { value: "wing", label: "Wing" },
  { value: "branch", label: "Branch" },
  { value: "section", label: "Section" },
  { value: "cell", label: "Cell" },
  { value: "unit", label: "Unit" },
  { value: "other", label: "Other" },
];

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  code: z.string().optional(),
  type: z.enum(["department", "office", "wing", "branch", "section", "cell", "unit", "other"]),
  parent: z.string().optional().nullable(),
  sortOrder: z.coerce.number().optional(),
  headDesignation: z.string().optional(),
  description: z.string().optional(),
  isActive: z.coerce.boolean().default(true),
});

const OrganizationUnitForm = ({
  defaultValues,
  onSubmit,
  parentOptions = [],
  submitLabel = "Save Unit",
}) => {
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
      type: "office",
      parent: "",
      sortOrder: 0,
      headDesignation: "",
      description: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (defaultValues) reset(defaultValues);
  }, [defaultValues, reset]);

  const submit = (values) =>
    onSubmit({
      ...values,
      parent: values.parent || null,
      code: values.code || "",
      headDesignation: values.headDesignation || "",
      description: values.description || "",
    });

  return (
    <form className="space-y-4" onSubmit={handleSubmit(submit)}>
      <div>
        <label className="label-shell">Unit Name</label>
        <input className="input-shell" {...register("name")} placeholder="O/O Finance Secretary" />
        {errors.name ? <p className="mt-2 text-xs text-danger">{errors.name.message}</p> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label-shell">Code</label>
          <input className="input-shell" {...register("code")} placeholder="OOFS" />
        </div>
        <div>
          <label className="label-shell">Sort Order</label>
          <input className="input-shell" type="number" {...register("sortOrder")} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label-shell">Type</label>
          <select className="input-shell" {...register("type")}>
            {organizationUnitTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-shell">Parent Unit</label>
          <select className="input-shell" {...register("parent")}>
            <option value="">No parent</option>
            {parentOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label-shell">Head Designation</label>
        <input className="input-shell" {...register("headDesignation")} placeholder="Special Secretary Budget" />
      </div>

      <div>
        <label className="label-shell">Description</label>
        <textarea className="input-shell min-h-28" {...register("description")} placeholder="Optional notes" />
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

export default OrganizationUnitForm;
