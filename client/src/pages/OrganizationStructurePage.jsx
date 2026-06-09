import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  CopyPlus,
  Layers3,
  Move,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import PageHeader from "@/components/layout/PageHeader";
import MetricCard from "@/components/common/MetricCard";
import Modal from "@/components/common/Modal";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import SearchInput from "@/components/common/SearchInput";
import StatusBadge from "@/components/common/StatusBadge";
import OrganizationUnitForm, { organizationUnitTypeOptions } from "@/components/forms/OrganizationUnitForm";
import { organizationUnitService } from "@/services/organizationUnitService";
import { useAuth } from "@/hooks/useAuth";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { flattenUnitTree, buildUnitLabel } from "@/utils/organizationUnit";
import { notifyResourceChanged } from "@/utils/resourceEvents";

const emptyUnit = {
  name: "",
  code: "",
  type: "office",
  parent: "",
  sortOrder: 0,
  headDesignation: "",
  description: "",
  isActive: true,
};

const collectDescendantIds = (node) => {
  const ids = [];
  const visit = (current) => {
    (current.children || []).forEach((child) => {
      ids.push(child.id);
      visit(child);
    });
  };
  visit(node);
  return ids;
};

const filterTree = (nodes = [], search = "", typeFilter = "") => {
  const text = search.trim().toLowerCase();

  const visit = (node) => {
    const selfMatches =
      !text ||
      [node.name, node.code, node.type, node.path, node.headDesignation]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(text));
    const typeMatches = !typeFilter || node.type === typeFilter;
    const children = (node.children || []).map(visit).filter(Boolean);
    if (!selfMatches && !children.length) return null;
    if (typeFilter && !typeMatches && !children.length) return null;
    return {
      ...node,
      children,
      selfMatches,
    };
  };

  return nodes.map(visit).filter(Boolean);
};

const OrganizationNode = ({
  node,
  depth,
  expandedIds,
  onToggle,
  onAddChild,
  onEdit,
  onDelete,
  onMove,
  onQuickMove,
  searchActive,
}) => {
  const hasChildren = Boolean(node.children?.length);
  const isExpanded = searchActive || expandedIds.has(node.id);

  return (
    <div className="space-y-3">
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[1.75rem] border border-border bg-surface/95 p-4 shadow-soft"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <button
              type="button"
              className="mt-1 flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-surface text-foreground/80 transition hover:bg-muted"
              onClick={() => hasChildren && onToggle(node.id)}
            >
              {hasChildren ? isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" /> : <span className="h-2 w-2 rounded-full bg-muted-foreground" />}
            </button>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-lg font-bold text-foreground">{node.name}</h3>
                <StatusBadge value={node.type} />
                <StatusBadge value={String(node.isActive)} />
              </div>
              <p className="mt-1 truncate text-sm text-muted-foreground">{node.path || node.name}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border border-border bg-surface px-3 py-1">Level {node.level ?? 0}</span>
                <span className="rounded-full border border-border bg-surface px-3 py-1">Employees {node.employeeCount || 0}</span>
                <span className="rounded-full border border-border bg-surface px-3 py-1">Seats {node.seatCount || 0}</span>
                {node.code ? <span className="rounded-full border border-border bg-surface px-3 py-1">Code {node.code}</span> : null}
                {node.headDesignation ? <span className="rounded-full border border-border bg-surface px-3 py-1">Head {node.headDesignation}</span> : null}
              </div>
            </div>
          </div>

          {onEdit || onDelete || onAddChild || onMove || onQuickMove ? <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {onAddChild ? (
            <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={() => onAddChild(node)}>
              <CopyPlus className="h-4 w-4" />
              Add Child
            </button>
            ) : null}
            {onEdit ? (
            <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={() => onEdit(node)}>
              Edit
            </button>
            ) : null}
            {onMove ? (
            <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={() => onMove(node)}>
              <Move className="h-4 w-4" />
              Move
            </button>
            ) : null}
            {onQuickMove ? (
            <>
            <button type="button" className="btn-ghost px-3 py-2 text-xs" onClick={() => onQuickMove(node, "up")}>
              <ArrowUp className="h-4 w-4" />
              Up
            </button>
            <button type="button" className="btn-ghost px-3 py-2 text-xs" onClick={() => onQuickMove(node, "down")}>
              <ArrowDown className="h-4 w-4" />
              Down
            </button>
            </>
            ) : null}
            {onDelete ? (
            <button type="button" className="btn-ghost px-3 py-2 text-xs text-danger" onClick={() => onDelete(node)}>
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
            ) : null}
          </div> : null}
        </div>
      </motion.div>

      <AnimatePresence>
        {isExpanded && hasChildren ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3 border-l border-dashed border-border pl-4"
          >
            {node.children.map((child) => (
              <OrganizationNode
                key={child.id}
                node={child}
                depth={depth + 1}
                expandedIds={expandedIds}
                onToggle={onToggle}
                onAddChild={onAddChild}
                onEdit={onEdit}
                onDelete={onDelete}
                onMove={onMove}
                onQuickMove={onQuickMove}
                searchActive={searchActive}
              />
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

const OrganizationStructurePage = () => {
  const { user } = useAuth();
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("true");
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [presetParent, setPresetParent] = useState("");
  const [moveTarget, setMoveTarget] = useState(null);
  const [moveParent, setMoveParent] = useState("");
  const [moveSortOrder, setMoveSortOrder] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [moving, setMoving] = useState(false);
  const canManageStructure = ["super_admin", "admin"].includes(user?.role);

  const flatUnits = useMemo(() => flattenUnitTree(units), [units]);
  const filteredUnits = useMemo(() => filterTree(units, searchTerm, typeFilter), [searchTerm, typeFilter, units]);
  const filteredFlatUnits = useMemo(() => flattenUnitTree(filteredUnits), [filteredUnits]);

  const availableParentOptions = useMemo(() => {
    const blocked = new Set(moveTarget ? [moveTarget.id, ...collectDescendantIds(moveTarget)] : []);
    return flatUnits
      .filter((unit) => !blocked.has(unit.id))
      .map((unit) => ({
        value: String(unit.id),
        label: `${unit.path || unit.name}${unit.code ? ` (${unit.code})` : ""}`,
      }));
  }, [flatUnits, moveTarget]);

  const counts = useMemo(() => {
    const totalUnits = filteredFlatUnits.length;
    const topLevelUnits = filteredFlatUnits.filter((unit) => (unit.level || 0) === 0).length;
    const linkedEmployees = filteredFlatUnits.reduce((sum, unit) => sum + Number(unit.directEmployeeCount || 0), 0);
    const linkedSeats = filteredFlatUnits.reduce((sum, unit) => sum + Number(unit.directSeatCount || 0), 0);
    return [
      { label: "Units", value: totalUnits, icon: Layers3 },
      { label: "Top Level", value: topLevelUnits, icon: Layers3 },
      { label: "Linked Employees", value: linkedEmployees, icon: Search },
      { label: "Linked Seats", value: linkedSeats, icon: Search },
    ];
  }, [filteredFlatUnits]);

  const loadUnits = async () => {
    setLoading(true);
    try {
      const response = await organizationUnitService.tree({ isActive: statusFilter });
      const tree = response.data.data || [];
      setUnits(tree);
      setExpandedIds(new Set(tree.map((item) => item.id)));
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load organization structure"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUnits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    if (moveTarget) {
      setMoveParent(moveTarget.parent || "");
      setMoveSortOrder(moveTarget.sortOrder || 0);
    }
  }, [moveTarget]);

  const openCreateTopLevel = () => {
    setEditingUnit(null);
    setPresetParent("");
    setEditorOpen(true);
  };

  const openCreateChild = (node) => {
    setEditingUnit(null);
    setPresetParent(node.id);
    setEditorOpen(true);
  };

  const openEdit = (node) => {
    setPresetParent("");
    setEditingUnit({
      ...node,
      parent: node.parent || "",
    });
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingUnit(null);
    setPresetParent("");
  };

  const handleSave = async (values) => {
    try {
      if (editingUnit) {
        await organizationUnitService.update(editingUnit.id, values);
        toast.success("Organization unit updated successfully");
      } else {
        await organizationUnitService.create(values);
        toast.success("Organization unit created successfully");
      }
      closeEditor();
      notifyResourceChanged("organization-units");
      await loadUnits();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to save organization unit"));
      throw error;
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await organizationUnitService.remove(confirmDelete.id);
      toast.success("Organization unit deleted successfully");
      setConfirmDelete(null);
      notifyResourceChanged("organization-units");
      await loadUnits();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to delete organization unit"));
    } finally {
      setDeleting(false);
    }
  };

  const handleMove = async () => {
    if (!moveTarget) return;
    setMoving(true);
    try {
      await organizationUnitService.move(moveTarget.id, {
        parent: moveParent || null,
        sortOrder: moveSortOrder === "" ? undefined : Number(moveSortOrder),
      });
      toast.success("Organization unit moved successfully");
      setMoveTarget(null);
      notifyResourceChanged("organization-units");
      await loadUnits();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to move organization unit"));
    } finally {
      setMoving(false);
    }
  };

  const handleQuickMove = async (node, direction) => {
    try {
      await organizationUnitService.move(node.id, { direction });
      toast.success("Organization unit reordered");
      notifyResourceChanged("organization-units");
      await loadUnits();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to reorder organization unit"));
    }
  };

  const toggleNode = (nodeId) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const expandAll = () => setExpandedIds(new Set(flatUnits.map((item) => item.id)));
  const collapseAll = () => setExpandedIds(new Set());

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organization Structure"
        description="Build a fully flexible hierarchy for the department. Any unit can sit at the top level or under another unit."
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={collapseAll}>
              Collapse All
            </button>
            <button type="button" className="btn-secondary" onClick={expandAll}>
              Expand All
            </button>
            <button type="button" className="btn-secondary" onClick={loadUnits}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            {canManageStructure ? <button type="button" className="btn-primary" onClick={openCreateTopLevel}>
              <Plus className="h-4 w-4" />
              Add Top Level
            </button> : null}
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {counts.map((metric) => (
          <MetricCard key={metric.label} label={metric.label} value={loading ? "..." : metric.value} icon={metric.icon} />
        ))}
      </div>

      <div className="section-shell">
        <div className="grid gap-3 xl:grid-cols-[1fr_220px_220px_220px]">
          <div className="xl:col-span-1">
            <SearchInput
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              onSearch={() => setSearchTerm((value) => value.trim())}
              placeholder="Search unit, code, or head..."
            />
          </div>
          <select className="input-shell" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="">All Types</option>
            {organizationUnitTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select className="input-shell" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
            <option value="all">All</option>
          </select>
          <div className="flex items-center justify-end">
            <span className="rounded-full border border-border bg-surface px-4 py-2 text-sm text-muted-foreground">
              {loading ? "Loading units..." : `${filteredFlatUnits.length} units visible`}
            </span>
          </div>
        </div>
      </div>

      <div className="section-shell space-y-4">
        {loading ? (
          <div className="rounded-3xl border border-dashed border-border p-8 text-sm text-muted-foreground">
            Loading organization tree...
          </div>
        ) : filteredUnits.length ? (
          filteredUnits.map((node) => (
            <OrganizationNode
              key={node.id}
              node={node}
              depth={0}
              expandedIds={expandedIds}
              onToggle={toggleNode}
              onAddChild={canManageStructure ? openCreateChild : null}
              onEdit={canManageStructure ? openEdit : null}
              onDelete={canManageStructure ? setConfirmDelete : null}
              onMove={canManageStructure ? setMoveTarget : null}
              onQuickMove={canManageStructure ? handleQuickMove : null}
              searchActive={Boolean(searchTerm.trim() || typeFilter)}
            />
          ))
        ) : (
          <div className="rounded-3xl border border-dashed border-border p-8 text-sm text-muted-foreground">
            No organization units found. Add the top-level office or department to begin.
          </div>
        )}
      </div>

      <Modal
        open={editorOpen}
        title={editingUnit ? "Edit Organization Unit" : "Add Organization Unit"}
        description="Place any office, wing, section, cell, or unit anywhere in the tree."
        onClose={closeEditor}
        size="lg"
      >
        <OrganizationUnitForm
          defaultValues={
            editingUnit || {
              ...emptyUnit,
              parent: presetParent,
            }
          }
          parentOptions={availableParentOptions}
          onSubmit={handleSave}
          submitLabel={editingUnit ? "Update Unit" : "Create Unit"}
        />
      </Modal>

      <Modal
        open={Boolean(moveTarget)}
        title={`Move ${moveTarget?.name || "Unit"}`}
        description="Change the parent unit or adjust the sort order."
        onClose={() => setMoveTarget(null)}
        size="md"
      >
        {moveTarget ? (
          <div className="space-y-4">
            <div>
              <label className="label-shell">Parent Unit</label>
              <select className="input-shell" value={moveParent} onChange={(event) => setMoveParent(event.target.value)}>
                <option value="">No parent</option>
                {availableParentOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-shell">Sort Order</label>
              <input className="input-shell" type="number" value={moveSortOrder} onChange={(event) => setMoveSortOrder(event.target.value)} />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setMoveTarget(null)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={handleMove} disabled={moving}>
                {moving ? "Moving..." : "Move Unit"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete organization unit"
        description={`Delete ${confirmDelete?.name || "this unit"}? Child units or linked employees and seats must be cleared first.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
};

export default OrganizationStructurePage;
