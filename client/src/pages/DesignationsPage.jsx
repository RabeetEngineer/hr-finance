import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/layout/PageHeader";
import DataTable from "@/components/common/DataTable";
import SearchInput from "@/components/common/SearchInput";
import StatusBadge from "@/components/common/StatusBadge";
import Modal from "@/components/common/Modal";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import DesignationForm from "@/components/forms/DesignationForm";
import { designationService } from "@/services/designationService";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { formatDate } from "@/utils/formatDate";
import { notifyResourceChanged } from "@/utils/resourceEvents";

const emptyDesignation = {
  name: "",
  bps: "",
  service: "",
  category: "official",
  sortOrder: 0,
  isActive: true,
};

const DesignationsPage = () => {
  const [designations, setDesignations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("true");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingDesignation, setEditingDesignation] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadDesignations = async (params = {}) => {
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

      const response = await designationService.list(query);
      setDesignations(response.data.data || []);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load designations"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDesignations({ isActive: statusFilter, q: searchTerm.trim() || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const query = (nextSearch = searchTerm, nextStatus = statusFilter) => ({
    q: nextSearch.trim() || undefined,
    isActive: nextStatus,
  });

  const handleSearch = () => {
    loadDesignations(query());
  };

  const handleClear = () => {
    setSearchTerm("");
    setStatusFilter("true");
    loadDesignations(query("", "true"));
  };

  const handleOpenCreate = () => {
    setEditingDesignation(null);
    setEditorOpen(true);
  };

  const handleOpenEdit = (designation) => {
    setEditingDesignation(designation);
    setEditorOpen(true);
  };

  const handleSave = async (values) => {
    try {
      if (editingDesignation) {
        await designationService.update(editingDesignation.id, values);
        toast.success("Designation updated successfully");
      } else {
        await designationService.create(values);
        toast.success("Designation created successfully");
      }

      setEditorOpen(false);
      setEditingDesignation(null);
      notifyResourceChanged("designations");
      await loadDesignations(query());
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to save designation"));
      throw error;
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await designationService.remove(confirmDelete.id);
      toast.success("Designation deactivated successfully");
      setConfirmDelete(null);
      notifyResourceChanged("designations");
      await loadDesignations(query());
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to deactivate designation"));
    } finally {
      setDeleting(false);
    }
  };

  const metrics = useMemo(() => {
    const total = designations.length;
    return [
      { label: "Visible Designations", value: total },
      { label: "Active", value: designations.filter((designation) => designation.isActive !== false).length },
      { label: "With Service", value: designations.filter((designation) => designation.service).length },
      { label: "Inactive", value: designations.filter((designation) => designation.isActive === false).length },
    ];
  }, [designations]);

  const columns = [
    {
      key: "name",
      header: "Designation",
      render: (row) => (
        <div>
          <p className="font-semibold text-foreground">{row.name}</p>
          <p className="text-xs text-muted-foreground">{row.service || "Used in employee entry dropdown"}</p>
        </div>
      ),
    },
    { key: "bps", header: "BPS / Grade", render: (row) => row.bps || "-" },
    { key: "service", header: "Service", render: (row) => row.service || "-" },
    { key: "status", header: "Status", render: (row) => <StatusBadge value={String(row.isActive)} /> },
    { key: "createdAt", header: "Created", render: (row) => formatDate(row.createdAt) },
  ];

  return (
    <div className="space-y-3">
      <PageHeader
        title="Designations"
        description="Add approved designations first; employee rows can only select from this list."
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={handleClear}>
              Clear
            </button>
            <button type="button" className="btn-secondary" onClick={() => loadDesignations(query())}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button type="button" className="btn-primary" onClick={handleOpenCreate}>
              <Plus className="h-4 w-4" />
              Add Designation
            </button>
          </>
        }
      />

      <div className="grid gap-3 md:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-lg border border-border bg-surface px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{metric.label}</p>
            <p className="mt-1 text-xl font-black">{loading ? "..." : metric.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-surface p-3 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <SearchInput
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            onSearch={handleSearch}
            placeholder="Search designation or BPS..."
          />
          <select
            className="input-shell"
            value={statusFilter}
            onChange={async (event) => {
              const nextStatus = event.target.value;
              setStatusFilter(nextStatus);
              await loadDesignations(query(searchTerm, nextStatus));
            }}
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-3 shadow-sm">
        <DataTable
          loading={loading}
          data={designations}
          columns={columns}
          emptyState="No designations found. Create the first designation to begin."
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
        title={editingDesignation ? "Edit Designation" : "Add Designation"}
        description="Create or update a designation used for incumbency records."
        onClose={() => {
          setEditorOpen(false);
          setEditingDesignation(null);
        }}
      >
        <DesignationForm
          defaultValues={editingDesignation || emptyDesignation}
          onSubmit={handleSave}
          submitLabel={editingDesignation ? "Update Designation" : "Create Designation"}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Deactivate designation"
        description={`Deactivate ${confirmDelete?.name || "this designation"}? Linked seats or employees will prevent deletion if they still exist.`}
        confirmLabel="Deactivate"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
};

export default DesignationsPage;
