import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Eye, KeyRound, Plus } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/common/StatusBadge";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import Modal from "@/components/common/Modal";
import UserForm from "@/components/forms/UserForm";
import ActivityTimeline from "@/components/common/ActivityTimeline";
import { userService } from "@/services/userService";
import { activityLogService } from "@/services/activityLogService";
import { toast } from "sonner";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { notifyResourceChanged } from "@/utils/resourceEvents";
import { formatDateTime } from "@/utils/formatDate";
import { useAuth } from "@/hooks/useAuth";

const roleCards = [
  { role: "super_admin", title: "Super Admin", detail: "Full system access, users, roles, settings, imports, logs" },
  { role: "admin", title: "Admin", detail: "Structure, employees, lists, dashboard, import/export" },
  { role: "data_entry", title: "Data Entry", detail: "Add, edit, and transfer employee rows" },
  { role: "viewer", title: "Viewer", detail: "Read-only dashboard, lists, and incumbency sheet" },
];

const UsersRolesPage = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPassword, setResetPassword] = useState("");
  const [viewTarget, setViewTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState("");

  const loadUsers = async () => {
    setLoading(true);
    try {
      const [usersResponse, logsResponse] = await Promise.all([
        userService.list({ limit: 500, sort: "role fullName" }),
        activityLogService.recent({ limit: 20 }),
      ]);
      setUsers(usersResponse.data.data || []);
      setActivityLogs(logsResponse.data.data || []);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load users"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setEditorOpen(true);
  };

  const handleSubmit = async (payload) => {
    try {
      if (editing) {
        await userService.update(editing.id, payload);
        toast.success("User updated");
      } else {
        await userService.create(payload);
        toast.success("User created");
      }
      setEditorOpen(false);
      setEditing(null);
      notifyResourceChanged("users");
      await loadUsers();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to save user"));
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await userService.remove(confirmDelete.id);
      toast.success("User deleted");
      setConfirmDelete(null);
      notifyResourceChanged("users");
      await loadUsers();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to delete user"));
    } finally {
      setDeleting(false);
    }
  };

  const runUserAction = async (key, action, successMessage) => {
    setActionLoading(key);
    try {
      const response = await action();
      toast.success(response.data.message || successMessage);
      const devCode = response.data.meta?.devActivationCode || response.data.meta?.devCode;
      if (devCode) toast.info(`Development code: ${devCode}`);
      notifyResourceChanged("users");
      await loadUsers();
    } catch (error) {
      toast.error(getErrorMessage(error, successMessage));
    } finally {
      setActionLoading("");
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    if (resetPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    await runUserAction(
      `reset-${resetTarget.id}`,
      () => userService.resetPassword(resetTarget.id, { password: resetPassword }),
      "Password reset"
    );
    setResetTarget(null);
    setResetPassword("");
  };

  const roleCounts = useMemo(
    () =>
      users.reduce((counts, user) => {
        counts[user.role] = (counts[user.role] || 0) + 1;
        return counts;
      }, {}),
    [users]
  );

  const columns = [
    {
      key: "fullName",
      header: "User",
      render: (row) => (
        <div>
          <p className="font-semibold">{row.fullName}</p>
          <p className="text-xs text-muted-foreground">{row.id === currentUser?.id ? "Current account" : "Managed user"}</p>
        </div>
      ),
    },
    { key: "email", header: "Email" },
    { key: "mobile", header: "Mobile", render: (row) => row.mobile || "-" },
    { key: "role", header: "Role", render: (row) => <StatusBadge value={row.role} /> },
    { key: "isActive", header: "Status", render: (row) => <StatusBadge value={row.isActive ? "active" : "inactive"} /> },
    { key: "isEmailVerified", header: "Email Verified", render: (row) => <StatusBadge value={row.isEmailVerified ? "verified" : "pending"} /> },
    { key: "lastLoginAt", header: "Last Login", render: (row) => formatDateTime(row.lastLoginAt) },
    { key: "updatedAt", header: "Updated", render: (row) => formatDateTime(row.updatedAt) },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Users & Roles"
        description="Manage verified accounts, role permissions, and recent user activity."
        actions={
          <button type="button" className="btn-primary" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Create User
          </button>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {roleCards.map((card) => (
          <div key={card.role} className="rounded-lg border border-border bg-surface px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold">{card.title}</p>
              <span className="rounded-md bg-muted px-2 py-1 text-xs font-bold">{roleCounts[card.role] || 0}</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{card.detail}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="rounded-lg border border-border bg-surface p-3 shadow-sm">
          <DataTable
            loading={loading}
            data={users}
            columns={columns}
            actions={(row) => {
              const isSelf = row.id === currentUser?.id;
              return (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={() => setViewTarget(row)}>
                    <Eye className="h-3.5 w-3.5" />
                    View
                  </button>
                  <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={() => openEdit(row)}>
                    Edit
                  </button>
                  {!row.isEmailVerified ? (
                    <button
                      type="button"
                      className="btn-secondary px-3 py-2 text-xs"
                      disabled={Boolean(actionLoading)}
                      onClick={() => runUserAction(`activate-${row.id}`, () => userService.activate(row.id), "User activated")}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Activate
                    </button>
                  ) : null}
                  {!row.isEmailVerified ? (
                    <button
                      type="button"
                      className="btn-secondary px-3 py-2 text-xs"
                      disabled={Boolean(actionLoading)}
                      onClick={() => runUserAction(`send-${row.id}`, () => userService.resendActivation(row.id), "Activation code sent")}
                    >
                      Send Code
                    </button>
                  ) : null}
                  <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={() => setResetTarget(row)}>
                    <KeyRound className="h-3.5 w-3.5" />
                    Reset
                  </button>
                  <button type="button" className="btn-ghost px-3 py-2 text-xs text-danger" disabled={isSelf} onClick={() => setConfirmDelete(row)}>
                    Delete
                  </button>
                </div>
              );
            }}
            emptyState="No users have been created yet."
          />
        </section>

        <ActivityTimeline logs={activityLogs} loading={loading} compact />
      </div>

      <Modal
        open={editorOpen}
        title={editing ? "Edit User" : "Create User"}
        description={editing ? "Update profile, role, and account status." : "Create a real email account and send an activation code."}
        onClose={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        size="lg"
      >
        <UserForm
          defaultValues={editing || undefined}
          onSubmit={handleSubmit}
          submitLabel={editing ? "Update User" : "Create User"}
          isEdit={Boolean(editing)}
        />
      </Modal>

      <Modal open={Boolean(resetTarget)} title="Reset Password" description={`Set a new password for ${resetTarget?.fullName || "this user"}.`} onClose={() => setResetTarget(null)} size="sm">
        <div className="space-y-4">
          <input className="input-shell" type="password" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} placeholder="New password" />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setResetTarget(null)}>
              Cancel
            </button>
            <button type="button" className="btn-primary" disabled={Boolean(actionLoading)} onClick={handleResetPassword}>
              Reset Password
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(viewTarget)} title="User Details" description="Account profile and verification status." onClose={() => setViewTarget(null)} size="sm">
        {viewTarget ? (
          <div className="space-y-3 text-sm">
            {[
              ["Name", viewTarget.fullName],
              ["Email", viewTarget.email],
              ["Mobile", viewTarget.mobile || "-"],
              ["Role", viewTarget.role.replaceAll("_", " ")],
              ["Active", viewTarget.isActive ? "Yes" : "No"],
              ["Email Verified", viewTarget.isEmailVerified ? "Yes" : "No"],
              ["Last Login", formatDateTime(viewTarget.lastLoginAt)],
              ["Updated", formatDateTime(viewTarget.updatedAt)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 rounded-md bg-surface-2 px-3 py-2">
                <span className="font-bold text-muted-foreground">{label}</span>
                <span className="text-right font-semibold capitalize">{value}</span>
              </div>
            ))}
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete user"
        description={`Delete ${confirmDelete?.fullName || "this user"} from the system? This action cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
};

export default UsersRolesPage;
