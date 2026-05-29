import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Save, X } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
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

const StructurePage = () => {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(blankForm);

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
      await loadUnits();
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not save structure"));
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
      await loadUnits();
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not move section"));
    } finally {
      setSaving(false);
    }
  };

  const renderBranch = (items, depth = 0) =>
    items.map((unit, index) => {
      const parent = unitMap.get(String(getId(unit.parent || unit.parentOfficeSection)));
      return (
        <div key={getId(unit)} className="border-b border-border last:border-b-0">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" style={{ paddingLeft: `${16 + depth * 24}px` }}>
            <div className="min-w-0">
              <p className="font-semibold text-foreground">{compactUnitName(unit)}</p>
              <p className="text-xs text-muted-foreground">
                {unit.name}
                {parent ? ` - under ${compactUnitName(parent)}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="rounded-lg p-2 hover:bg-muted disabled:opacity-40" title="Move up" disabled={saving || index === 0} onClick={() => moveUnit(unit, "up")}>
                <ArrowUp className="h-4 w-4" />
              </button>
              <button type="button" className="rounded-lg p-2 hover:bg-muted disabled:opacity-40" title="Move down" disabled={saving || index === items.length - 1} onClick={() => moveUnit(unit, "down")}>
                <ArrowDown className="h-4 w-4" />
              </button>
              <button type="button" className="btn-ghost px-3 py-2 text-xs" onClick={() => openAdd(unit)}>
                <Plus className="h-4 w-4" />
                Add Under
              </button>
              <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={() => openEdit(unit)}>
                <Pencil className="h-4 w-4" />
                Edit
              </button>
            </div>
          </div>
          {unit.children?.length ? renderBranch(unit.children, depth + 1) : null}
        </div>
      );
    });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Structure"
        description="Manage parent-child office structure with short screen names for daily use."
        actions={
          <button type="button" className="btn-primary" onClick={() => openAdd()}>
            <Plus className="h-4 w-4" />
            Add Office
          </button>
        }
      />

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        {loading ? (
          <div className="p-8 text-center text-sm font-semibold text-muted-foreground">Loading structure...</div>
        ) : tree.length ? (
          renderBranch(tree)
        ) : (
          <div className="p-8 text-center text-sm font-semibold text-muted-foreground">No structure found.</div>
        )}
      </div>

      <Modal
        open={formOpen}
        title={form.id ? "Edit Structure" : "Add Structure"}
        description="Official name builds the hierarchy. Screen name is what users see in the sheet."
        onClose={() => setFormOpen(false)}
        size="sm"
      >
        <div className="space-y-4">
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
    </div>
  );
};

export default StructurePage;
