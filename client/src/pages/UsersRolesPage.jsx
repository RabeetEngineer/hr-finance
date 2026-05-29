import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/common/StatusBadge";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import UserForm from "@/components/forms/UserForm";
import { userService } from "@/services/userService";
import { activityLogService } from "@/services/activityLogService";
import { toast } from "sonner";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { notifyResourceChanged } from "@/utils/resourceEvents";
import { formatDateTime } from "@/utils/formatDate";

const roleCards = [
  { role: "super_admin", title: "Super Admin", detail: "Users, roles, structure, rows, delete, settings, logs" },
  { role: "admin", title: "Admin", detail: "Structure, row edit, delete, settings" },
  { role: "data_entry", title: "Data Entry", detail: "Add and edit staff rows only" },
  { role: "viewer", title: "Viewer", detail: "Read and print only" },
];

const UsersRolesPage = () => {
  const [users, setUsers] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const [usersResponse, logsResponse] = await Promise.all([
        userService.list({ limit: 500, sort: "role fullName" }),
        activityLogService.list({ limit: 20, sort: "-createdAt" }),
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

  const handleSubmit = async (payload) => {
    try {
      if (editing) {
        await userService.update(editing.id, payload);
        toast.success("User updated");
      } else {
        await userService.create(payload);
        toast.success("User created");
      }
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
      loadUsers();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to delete user"));
    } finally {
      setDeleting(false);
    }
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
          <p className="text-xs text-muted-foreground">{row.email}</p>
        </div>
      ),
    },
    { key: "role", header: "Role", render: (row) => <StatusBadge value={row.role} /> },
    { key: "isActive", header: "Status", render: (row) => <StatusBadge value={String(row.isActive)} /> },
    {
      key: "lastLoginAt",
      header: "Last Login",
      render: (row) => formatDateTime(row.lastLoginAt),
    },
    {
      key: "updatedAt",
      header: "Updated",
      render: (row) => formatDateTime(row.updatedAt),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Users & Roles" description="Assign clean access levels and review recent system activity." />

      <div className="grid gap-3 md:grid-cols-4">
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

      <div className="grid gap-4 xl:grid-cols-[390px_1fr]">
        <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold">{editing ? "Edit User" : "Create User"}</h3>
              <p className="text-sm text-muted-foreground">Login, role, and active status.</p>
            </div>
            {editing ? (
              <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>
                Reset
              </button>
            ) : null}
          </div>
          <UserForm
            defaultValues={editing || undefined}
            onSubmit={handleSubmit}
            submitLabel={editing ? "Update User" : "Create User"}
            isEdit={Boolean(editing)}
          />
        </section>

        <section className="rounded-lg border border-border bg-surface p-3 shadow-sm">
          <DataTable
            loading={loading}
            data={users}
            columns={columns}
            actions={(row) => (
              <div className="flex items-center justify-end gap-2">
                <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={() => setEditing(row)}>
                  Edit
                </button>
                <button type="button" className="btn-ghost px-3 py-2 text-xs text-danger" onClick={() => setConfirmDelete(row)}>
                  Delete
                </button>
              </div>
            )}
            emptyState="No users have been created yet."
          />
        </section>
      </div>

      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">Recent Activity</h3>
            <p className="text-sm text-muted-foreground">Latest creates, edits, deletes, logins, and role changes.</p>
          </div>
        </div>
        <div className="overflow-auto">
          <table className="incumbency-table w-full min-w-[760px] border-collapse text-xs">
            <thead>
              <tr>
                <th>Time</th>
                <th>User</th>
                <th>Action</th>
                <th>Area</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {activityLogs.length ? (
                activityLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDateTime(log.createdAt)}</td>
                    <td>
                      <span className="font-semibold">{log.actorUser?.fullName || "System"}</span>
                      {log.actorUser?.role ? <span className="ml-2 text-muted-foreground">{log.actorUser.role.replaceAll("_", " ")}</span> : null}
                    </td>
                    <td className="capitalize">{log.action}</td>
                    <td>{log.entityType}</td>
                    <td>{log.summary}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted-foreground">
                    No recent activity found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete user"
        description={`Delete ${confirmDelete?.fullName || "this user"} from the system?`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
};

export default UsersRolesPage;
