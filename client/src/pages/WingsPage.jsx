import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/layout/PageHeader";
import DataTable from "@/components/common/DataTable";
import MetricCard from "@/components/common/MetricCard";
import SearchInput from "@/components/common/SearchInput";
import StatusBadge from "@/components/common/StatusBadge";
import Modal from "@/components/common/Modal";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import WingForm from "@/components/forms/WingForm";
import { wingService } from "@/services/wingService";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { formatDate } from "@/utils/formatDate";
import { notifyResourceChanged } from "@/utils/resourceEvents";

const emptyWing = {
  name: "",
  code: "",
  description: "",
  sortOrder: 0,
  isActive: true,
};

const WingsPage = () => {
  const [wings, setWings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("true");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingWing, setEditingWing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadWings = async (params = {}) => {
    setLoading(true);
    try {
      const query = {
        limit: 500,
        sort: "sortOrder name",
        ...params,
      };

      Object.keys(query).forEach((key) => {
        if (query[key] === "" || query[key] === undefined || query[key] === null) {
          delete query[key];
        }
      });

      const response = await wingService.list(query);
      setWings(response.data.data || []);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load wings"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWings({ isActive: statusFilter, q: searchTerm.trim() || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitQuery = (nextSearch = searchTerm, nextStatus = statusFilter) => ({
    q: nextSearch.trim() || undefined,
    isActive: nextStatus,
  });

  const handleSearch = () => {
    loadWings(submitQuery());
  };

  const handleClear = () => {
    setSearchTerm("");
    setStatusFilter("true");
    loadWings(submitQuery("", "true"));
  };

  const handleOpenCreate = () => {
    setEditingWing(null);
    setEditorOpen(true);
  };

  const handleOpenEdit = (wing) => {
    setEditingWing(wing);
    setEditorOpen(true);
  };

  const handleSave = async (values) => {
    try {
      if (editingWing) {
        await wingService.update(editingWing.id, values);
        toast.success("Wing updated successfully");
      } else {
        await wingService.create(values);
        toast.success("Wing created successfully");
      }

      setEditorOpen(false);
      setEditingWing(null);
      notifyResourceChanged("wings");
      await loadWings(submitQuery());
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to save wing"));
      throw error;
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await wingService.remove(confirmDelete.id);
      toast.success("Wing deactivated successfully");
      setConfirmDelete(null);
      notifyResourceChanged("wings");
      await loadWings(submitQuery());
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to deactivate wing"));
    } finally {
      setDeleting(false);
    }
  };

  const metrics = useMemo(() => {
    const total = wings.length;
    const active = wings.filter((wing) => wing.isActive).length;
    return [
      { label: "Visible Wings", value: total },
      { label: "Active Wings", value: active },
      { label: "Inactive Wings", value: total - active },
    ];
  }, [wings]);

  const columns = [
    {
      key: "name",
      header: "Wing",
      render: (row) => (
        <div>
          <p className="font-semibold text-foreground">{row.name}</p>
          <p className="text-xs text-muted-foreground">{row.description || "No description"}</p>
        </div>
      ),
    },
    { key: "code", header: "Code", render: (row) => row.code || "-" },
    { key: "sortOrder", header: "Order", render: (row) => row.sortOrder ?? 0 },
    { key: "status", header: "Status", render: (row) => <StatusBadge value={String(row.isActive)} /> },
    { key: "createdAt", header: "Created", render: (row) => formatDate(row.createdAt) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wings"
        description="Create and manage departmental wings such as Budget Wing, Tax Wing, and Resource Wing."
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={handleClear}>
              Clear
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => loadWings(submitQuery())}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button type="button" className="btn-primary" onClick={handleOpenCreate}>
              <Plus className="h-4 w-4" />
              Add Wing
            </button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} label={metric.label} value={loading ? "..." : metric.value} />
        ))}
      </div>

      <div className="section-shell">
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <SearchInput
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            onSearch={handleSearch}
            placeholder="Search wing name or code..."
          />
          <select
            className="input-shell"
            value={statusFilter}
            onChange={async (event) => {
              const nextStatus = event.target.value;
              setStatusFilter(nextStatus);
              await loadWings(submitQuery(searchTerm, nextStatus));
            }}
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      <div className="section-shell">
        <DataTable
          loading={loading}
          data={wings}
          columns={columns}
          emptyState="No wings found. Create the first wing to begin."
          actions={(row) => (
            <div className="flex items-center justify-end gap-2">
              <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={() => handleOpenEdit(row)}>
                <Pencil className="h-4 w-4" />
                Edit
              </button>
              <button type="button" className="btn-ghost px-3 py-2 text-xs text-danger" onClick={() => setConfirmDelete(row)}>
                <Trash2 className="h-4 w-4" />
                Deactivate
              </button>
            </div>
          )}
        />
      </div>

      <Modal
        open={editorOpen}
        title={editingWing ? "Edit Wing" : "Add Wing"}
        description="Create or update a departmental wing."
        onClose={() => {
          setEditorOpen(false);
          setEditingWing(null);
        }}
      >
        <WingForm
          defaultValues={editingWing || emptyWing}
          onSubmit={handleSave}
          submitLabel={editingWing ? "Update Wing" : "Create Wing"}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Deactivate wing"
        description={`Deactivate ${confirmDelete?.name || "this wing"}? Linked records will prevent deletion if the wing is still in use.`}
        confirmLabel="Deactivate"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
};

export default WingsPage;
