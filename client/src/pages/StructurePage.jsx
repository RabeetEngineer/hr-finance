import { useEffect, useMemo, useState } from "react";
import { Building2, ChevronDown, ChevronUp, GitBranch, Layers, MoveVertical, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import Modal from "@/components/common/Modal";
import { organizationUnitService } from "@/services/organizationUnitService";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { notifyResourceChanged } from "@/utils/resourceEvents";
import { toast } from "sonner";

const clean = (value) => String(value || "").trim();
const getId = (item) => item?.id || item?._id || item || "";

const compactUnitName = (unit) => {
  const code = clean(unit?.code);
  if (code) return code;

  return clean(unit?.name)
    .replace(/^O\/O\s+/i, "")
    .replace(/\bAdditional\b/gi, "Addl.")
    .replace(/\bDeputy\b/gi, "Dy.")
    .replace(/\bSecretary\b/gi, "Secy")
    .replace(/\bFinance\b/gi, "Fin.")
    .replace(/\s+/g, " ");
};

const buildTree = (units) => {
  const byId = new Map(units.map((unit) => [String(getId(unit)), { ...unit, children: [] }]));
  const roots = [];

  byId.forEach((unit) => {
    const parentId = getId(unit.parent || unit.parentOfficeSection);
    const parent = parentId ? byId.get(String(parentId)) : null;
    if (parent) {
      parent.children.push(unit);
    } else {
      roots.push(unit);
    }
  });

  const sortBranch = (items) =>
    items
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || compactUnitName(a).localeCompare(compactUnitName(b)))
      .map((item) => ({ ...item, children: sortBranch(item.children || []) }));

  return sortBranch(roots);
};

const blankForm = { id: "", name: "", code: "", parent: "" };

const levelStyles = [
  {
    card: "border-slate-300 bg-slate-50",
    icon: "bg-slate-900 text-white",
    badge: "bg-slate-200 text-slate-700",
    child: "bg-emerald-100 text-emerald-800",
  },
  {
    card: "border-emerald-200 bg-emerald-50/65",
    icon: "bg-emerald-700 text-white",
    badge: "bg-emerald-100 text-emerald-800",
    child: "bg-teal-100 text-teal-800",
  },
  {
    card: "border-blue-200 bg-blue-50/65",
    icon: "bg-blue-700 text-white",
    badge: "bg-blue-100 text-blue-800",
    child: "bg-cyan-100 text-cyan-800",
  },
  {
    card: "border-violet-200 bg-violet-50/65",
    icon: "bg-violet-700 text-white",
    badge: "bg-violet-100 text-violet-800",
    child: "bg-fuchsia-100 text-fuchsia-800",
  },
  {
    card: "border-orange-200 bg-orange-50/70",
    icon: "bg-orange-600 text-white",
    badge: "bg-orange-100 text-orange-800",
    child: "bg-amber-100 text-amber-800",
  },
];

const styleForDepth = (depth, hasChildren) =>
  hasChildren ? levelStyles[Math.min(depth, levelStyles.length - 1)] : {
    card: "border-border bg-white",
    icon: "bg-surface-2 text-primary",
    badge: "bg-muted text-muted-foreground",
    child: "bg-muted text-muted-foreground",
  };

const metricCards = [
  {
    label: "Total",
    key: "total",
    helper: "Offices and sections",
    icon: Layers,
    className: "border-slate-200 bg-slate-50 text-slate-900",
    iconClass: "bg-slate-900 text-white",
  },
  {
    label: "Top Level",
    key: "roots",
    helper: "Main offices",
    icon: Building2,
    className: "border-blue-200 bg-blue-50 text-blue-950",
    iconClass: "bg-blue-700 text-white",
  },
  {
    label: "Under Parents",
    key: "children",
    helper: "Nested sections",
    icon: GitBranch,
    className: "border-violet-200 bg-violet-50 text-violet-950",
    iconClass: "bg-violet-700 text-white",
  },
];

const StructurePage = () => {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadUnits = async () => {
    setLoading(true);
    try {
      const response = await organizationUnitService.list({ limit: 1000, isActive: "true", sort: "sortOrder name" });
      setUnits(response.data.data || []);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load structure"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUnits();
  }, []);

  const tree = useMemo(() => buildTree(units), [units]);
  const unitMap = useMemo(() => new Map(units.map((unit) => [String(getId(unit)), unit])), [units]);
  const totals = useMemo(() => {
    const rootCount = units.filter((unit) => !getId(unit.parent || unit.parentOfficeSection)).length;
    return { total: units.length, roots: rootCount, children: units.length - rootCount };
  }, [units]);
  const formParentName = useMemo(() => (form.parent ? compactUnitName(unitMap.get(String(form.parent))) : ""), [form.parent, unitMap]);

  const captureScrollPosition = () => ({ x: window.scrollX, y: window.scrollY });

  const restoreScrollPosition = (position) => {
    window.scrollTo(position.x, position.y);
  };

  const reloadUnitsInPlace = async () => {
    const position = captureScrollPosition();
    await loadUnits();
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => restoreScrollPosition(position));
    });
  };

  const openAdd = (parent = "") => {
    setForm({ ...blankForm, parent: getId(parent) });
    setFormOpen(true);
  };

  const openEdit = (unit) => {
    setForm({
      id: getId(unit),
      name: unit.name || "",
      code: unit.code || "",
      parent: getId(unit.parent || unit.parentOfficeSection),
    });
    setFormOpen(true);
  };

  const saveUnit = async () => {
    const name = clean(form.name);
    if (!name) {
      toast.error("Official name is required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name,
        code: clean(form.code),
        parent: form.parent || null,
        parentOfficeSection: form.parent || null,
        type: form.parent ? "section" : "office",
      };

      if (form.id) {
        await organizationUnitService.update(form.id, payload);
        toast.success("Structure updated");
      } else {
        await organizationUnitService.create(payload);
        toast.success("Structure added");
      }

      setFormOpen(false);
      notifyResourceChanged("organization-units");
      await reloadUnitsInPlace();
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not save structure"));
    } finally {
      setSaving(false);
    }
  };

  const deleteUnit = async () => {
    if (!deleteTarget) return;

    setSaving(true);
    try {
      await organizationUnitService.remove(getId(deleteTarget));
      toast.success("Office / section deleted");
      setDeleteTarget(null);
      notifyResourceChanged("organization-units");
      await reloadUnitsInPlace();
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not delete office / section"));
    } finally {
      setSaving(false);
    }
  };

  const moveUnit = async (unit, direction) => {
    const parentId = getId(unit.parent || unit.parentOfficeSection);
    const siblings = units
      .filter((item) => String(getId(item.parent || item.parentOfficeSection) || "") === String(parentId || ""))
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || compactUnitName(a).localeCompare(compactUnitName(b)));
    const currentIndex = siblings.findIndex((item) => String(getId(item)) === String(getId(unit)));
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= siblings.length) return;

    const orderedSiblings = [...siblings];
    const [moved] = orderedSiblings.splice(currentIndex, 1);
    orderedSiblings.splice(targetIndex, 0, moved);

    setSaving(true);
    try {
      await Promise.all(
        orderedSiblings.map((item, index) => {
          const order = index + 1;
          return organizationUnitService.update(getId(item), { sortOrder: order, displayOrder: order });
        })
      );
      notifyResourceChanged("organization-units");
      await reloadUnitsInPlace();
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not move section"));
    } finally {
      setSaving(false);
    }
  };

  const renderBranch = (items, depth = 0) =>
    items.map((unit, index) => {
      const hasChildren = Boolean(unit.children?.length);
      const styles = styleForDepth(depth, hasChildren);
      return (
        <div key={getId(unit)} className="relative">
          {depth > 0 ? <span className="absolute bottom-0 top-0 w-px bg-border" style={{ left: `${18 + (depth - 1) * 26}px` }} /> : null}
          <div className="group relative px-3 py-1.5" style={{ paddingLeft: `${12 + depth * 26}px` }}>
            <div className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 shadow-sm transition group-hover:shadow-md ${styles.card}`}>
              <div className="flex min-w-0 items-center gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${styles.icon}`}>
                  {hasChildren ? <GitBranch className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-[15px] font-black text-foreground">{compactUnitName(unit)}</p>
                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] ${styles.badge}`}>
                      Level {depth + 1}
                    </span>
                    {hasChildren ? (
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-black ${styles.child}`}>
                        {unit.children.length} under
                      </span>
                    ) : null}
                  </div>
                  {unit.code && unit.name !== unit.code ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{unit.name}</p> : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <div className="inline-flex items-center overflow-hidden rounded-lg border border-border bg-white/75 shadow-sm">
                  <span className="hidden border-r border-border px-2 text-[10px] font-black uppercase tracking-[0.08em] text-muted-foreground sm:inline-flex">
                    <MoveVertical className="mr-1 h-3.5 w-3.5" />
                    Move
                  </span>
                  <button type="button" className="px-2 py-2 text-foreground transition hover:bg-white disabled:text-muted-foreground/45" title="Move up" disabled={saving || index === 0} onClick={() => moveUnit(unit, "up")}>
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button type="button" className="border-l border-border px-2 py-2 text-foreground transition hover:bg-white disabled:text-muted-foreground/45" title="Move down" disabled={saving || index === items.length - 1} onClick={() => moveUnit(unit, "down")}>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
                <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-primary/25 bg-white px-3 py-2 text-xs font-black text-primary shadow-sm transition hover:-translate-y-0.5 hover:bg-primary hover:text-white" onClick={() => openAdd(unit)}>
                  <Plus className="h-4 w-4" />
                  Add Under
                </button>
                <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-xs font-bold shadow-sm transition hover:-translate-y-0.5 hover:bg-white" onClick={() => openEdit(unit)}>
                  <Pencil className="h-4 w-4" />
                  Edit
                </button>
                <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-danger shadow-sm transition hover:-translate-y-0.5 hover:bg-red-50" onClick={() => setDeleteTarget(unit)}>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
          {unit.children?.length ? renderBranch(unit.children, depth + 1) : null}
        </div>
      );
    });

  return (
    <div className="space-y-3">
      <PageHeader
        title="Offices / Sections"
        description="Manage parent-child office structure with short screen names for daily use."
        actions={
          <button type="button" className="btn-primary" onClick={() => openAdd()}>
            <Plus className="h-4 w-4" />
            Add Top Office
          </button>
        }
      />

      <div className="grid gap-2 md:grid-cols-3">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.key} className={`flex items-center justify-between rounded-lg border p-3 shadow-sm ${card.className}`}>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] opacity-70">{card.label}</p>
                <p className="text-xl font-black">{totals[card.key]}</p>
                <p className="text-xs font-semibold opacity-70">{card.helper}</p>
              </div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.iconClass}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-border bg-surface p-2 shadow-sm">
        <div className="mb-2 flex items-center gap-2 px-2 pt-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
            <GitBranch className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-black">Hierarchy Preview</h3>
            <p className="text-xs text-muted-foreground">Use Add Under and Move inside the same parent.</p>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-surface-2/40 p-1">
          {loading ? (
            <div className="p-8 text-center text-sm font-semibold text-muted-foreground">Loading structure...</div>
          ) : tree.length ? (
            renderBranch(tree)
          ) : (
            <div className="p-8 text-center text-sm font-semibold text-muted-foreground">No structure found.</div>
          )}
        </div>
      </div>

      <Modal
        open={formOpen}
        title={form.id ? "Edit Office / Section" : formParentName ? `Add Under ${formParentName}` : "Add Top Office"}
        description="Official name builds the hierarchy. Screen name is what users see in the sheet."
        onClose={() => setFormOpen(false)}
        size="sm"
      >
        <div className="space-y-4">
          {formParentName ? (
            <div className="rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-sm font-bold text-primary">
              Parent: {formParentName}
            </div>
          ) : null}
          <label className="block">
            <span className="label-shell">Official Name</span>
            <input className="input-shell" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label className="block">
            <span className="label-shell">Screen Name</span>
            <input className="input-shell" placeholder="Example: Budget-I, DS Budget" value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} />
          </label>
          <label className="block">
            <span className="label-shell">Under Parent</span>
            <select className="input-shell" value={form.parent} onChange={(event) => setForm((current) => ({ ...current, parent: event.target.value }))}>
              <option value="">No parent</option>
              {units
                .filter((unit) => getId(unit) !== form.id)
                .map((unit) => (
                  <option key={getId(unit)} value={getId(unit)}>
                    {compactUnitName(unit)}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => setFormOpen(false)}>
            <X className="h-4 w-4" />
            Cancel
          </button>
          <button type="button" className="btn-primary" disabled={saving} onClick={saveUnit}>
            <Save className="h-4 w-4" />
            Save
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete office / section"
        description={`Delete ${deleteTarget ? compactUnitName(deleteTarget) : "this office / section"}? Child sections or linked employees must be cleared first.`}
        confirmLabel="Delete"
        loading={saving}
        onConfirm={deleteUnit}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default StructurePage;
