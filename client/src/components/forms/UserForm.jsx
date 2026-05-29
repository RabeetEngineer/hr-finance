import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { roleOptions } from "@/constants/statusOptions";

const UserForm = ({ defaultValues, onSubmit, submitLabel = "Save User", isEdit = false }) => {
  const schema = useMemo(
    () =>
      z.object({
        fullName: z.string().min(2, "Full name is required"),
        email: z.string().email("Enter a valid email"),
        password: isEdit ? z.string().optional() : z.string().min(6, "Password is required"),
        role: z.enum(["super_admin", "admin", "data_entry", "viewer"]),
        isActive: z.coerce.boolean().default(true),
      }),
    [isEdit]
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: defaultValues || {
      fullName: "",
      email: "",
      password: "",
      role: "viewer",
      isActive: true,
    },
  });

  useEffect(() => {
    if (defaultValues) reset(defaultValues);
  }, [defaultValues, reset]);

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label className="label-shell">Full Name</label>
        <input className="input-shell" {...register("fullName")} placeholder="Muhammad Ali" />
        {errors.fullName ? <p className="mt-2 text-xs text-danger">{errors.fullName.message}</p> : null}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label-shell">Email</label>
          <input className="input-shell" type="email" {...register("email")} placeholder="user@punjab.gov.pk" />
        </div>
        <div>
          <label className="label-shell">Password {isEdit ? "(leave blank to keep current)" : ""}</label>
          <input className="input-shell" type="password" {...register("password")} placeholder="••••••••" />
        </div>
      </div>
      <div>
        <label className="label-shell">Role</label>
        <select className="input-shell" {...register("role")}>
          {roleOptions.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </select>
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

export default UserForm;
