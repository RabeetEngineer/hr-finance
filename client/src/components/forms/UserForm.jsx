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
        mobile: z.string().optional(),
        password: isEdit ? z.string().optional() : z.string().min(6, "Password is required"),
        role: z.enum(["super_admin", "admin", "data_entry", "viewer"]),
        isActive: z.coerce.boolean().default(true),
        isEmailVerified: z.coerce.boolean().default(false),
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
      mobile: "",
      password: "",
      role: "viewer",
      isActive: true,
      isEmailVerified: false,
    },
  });

  useEffect(() => {
    if (defaultValues) reset(defaultValues);
  }, [defaultValues, reset]);

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit((values) => {
        const payload = { ...values };
        if (isEdit && !payload.password) delete payload.password;
        onSubmit(payload);
      })}
    >
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
          <label className="label-shell">Mobile</label>
          <input className="input-shell" type="tel" {...register("mobile")} placeholder="0300 0000000" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
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
      <div className="grid gap-2 rounded-lg border border-border bg-surface-2 p-3">
        <label className="flex items-center gap-3 text-sm font-medium text-foreground/80">
          <input type="checkbox" {...register("isActive")} />
          Active / approved by super admin
        </label>
        <label className="flex items-center gap-3 text-sm font-medium text-foreground/80">
          <input type="checkbox" {...register("isEmailVerified")} />
          Email verified
        </label>
      </div>
      <button type="submit" className="btn-primary" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : submitLabel}
      </button>
    </form>
  );
};

export default UserForm;
