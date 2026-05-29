import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Building2, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { toast } from "sonner";

const LoginPage = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      await login(form);
      toast.success("Signed in successfully");
      navigate("/dashboard");
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to sign in"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-grid-fade px-4 py-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl overflow-hidden rounded-[2rem] border border-border bg-surface/80 shadow-soft backdrop-blur md:grid-cols-2">
        <div className="relative flex flex-col justify-between overflow-hidden bg-primary p-8 text-primary-foreground md:p-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(20,184,166,0.28),transparent_34%)]" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em]">
              <Sparkles className="h-4 w-4" />
              Government of Punjab
            </div>
            <h1 className="mt-8 max-w-xl text-4xl font-bold leading-tight md:text-5xl">
              HR Incumbency Management for Finance Department
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-white/78">
              Centralize staff incumbency, office hierarchy, seat occupancy, posting history, and reports in one premium government-ready system.
            </p>
          </div>

          <div className="relative z-10 grid gap-4 sm:grid-cols-2">
            {[
              { label: "Secure access", value: "JWT + RBAC", icon: ShieldCheck },
              { label: "Official UI", value: "Print-ready layouts", icon: Building2 },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                  <Icon className="h-5 w-5" />
                  <p className="mt-3 text-sm font-medium text-white/70">{item.label}</p>
                  <p className="mt-1 text-lg font-bold">{item.value}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-center p-6 md:p-12">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="w-full max-w-md rounded-[1.75rem] border border-border bg-surface p-6 shadow-soft md:p-8"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Secure Portal</p>
              <h2 className="mt-2 text-3xl font-bold text-foreground">Sign in</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Use your departmental account to manage incumbency data, reports, and seat workflows.
              </p>
            </div>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <div>
                <label className="label-shell">Email</label>
                <input
                  className="input-shell"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="admin@punjab.gov.pk"
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="label-shell">Password</label>
                <input
                  className="input-shell"
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
              Access restricted to authorized departmental staff.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

