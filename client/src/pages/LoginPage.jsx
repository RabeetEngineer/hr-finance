import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ArrowRight, BarChart3, Eye, EyeOff, Headphones, Lock, ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { toast } from "sonner";

const LoginPage = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

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
    <div className="flex min-h-screen overflow-hidden bg-[#f3f7fb] p-3 text-foreground md:h-screen md:p-5">
      <div className="mx-auto grid h-full max-h-[calc(100vh-2.5rem)] w-full max-w-6xl overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.10)] lg:grid-cols-[1fr_0.9fr]">
        <section className="relative hidden overflow-hidden bg-[linear-gradient(145deg,#eef8ff_0%,#ffffff_48%,#f7fbff_100%)] p-5 lg:flex lg:flex-col lg:justify-between">
          <div className="pointer-events-none absolute -bottom-24 -left-20 h-72 w-72 rounded-full border border-blue-100/80" />
          <div className="pointer-events-none absolute -right-24 -top-20 h-80 w-80 rounded-full border border-blue-100/80" />

          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-200 bg-white text-emerald-800 shadow-sm">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-lg font-black text-foreground">Finance Department</h1>
                <p className="text-sm text-muted-foreground">Government of Punjab</p>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
              <div className="relative h-36 bg-[linear-gradient(180deg,#dff2ff_0%,#f8fcff_62%,#e8f1f8_100%)]">
                <div className="absolute left-10 top-8 h-24 w-1 rounded bg-slate-400" />
                <div className="absolute left-11 top-9 h-10 w-16 overflow-hidden rounded-r-[1.5rem] bg-[#126b45] shadow-md">
                  <div className="absolute left-5 top-3 h-5 w-5 rounded-full border-2 border-white" />
                  <div className="absolute left-8 top-4 h-2 w-2 rotate-45 bg-white" />
                </div>
                <div className="absolute bottom-0 left-8 right-8 h-20 rounded-t-lg border border-slate-200 bg-white/94 shadow-sm">
                  <div className="absolute -top-5 left-0 right-0 mx-auto h-8 w-48 rounded-t-full border border-slate-200 bg-white" />
                  <div className="grid h-full grid-cols-7 gap-2 px-8 pt-7">
                    {Array.from({ length: 7 }).map((_, index) => (
                      <div key={index} className="rounded-t-md bg-slate-200" />
                    ))}
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent" />
              </div>
            </div>

            <div className="mt-4 max-w-lg">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">Digital HR</p>
              <h2 className="mt-1 text-[1.7rem] font-black leading-tight text-foreground">Management System</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                A centralized solution for managing incumbency, transfers, retirements, public viewing, and departmental reporting.
              </p>
            </div>

            <div className="mt-4 grid max-w-md gap-2">
              {[
                { icon: ShieldCheck, title: "Secure & Reliable", detail: "Role based departmental access" },
                { icon: BarChart3, title: "Smart Analytics", detail: "Real-time summaries and exports" },
                { icon: UserRound, title: "User Friendly", detail: "Designed for daily government office use" },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-white shadow-sm">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-black">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative z-10 inline-flex max-w-sm items-center gap-3 rounded-xl border border-slate-200 bg-white/88 px-3 py-2 shadow-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white">
              <Headphones className="h-4 w-4" />
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              <span className="font-black text-foreground">Need support?</span> Contact IT support for account access.
            </p>
          </div>
        </section>

        <section className="flex min-h-0 items-center justify-center bg-white p-4 md:p-6">
          <div className="w-full max-w-[25rem] rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/8 text-primary ring-8 ring-primary/5">
              <Lock className="h-7 w-7" />
            </div>
            <div className="mt-4 text-center">
              <h2 className="text-2xl font-black text-foreground">Welcome Back</h2>
              <p className="mt-1 text-sm text-muted-foreground">Sign in to your account to continue</p>
            </div>

            <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-foreground/85">Email</span>
                <div className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3 transition focus-within:border-primary focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(13,94,57,0.10)]">
                  <UserRound className="h-5 w-5 text-slate-400 transition group-focus-within:text-primary" />
                  <input
                    className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                    placeholder="Enter your email"
                    autoComplete="email"
                  />
                </div>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-foreground/85">Password</span>
                <div className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3 transition focus-within:border-primary focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(13,94,57,0.10)]">
                  <Lock className="h-5 w-5 text-slate-400 transition group-focus-within:text-primary" />
                  <input
                    className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                  />
                  <button type="button" className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-primary" onClick={() => setShowPassword((value) => !value)}>
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </label>
              <button type="submit" className="btn-primary w-full rounded-xl py-3 text-sm shadow-[0_12px_24px_rgba(13,94,57,0.18)]" disabled={loading}>
                <ArrowRight className="h-5 w-5" />
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <div className="mt-5 text-center">
              <Link to="/public/incumbency" className="text-sm font-bold text-primary hover:underline">
                View public incumbency list without login
              </Link>
              <p className="mt-3 text-xs text-muted-foreground">Your data is protected and role restricted.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default LoginPage;
