import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ArrowRight, BadgeDollarSign, BarChart3, Building2, Eye, EyeOff, Headphones, KeyRound, Landmark, LineChart, Lock, ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { forgotPasswordRequest, resetPasswordRequest } from "@/services/authService";
import { toast } from "sonner";

const LoginPage = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [accountMode, setAccountMode] = useState("");
  const [accountForm, setAccountForm] = useState({ email: "", code: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [accountLoading, setAccountLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [codeCooldown, setCodeCooldown] = useState(0);

  useEffect(() => {
    if (!codeCooldown) return undefined;
    const timer = window.setTimeout(() => setCodeCooldown((value) => Math.max(value - 1, 0)), 1000);
    return () => window.clearTimeout(timer);
  }, [codeCooldown]);

  if (isAuthenticated) return <Navigate to="/employees" replace />;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      await login(form);
      toast.success("Signed in successfully");
      navigate("/employees");
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to sign in"));
    } finally {
      setLoading(false);
    }
  };

  const setAccountValue = (key, value) => {
    setAccountForm((current) => ({ ...current, [key]: value }));
  };

  const showDevCode = (response) => {
    const devCode = response?.data?.meta?.devCode || response?.data?.meta?.devActivationCode;
    if (devCode) toast.info(`Development code: ${devCode}`);
  };

  const requestCode = async (purpose) => {
    if (!accountForm.email.trim()) {
      toast.error("Email is required");
      return;
    }
    setAccountLoading(true);
    try {
      const response = await forgotPasswordRequest({ email: accountForm.email });
      toast.success(response.data.message || "Code sent");
      showDevCode(response);
      setCodeCooldown(45);
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not send code"));
    } finally {
      setAccountLoading(false);
    }
  };

  const submitAccountAction = async () => {
    setAccountLoading(true);
    try {
      const response = await resetPasswordRequest({
        email: accountForm.email,
        code: accountForm.code,
        password: accountForm.password,
      });
      toast.success(response.data.message || "Password reset successful");
      setAccountMode("");
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not complete request"));
    } finally {
      setAccountLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#edf4f7_0%,#ffffff_44%,#eaf5ee_100%)] p-3 text-foreground md:p-5 lg:h-screen lg:overflow-hidden">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.12)] lg:h-full lg:min-h-0 lg:max-h-[calc(100vh-2.5rem)] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden bg-[linear-gradient(145deg,#f8fbfc_0%,#eef7f1_54%,#f9f3e4_100%)] p-5 text-foreground lg:flex lg:flex-col lg:justify-between">
          <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(15,23,42,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.05)_1px,transparent_1px)] [background-size:42px_42px]" />
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-200 bg-white text-emerald-800 shadow-sm">
                <Landmark className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-lg font-black text-foreground">Finance Department</h1>
                <p className="text-sm text-muted-foreground">Government of Punjab</p>
              </div>
            </div>

            <div className="mt-5 grid max-w-xl gap-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">HR Finance System</p>
                    <p className="mt-2 text-2xl font-black tracking-normal text-foreground">Incumbency & Staff Position</p>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                    <BadgeDollarSign className="h-6 w-6" />
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-12 items-end gap-1.5 border-t border-slate-100 pt-4">
                  {[28, 38, 30, 54, 46, 62, 44, 68, 52, 72, 58, 76].map((height, index) => (
                    <span key={index} className="rounded-t bg-emerald-500/45" style={{ height: `${height}px` }} />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-white/80 p-3 shadow-sm">
                  <LineChart className="h-5 w-5 text-emerald-700" />
                  <p className="mt-2 text-sm font-black text-foreground">Dashboard</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Staff and vacancy summaries.</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white/80 p-3 shadow-sm">
                  <Building2 className="h-5 w-5 text-amber-700" />
                  <p className="mt-2 text-sm font-black text-foreground">Office Structure</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Offices, sections, transfers.</p>
                </div>
              </div>
            </div>

            <div className="mt-5 max-w-lg">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">Punjab Finance HR</p>
              <h2 className="mt-2 text-[1.85rem] font-black leading-tight text-foreground">Incumbency Management System</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Manage employee incumbency, offices and sections, transfers, retirements, imports, public lists, and official reporting in one secure system.
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
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative z-10 inline-flex max-w-sm items-center gap-3 rounded-xl border border-slate-200 bg-white/85 px-3 py-2 shadow-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white">
              <Headphones className="h-4 w-4" />
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              <span className="font-black text-foreground">Need support?</span> Contact IT support for account access.
            </p>
          </div>
        </section>

        <section className="flex min-h-0 items-center justify-center bg-white p-4 md:p-6">
          <div className="w-full max-w-[25rem]">
            <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 lg:hidden">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Punjab Finance HR</p>
              <h1 className="mt-1 text-lg font-black text-foreground">Incumbency Management System</h1>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Employee incumbency, offices, transfers, imports, public lists, and reports.</p>
            </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.08)] md:p-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary/8 text-primary ring-8 ring-primary/5">
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

            <div className="mt-3 flex items-center justify-end gap-2 text-xs font-bold">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-primary hover:underline"
                onClick={() => {
                  setAccountMode(accountMode === "reset" ? "" : "reset");
                  setAccountForm((current) => ({ ...current, email: current.email || form.email }));
                  setCodeCooldown(0);
                }}
              >
                <KeyRound className="h-4 w-4" />
                Forgot password
              </button>
            </div>

            {accountMode ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <div className="grid gap-2">
                  <input
                    className="input-shell h-10 rounded-lg bg-white px-3 py-2 text-sm"
                    type="email"
                    value={accountForm.email}
                    onChange={(event) => setAccountValue("email", event.target.value)}
                    placeholder="Email"
                  />
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <input
                      className="input-shell h-10 rounded-lg bg-white px-3 py-2 text-sm"
                      value={accountForm.code}
                      onChange={(event) => setAccountValue("code", event.target.value)}
                      placeholder="6 digit code"
                      inputMode="numeric"
                    />
                    <button
                      type="button"
                      className="btn-secondary h-10 rounded-lg px-3 py-2 text-xs"
                      disabled={accountLoading || codeCooldown > 0}
                      onClick={requestCode}
                    >
                      {codeCooldown ? `Resend ${codeCooldown}s` : "Send code"}
                    </button>
                  </div>
                  {accountMode === "reset" ? (
                    <input
                      className="input-shell h-10 rounded-lg bg-white px-3 py-2 text-sm"
                      type="password"
                      value={accountForm.password}
                      onChange={(event) => setAccountValue("password", event.target.value)}
                      placeholder="New password"
                    />
                  ) : null}
                  <button type="button" className="btn-primary h-10 rounded-lg py-2 text-xs" disabled={accountLoading} onClick={submitAccountAction}>
                    {accountLoading ? "Please wait..." : "Reset Password"}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mt-5 text-center">
              <Link to="/public/incumbency" className="text-sm font-bold text-primary hover:underline">
                View public incumbency list without login
              </Link>
              <p className="mt-3 text-xs text-muted-foreground">Your data is protected and role restricted.</p>
            </div>
          </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default LoginPage;
