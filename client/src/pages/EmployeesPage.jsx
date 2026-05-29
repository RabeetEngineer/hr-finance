import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Pencil, Plus, Printer, Save, Trash2, X } from "lucide-react";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import Modal from "@/components/common/Modal";
import { employeeService } from "@/services/employeeService";
import { designationService } from "@/services/designationService";
import { organizationUnitService } from "@/services/organizationUnitService";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@/utils/formatDate";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { notifyResourceChanged, subscribeResourceChanged } from "@/utils/resourceEvents";
import { toast } from "sonner";

const blankForm = {
  fullName: "",
  fatherName: "",
  designationName: "",
  sectionName: "",
  personnelNumber: "",
  cnic: "",
  mobileNumber: "",
  dateOfBirth: "",
  joiningDate: "",
  gender: "male",
  employmentStatus: "active",
  transferredOutDate: "",
  transferredToDepartment: "",
  retirementDate: "",
};

const blankSectionForm = { name: "", code: "", parent: "" };

const defaultUiSettings = {
  printTitle: "Incumbency Position",
  printSubtitle: "Punjab Finance Department",
};

const genderOptions = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Unspecified" },
];

const sortOptions = [
  { value: "hierarchy", label: "Hierarchy" },
  { value: "name", label: "Name A-Z" },
  { value: "designation", label: "Designation A-Z" },
  { value: "section", label: "Section A-Z" },
  { value: "personnel", label: "Personnel No." },
  { value: "gender", label: "Gender" },
];

const printColumnOptions = [
  { key: "total", label: "Total Sr #" },
  { key: "sectionSerial", label: "Sr.#" },
  { key: "name", label: "Name" },
  { key: "fatherName", label: "Father Name" },
  { key: "designation", label: "Designation" },
  { key: "section", label: "Section" },
  { key: "personnelNumber", label: "Personnel No." },
  { key: "cnic", label: "CNIC" },
  { key: "mobileNumber", label: "Cell No." },
  { key: "dateOfBirth", label: "DOB" },
  { key: "joining", label: "Joining" },
  { key: "gender", label: "Gender" },
];

const defaultPrintColumns = ["total", "name", "designation", "section"];
const screenColumnOptions = printColumnOptions;
const defaultScreenColumns = ["total", "sectionSerial", "name", "fatherName", "designation", "personnelNumber", "joining"];

const getId = (item) => item?.id || item?._id || item || "";
const clean = (value) => String(value || "").trim();
const sameText = (a, b) => clean(a).toLowerCase() === clean(b).toLowerCase();
const dateInputValue = (value) => (value ? new Date(value).toISOString().slice(0, 10) : "");

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

const parentHint = (unit, sectionsById) => {
  const parentId = getId(unit?.parent || unit?.parentOfficeSection);
  if (!parentId) return "";
  const parent = sectionsById.get(String(parentId));
  return parent ? compactUnitName(parent) : "";
};

const fetchAll = async (service, params = {}) => {
  const first = await service.list({ ...params, page: 1, limit: 200 });
  const rows = [...(first.data.data || [])];
  const pages = Number(first.data.meta?.pages || 1);

  for (let page = 2; page <= pages; page += 1) {
    const response = await service.list({ ...params, page, limit: 200 });
    rows.push(...(response.data.data || []));
  }

  return rows;
};

const employeeSearchText = (employee) =>
  [
    employee.fullName,
    employee.fatherName,
    employee.designation?.name,
    employee.currentOfficeSection?.name,
    employee.currentOfficeSection?.code,
    employee.personnelNumber,
    employee.cnic,
    employee.mobileNumber,
    employee.gender,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const compareText = (a, b) => clean(a).localeCompare(clean(b), undefined, { numeric: true, sensitivity: "base" });

const toggleValue = (values, value) => (values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);

const MultiSelect = ({ label, options, values, onChange, maxVisible = 2, summaryMode = "names" }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selectedLabels = options.filter((option) => values.includes(option.value)).map((option) => option.label);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button type="button" className="flex min-h-[38px] w-full items-center justify-between gap-2 rounded-lg border border-border bg-white px-3 py-2 text-left text-sm" onClick={() => setOpen((value) => !value)}>
        <span className="min-w-0">
          <span className="block truncate text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
          <span className="block truncate text-foreground">
            {summaryMode === "count" && selectedLabels.length ? `${selectedLabels.length} selected` : selectedLabels.length ? selectedLabels.slice(0, maxVisible).join(", ") : "All"}
            {summaryMode !== "count" && selectedLabels.length > maxVisible ? ` +${selectedLabels.length - maxVisible}` : ""}
          </span>
        </span>
        <span className="text-xs text-muted-foreground">{selectedLabels.length || ""}</span>
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-30 mt-1 max-h-72 w-72 overflow-auto rounded-lg border border-border bg-surface p-2 shadow-soft">
        <button type="button" className="mb-2 w-full rounded-md px-2 py-1 text-left text-xs font-semibold text-muted-foreground hover:bg-muted" onClick={() => onChange([])}>
          Clear
        </button>
        {options.map((option) => (
          <label key={option.value} className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
            <input type="checkbox" className="mt-1" checked={values.includes(option.value)} onChange={() => onChange(toggleValue(values, option.value))} />
            <span>
              <span className="block font-medium">{option.label}</span>
              {option.hint ? <span className="block text-xs text-muted-foreground">{option.hint}</span> : null}
            </span>
          </label>
        ))}
        </div>
      ) : null}
    </div>
  );
};

const SearchableSelect = ({ label, value, options, onChange, placeholder = "Search and select..." }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || "");

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = needle
      ? options.filter((option) => `${option.label} ${option.hint || ""}`.toLowerCase().includes(needle))
      : options;
    return rows.slice(0, 30);
  }, [options, query]);

  return (
    <label className="relative block">
      <span className="label-shell">{label}</span>
      <input
        className="input-shell"
        value={query}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          onChange("");
          setOpen(true);
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
      />
      {open ? (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-64 overflow-auto rounded-lg border border-border bg-surface p-1 shadow-soft">
          {filtered.length ? (
            filtered.map((option) => (
              <button
                key={option.value}
                type="button"
                className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(option.value);
                  setQuery(option.label);
                  setOpen(false);
                }}
              >
                <span className="block font-semibold">{option.label}</span>
                {option.hint ? <span className="block text-xs text-muted-foreground">{option.hint}</span> : null}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-muted-foreground">No matching option found.</div>
          )}
        </div>
      ) : null}
    </label>
  );
};

const EmployeesPage = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [sections, setSections] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({ q: "", designations: [], sections: [], gender: "", sort: "hierarchy", pageSize: 100 });
  const [screenColumns, setScreenColumns] = useState(defaultScreenColumns);
  const [printColumns, setPrintColumns] = useState(defaultPrintColumns);
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [renamingSection, setRenamingSection] = useState(null);
  const [nextSectionName, setNextSectionName] = useState("");
  const [nextSectionCode, setNextSectionCode] = useState("");
  const [sectionFormOpen, setSectionFormOpen] = useState(false);
  const [sectionForm, setSectionForm] = useState(blankSectionForm);
  const [uiSettings, setUiSettings] = useState(defaultUiSettings);

  useEffect(() => {
    const loadSettings = () => setUiSettings({ ...defaultUiSettings, ...JSON.parse(localStorage.getItem("hrf_ui_settings") || "{}") });
    loadSettings();
    window.addEventListener("hrf-ui-settings-changed", loadSettings);
    return () => window.removeEventListener("hrf-ui-settings-changed", loadSettings);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [employeeRows, sectionRows, designationRows] = await Promise.all([
        fetchAll(employeeService, { sort: "sortOrder fullName", status: "active" }),
        fetchAll(organizationUnitService, { isActive: "true", sort: "sortOrder name" }),
        fetchAll(designationService, { isActive: "true", sort: "sortOrder name" }),
      ]);

      setEmployees(employeeRows);
      setSections(sectionRows);
      setDesignations(designationRows);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load incumbency sheet"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeResourceChanged(({ resource }) => {
      if (["employees", "organization-units", "designations"].includes(resource)) loadData();
    });

    const reloadOnFocus = () => loadData();
    window.addEventListener("focus", reloadOnFocus);

    return () => {
      unsubscribe();
      window.removeEventListener("focus", reloadOnFocus);
    };
  }, []);

  const canEditEmployees = ["super_admin", "admin", "data_entry"].includes(user?.role);
  const canManageStructure = ["super_admin", "admin"].includes(user?.role);
  const canDeleteEmployees = ["super_admin", "admin"].includes(user?.role);
  const showActions = canEditEmployees || canManageStructure || canDeleteEmployees;
  const visibleScreenColumns = useMemo(() => {
    const selected = screenColumnOptions.filter((option) => screenColumns.includes(option.key));
    return selected.length ? selected : screenColumnOptions.filter((option) => defaultScreenColumns.includes(option.key));
  }, [screenColumns]);
  const tableColSpan = visibleScreenColumns.length + (showActions ? 1 : 0);

  useEffect(() => {
    setPage(1);
  }, [filters.q, filters.designations, filters.sections, filters.gender, filters.sort, filters.pageSize]);

  const sectionsById = useMemo(() => new Map(sections.map((section) => [String(getId(section)), section])), [sections]);
  const designationNames = useMemo(() => {
    const names = new Set(designations.map((designation) => designation.name).filter(Boolean));
    employees.forEach((employee) => {
      if (employee.designation?.name) names.add(employee.designation.name);
    });
    return [...names].sort(compareText);
  }, [designations, employees]);
  const designationOptions = useMemo(() => designationNames.map((name) => ({ value: name, label: name })), [designationNames]);
  const activeDesignationOptions = useMemo(
    () =>
      designations
        .filter((designation) => designation.isActive !== false)
        .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || compareText(a.name, b.name))
        .map((designation) => ({ value: designation.name, label: designation.name, hint: [designation.bps ? `BPS ${designation.bps}` : "", designation.service].filter(Boolean).join(" - ") })),
    [designations]
  );
  const sectionOptions = useMemo(
    () =>
      [...sections]
        .sort((a, b) => compareText(compactUnitName(a), compactUnitName(b)))
        .map((section) => ({ id: getId(section), value: getId(section), label: compactUnitName(section), hint: parentHint(section, sectionsById), name: section.name })),
    [sections, sectionsById]
  );
  const employeeSectionOptions = useMemo(
    () => sectionOptions.map((section) => ({ ...section, value: section.label })),
    [sectionOptions]
  );

  const filteredEmployees = useMemo(() => {
    const text = filters.q.trim().toLowerCase();

    return employees.filter((employee) => {
      const designation = employee.designation?.name || "";
      const sectionId = getId(employee.currentOfficeSection);
      const gender = employee.gender || "";

      if (text && !employeeSearchText(employee).includes(text)) return false;
      if (
        filters.designations.length &&
        !filters.designations.some((selected) => sameText(designation, selected) || designation.toLowerCase().includes(selected.toLowerCase()) || selected.toLowerCase().includes(designation.toLowerCase()))
      ) {
        return false;
      }
      if (filters.sections.length && !filters.sections.some((selected) => String(sectionId) === String(selected))) return false;
      if (filters.gender && gender !== filters.gender) return false;
      return true;
    });
  }, [employees, filters]);

  const hierarchySections = useMemo(() => {
    const groups = new Map();
    const childrenByParent = new Map();

    sections.forEach((section) => {
      const sectionId = getId(section);
      const parentId = getId(section.parent || section.parentOfficeSection);
      const parent = parentId ? sectionsById.get(String(parentId)) : null;

      groups.set(sectionId, {
        id: sectionId,
        name: compactUnitName(section) || "Unnamed Section",
        officialName: section.name || "",
        code: section.code || "",
        parentId,
        parentName: parent ? compactUnitName(parent) : "",
        sortOrder: Number(section.sortOrder || 9999),
        rows: [],
      });

      const parentKey = parentId ? String(parentId) : "";
      if (!childrenByParent.has(parentKey)) childrenByParent.set(parentKey, []);
      childrenByParent.get(parentKey).push(sectionId);
    });

    filteredEmployees.forEach((employee) => {
      const section = employee.currentOfficeSection;
      const sectionId = getId(section) || "unassigned";
      const sectionName = section?.name || "Unassigned";

      if (!groups.has(sectionId)) {
        const sectionFromList = sectionsById.get(String(sectionId));
        const parentId = getId(sectionFromList?.parent || sectionFromList?.parentOfficeSection);
        const parent = parentId ? sectionsById.get(String(parentId)) : null;

        groups.set(sectionId, {
          id: sectionId,
          name: compactUnitName(sectionFromList || section) || sectionName,
          officialName: sectionName,
          code: sectionFromList?.code || section?.code || "",
          sortOrder: Number(section?.sortOrder || 9999),
          parentId,
          parentName: parent ? compactUnitName(parent) : "",
          rows: [],
        });
      }

      groups.get(sectionId).rows.push(employee);
    });

    const sortGroupIds = (ids = []) =>
      [...ids].sort((a, b) => {
        const first = groups.get(a);
        const second = groups.get(b);
        return first.sortOrder - second.sortOrder || compareText(first.name, second.name);
      });

    const ordered = [];
    const visited = new Set();
    const includeEmptySections = !filters.q.trim() && !filters.designations.length && !filters.sections.length && !filters.gender;

    const visit = (groupId, depth = 0) => {
      if (visited.has(groupId) || !groups.has(groupId)) return;
      visited.add(groupId);

      const group = groups.get(groupId);
      const rows = group.rows.sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || compareText(a.fullName, b.fullName));
      if (includeEmptySections || rows.length) ordered.push({ ...group, depth, rows });

      sortGroupIds(childrenByParent.get(String(groupId))).forEach((childId) => visit(childId, depth + 1));
    };

    sortGroupIds(childrenByParent.get("")).forEach((groupId) => visit(groupId, 0));
    sortGroupIds([...groups.keys()].filter((groupId) => !visited.has(groupId))).forEach((groupId) => visit(groupId, 0));

    return ordered;
  }, [filteredEmployees, filters, sections, sectionsById]);

  const sortedEmployees = useMemo(() => {
    const rows = [...filteredEmployees];
    const sort = filters.sort;

    if (sort === "name") return rows.sort((a, b) => compareText(a.fullName, b.fullName));
    if (sort === "designation") return rows.sort((a, b) => compareText(a.designation?.name, b.designation?.name) || compareText(a.fullName, b.fullName));
    if (sort === "section") return rows.sort((a, b) => compareText(compactUnitName(a.currentOfficeSection), compactUnitName(b.currentOfficeSection)) || compareText(a.fullName, b.fullName));
    if (sort === "personnel") return rows.sort((a, b) => compareText(a.personnelNumber, b.personnelNumber) || compareText(a.fullName, b.fullName));
    if (sort === "gender") return rows.sort((a, b) => compareText(a.gender, b.gender) || compareText(a.fullName, b.fullName));
    return rows;
  }, [filteredEmployees, filters.sort]);

  const displayRows = useMemo(() => {
    if (filters.sort !== "hierarchy") {
      return sortedEmployees.map((employee, index) => ({ type: "employee", employee, globalIndex: index + 1, sectionIndex: null }));
    }

    let globalIndex = 0;
    return hierarchySections.flatMap((section) => {
      const header = [{ type: "section", section }];
      const rows = section.rows.map((employee, index) => {
        globalIndex += 1;
        return { type: "employee", employee, section, globalIndex, sectionIndex: index + 1 };
      });
      if (!rows.length) return [...header, { type: "empty", section }];
      return [...header, ...rows];
    });
  }, [filters.sort, hierarchySections, sortedEmployees]);

  const employeeDisplayRows = displayRows.filter((row) => row.type === "employee");
  const totalEmployees = employeeDisplayRows.length;
  const pageSize = Number(filters.pageSize) || 100;
  const totalPages = Math.max(Math.ceil(totalEmployees / pageSize), 1);
  const startEmployee = (page - 1) * pageSize;
  const endEmployee = startEmployee + pageSize;

  const pagedRows = useMemo(() => {
    if (filters.sort !== "hierarchy") return employeeDisplayRows.slice(startEmployee, endEmployee);

    let seenEmployees = 0;
    let activeSectionIncluded = false;
    const rows = [];

    displayRows.forEach((row) => {
      if (row.type === "section") {
        activeSectionIncluded = false;
        return;
      }

      if (row.type === "empty") {
        if (startEmployee === 0 && endEmployee > 0) rows.push({ type: "section", section: row.section }, row);
        return;
      }

      const inPage = seenEmployees >= startEmployee && seenEmployees < endEmployee;
      if (inPage) {
        if (!activeSectionIncluded) {
          rows.push({ type: "section", section: row.section });
          activeSectionIncluded = true;
        }
        rows.push(row);
      }
      seenEmployees += 1;
    });

    return rows;
  }, [displayRows, employeeDisplayRows, endEmployee, filters.sort, startEmployee]);

  const selectedPrintOptions = useMemo(() => {
    const selected = printColumnOptions.filter((option) => printColumns.includes(option.key));
    return selected.length ? selected : printColumnOptions.filter((option) => defaultPrintColumns.includes(option.key));
  }, [printColumns]);

  const printRows = useMemo(() => displayRows.filter((row) => row.type !== "empty"), [displayRows]);

  const printCellValue = (row, key) => {
    const employee = row.employee;
    if (!employee) return "";

    const values = {
      total: row.globalIndex,
      sectionSerial: row.sectionIndex || "",
      name: employee.fullName || "",
      fatherName: employee.fatherName || "",
      designation: employee.designation?.name || "",
      section: compactUnitName(employee.currentOfficeSection) || "",
      personnelNumber: employee.personnelNumber || "",
      cnic: employee.cnic || "",
      mobileNumber: employee.mobileNumber || "",
      dateOfBirth: formatDate(employee.dateOfBirth),
      joining: formatDate(employee.dateOfJoiningCurrentDepartment || employee.dateOfJoiningGovernmentService),
      gender: employee.gender || "",
    };

    return values[key] || "";
  };

  const screenCellValue = (row, key) => printCellValue(row, key);

  const stats = useMemo(() => {
    const male = filteredEmployees.filter((employee) => employee.gender === "male").length;
    const female = filteredEmployees.filter((employee) => employee.gender === "female").length;
    return { total: filteredEmployees.length, sections: hierarchySections.filter((section) => section.rows.length).length, male, female };
  }, [filteredEmployees, hierarchySections]);

  const openAddForm = (sectionName = "") => {
    setEditingEmployee(null);
    setForm({ ...blankForm, sectionName });
    setFormOpen(true);
  };

  const openEditForm = (employee) => {
    setEditingEmployee(employee);
    setForm({
      fullName: employee.fullName || "",
      fatherName: employee.fatherName || "",
      designationName: employee.designation?.name || "",
      sectionName: compactUnitName(employee.currentOfficeSection) || "",
      personnelNumber: employee.personnelNumber || "",
      cnic: employee.cnic || "",
      mobileNumber: employee.mobileNumber || "",
      dateOfBirth: dateInputValue(employee.dateOfBirth),
      joiningDate: dateInputValue(employee.dateOfJoiningCurrentDepartment || employee.dateOfJoiningGovernmentService),
      gender: employee.gender || "other",
      employmentStatus: employee.employmentStatus || "active",
      transferredOutDate: dateInputValue(employee.transferredOutDate),
      transferredToDepartment: employee.transferredToDepartment || "",
      retirementDate: dateInputValue(employee.retirementDate),
    });
    setFormOpen(true);
  };

  const openAddSection = (parentId = "") => {
    setSectionForm({ name: "", code: "", parent: parentId });
    setSectionFormOpen(true);
  };

  const ensureDesignation = async (name) => {
    const trimmed = clean(name) || "Unspecified";
    const existing = designations.find((item) => sameText(item.name, trimmed));
    if (existing) return getId(existing);

    throw new Error("Please add this designation in the Designations page first.");
  };

  const ensureSection = async (name) => {
    const trimmed = clean(name);
    if (!trimmed) return null;

    const existing = sections.find(
      (item) => sameText(item.name, trimmed) || sameText(item.code, trimmed) || sameText(compactUnitName(item), trimmed) || sameText(item.path, trimmed)
    );
    if (existing) return getId(existing);

    throw new Error("Please add this office or section in Offices / Sections first.");
  };

  const buildEmployeePayload = async () => {
    const fullName = clean(form.fullName);
    if (!fullName) throw new Error("Name is required");

    const designation = await ensureDesignation(form.designationName);
    const currentOfficeSection = await ensureSection(form.sectionName);

    return {
      fullName,
      fatherName: clean(form.fatherName) || undefined,
      designation,
      currentOfficeSection,
      currentSeat: null,
      personnelNumber: clean(form.personnelNumber) || undefined,
      cnic: clean(form.cnic) || undefined,
      mobileNumber: clean(form.mobileNumber) || undefined,
      dateOfBirth: form.dateOfBirth || undefined,
      dateOfJoiningGovernmentService: form.joiningDate || undefined,
      dateOfJoiningCurrentDepartment: form.joiningDate || undefined,
      gender: form.gender || "other",
      employmentStatus: form.employmentStatus || "active",
      transferredOutDate: form.employmentStatus === "transferred" ? form.transferredOutDate || undefined : undefined,
      transferredToDepartment: form.employmentStatus === "transferred" ? clean(form.transferredToDepartment) || undefined : undefined,
      retirementDate: form.employmentStatus === "retired" ? form.retirementDate || undefined : undefined,
      sortOrder: editingEmployee?.sortOrder || employees.length + 1,
    };
  };

  const saveEmployee = async () => {
    setSaving(true);
    try {
      const payload = await buildEmployeePayload();
      if (editingEmployee) {
        await employeeService.update(getId(editingEmployee), payload);
        toast.success("Row updated");
      } else {
        await employeeService.create(payload);
        toast.success("Row added");
      }

      setFormOpen(false);
      notifyResourceChanged("employees");
      await loadData();
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not save row"));
    } finally {
      setSaving(false);
    }
  };

  const archiveEmployee = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await employeeService.remove(getId(deleteTarget));
      setDeleteTarget(null);
      toast.success("Row deleted");
      notifyResourceChanged("employees");
      await loadData();
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not delete row"));
    } finally {
      setSaving(false);
    }
  };

  const moveRow = async (section, rowIndex, direction) => {
    const rows = section.rows || [];
    const targetIndex = direction === "up" ? rowIndex - 1 : rowIndex + 1;
    if (targetIndex < 0 || targetIndex >= rows.length) return;

    const orderedRows = [...rows];
    const [moved] = orderedRows.splice(rowIndex, 1);
    orderedRows.splice(targetIndex, 0, moved);

    setSaving(true);
    try {
      await Promise.all(
        orderedRows.map((employee, index) => employeeService.update(getId(employee), { sortOrder: (index + 1) * 10 }))
      );
      notifyResourceChanged("employees");
      await loadData();
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not move row"));
    } finally {
      setSaving(false);
    }
  };

  const startRenameSection = (section) => {
    if (section.id === "unassigned") {
      toast.info("Add a section name to a row first, then it can be renamed.");
      return;
    }

    setRenamingSection(section);
    setNextSectionName(section.officialName || section.name);
    setNextSectionCode(section.code || "");
  };

  const saveSectionName = async () => {
    const trimmed = clean(nextSectionName);
    if (!renamingSection || !trimmed) return;

    setSaving(true);
    try {
      await organizationUnitService.update(renamingSection.id, { name: trimmed, code: clean(nextSectionCode) });
      toast.success("Section renamed");
      setRenamingSection(null);
      notifyResourceChanged("organization-units");
      await loadData();
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not rename section"));
    } finally {
      setSaving(false);
    }
  };

  const saveNewSection = async () => {
    const name = clean(sectionForm.name);
    if (!name) {
      toast.error("Section name is required");
      return;
    }

    setSaving(true);
    try {
      await organizationUnitService.create({
        name,
        code: clean(sectionForm.code),
        parent: sectionForm.parent || null,
        parentOfficeSection: sectionForm.parent || null,
        type: sectionForm.parent ? "section" : "office",
      });
      toast.success("Section added");
      setSectionFormOpen(false);
      notifyResourceChanged("organization-units");
      await loadData();
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not add section"));
    } finally {
      setSaving(false);
    }
  };

  const resetFilters = () => {
    setFilters({ q: "", designations: [], sections: [], gender: "", sort: "hierarchy", pageSize: 100 });
  };

  const exportSheet = () => {
    const csvRows = [];
    csvRows.push(visibleScreenColumns.map((column) => column.label));

    displayRows.forEach((row) => {
      if (row.type === "section") {
        csvRows.push([row.section.name, ...Array(Math.max(visibleScreenColumns.length - 1, 0)).fill("")]);
        return;
      }
      if (row.type !== "employee") return;
      csvRows.push(visibleScreenColumns.map((column) => screenCellValue(row, column.key) || ""));
    });

    const csv = csvRows.map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "incumbency-sheet.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const printSheet = () => window.print();

  return (
    <div className="space-y-3 print:block">
      <div className="print-header hidden">
        <h1>{uiSettings.printTitle || "Incumbency Position"}</h1>
        <p>
          {uiSettings.printSubtitle || "Punjab Finance Department"} | Printed {new Date().toLocaleString()}
        </p>
      </div>

      <div className="no-print rounded-lg border border-border bg-surface px-3 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Punjab Finance</p>
            <h1 className="text-xl font-bold text-foreground">Incumbency Sheet</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-border bg-surface-2 px-2 py-1 text-xs font-semibold">Rows {stats.total}</span>
            <span className="rounded-md border border-border bg-surface-2 px-2 py-1 text-xs font-semibold">Sections {stats.sections}</span>
            <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={printSheet}>
              <Printer className="h-4 w-4" />
              Print
            </button>
            <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={exportSheet}>
              Export Excel
            </button>
            {canManageStructure ? (
              <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={() => openAddSection()}>
                <Plus className="h-4 w-4" />
                Section
              </button>
            ) : null}
            {canEditEmployees ? (
              <button type="button" className="btn-primary px-3 py-2 text-xs" onClick={() => openAddForm()}>
                <Plus className="h-4 w-4" />
                Row
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <div className="grid gap-2 lg:grid-cols-[minmax(260px,1.5fr)_minmax(190px,0.9fr)_minmax(190px,0.9fr)_150px]">
            <input
              className="input-shell rounded-lg px-3 py-2"
              value={filters.q}
              onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
              placeholder="Search name, CNIC, designation, section, cell..."
            />
            <MultiSelect label="Designations" options={designationOptions} values={filters.designations} onChange={(values) => setFilters((current) => ({ ...current, designations: values }))} />
            <MultiSelect label="Offices / Sections" options={sectionOptions} values={filters.sections} onChange={(values) => setFilters((current) => ({ ...current, sections: values }))} />
            <select className="input-shell rounded-lg px-3 py-2" value={filters.gender} onChange={(event) => setFilters((current) => ({ ...current, gender: event.target.value }))}>
              <option value="">All gender</option>
              {genderOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-2/70 p-2">
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">View</span>
            <select className="input-shell min-w-36 max-w-44 rounded-lg px-3 py-2" value={filters.sort} onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value }))}>
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select className="input-shell min-w-32 max-w-40 rounded-lg px-3 py-2" value={filters.pageSize} onChange={(event) => setFilters((current) => ({ ...current, pageSize: Number(event.target.value) }))}>
              {[50, 100, 150, 250, 500, 1000].map((size) => (
                <option key={size} value={size}>
                  {size} rows
                </option>
              ))}
            </select>
            <MultiSelect
              label="Screen columns"
              options={screenColumnOptions.map((option) => ({ value: option.key, label: option.label }))}
              values={screenColumns}
              maxVisible={2}
              summaryMode="count"
              onChange={(values) => setScreenColumns(values.length ? values : defaultScreenColumns)}
            />
            <MultiSelect
              label="Print columns"
              options={printColumnOptions.map((option) => ({ value: option.key, label: option.label }))}
              values={printColumns}
              maxVisible={2}
              summaryMode="count"
              onChange={(values) => setPrintColumns(values.length ? values : defaultPrintColumns)}
            />
            <button type="button" className="btn-ghost ml-auto rounded-lg px-3 py-2 text-xs" onClick={resetFilters}>
              Reset filters
            </button>
          </div>
        </div>
      </div>

      <div className="screen-only overflow-hidden rounded-lg border border-border bg-surface print:border-0">
        {loading ? (
          <div className="p-8 text-center text-sm font-semibold text-muted-foreground">Loading incumbency sheet...</div>
        ) : (
          <div className="sheet-scroll">
            <table className="incumbency-table w-full min-w-fit border-collapse text-xs">
              <thead>
                <tr>
                  {visibleScreenColumns.map((column) => (
                    <th key={column.key} className={["total", "sectionSerial"].includes(column.key) ? "w-14" : undefined}>
                      {column.label}
                    </th>
                  ))}
                  {showActions ? <th className="no-print w-32 text-right">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {pagedRows.length ? (
                  pagedRows.map((row, index) => {
                    if (row.type === "section") {
                      return (
                        <tr key={`section-${row.section.id}-${index}`} className="section-row">
                          <td colSpan={tableColSpan} style={{ paddingLeft: `${10 + Number(row.section.depth || 0) * 18}px` }}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span>
                                {row.section.name}
                                {row.section.parentName ? <em> under {row.section.parentName}</em> : null}
                              </span>
                              {showActions ? (
                                <span className="no-print inline-flex items-center gap-2">
                                  {canManageStructure ? (
                                    <>
                                      <button type="button" className="mini-action" onClick={() => openAddSection(row.section.id)}>
                                        <Plus className="h-3.5 w-3.5" />
                                        Add under
                                      </button>
                                      <button type="button" className="mini-action" onClick={() => startRenameSection(row.section)}>
                                        <Pencil className="h-3.5 w-3.5" />
                                        Rename
                                      </button>
                                    </>
                                  ) : null}
                                  {canEditEmployees ? (
                                    <button type="button" className="mini-action" onClick={() => openAddForm(row.section.name)}>
                                      <Plus className="h-3.5 w-3.5" />
                                      Add row
                                    </button>
                                  ) : null}
                                </span>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    if (row.type === "empty") {
                      return (
                        <tr key={`empty-${row.section.id}-${index}`} className="empty-row no-print">
                          <td colSpan={tableColSpan}>No staff rows in this section yet.</td>
                        </tr>
                      );
                    }

                    const employee = row.employee;
                    return (
                      <tr key={getId(employee)}>
                        {visibleScreenColumns.map((column) => (
                          <td key={column.key} className={column.key === "name" ? "font-semibold text-foreground" : column.key === "gender" ? "capitalize" : undefined}>
                            {screenCellValue(row, column.key) || "-"}
                          </td>
                        ))}
                        {showActions ? (
                          <td className="no-print">
                            <div className="flex justify-end gap-1">
                              {canEditEmployees && row.section ? (
                                <>
                                  <button type="button" className="icon-action" title="Move up" disabled={saving || row.sectionIndex === 1} onClick={() => moveRow(row.section, row.sectionIndex - 1, "up")}>
                                    <ArrowUp className="h-3.5 w-3.5" />
                                  </button>
                                  <button type="button" className="icon-action" title="Move down" disabled={saving || row.sectionIndex === row.section.rows.length} onClick={() => moveRow(row.section, row.sectionIndex - 1, "down")}>
                                    <ArrowDown className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              ) : null}
                              {canEditEmployees ? (
                                <button type="button" className="icon-action" title="Edit row" onClick={() => openEditForm(employee)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                              ) : null}
                              {canDeleteEmployees ? (
                                <button type="button" className="icon-action text-danger" title="Delete row" onClick={() => setDeleteTarget(employee)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              ) : null}
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={tableColSpan} className="py-8 text-center text-muted-foreground">
                      No records match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="print-only">
        <table className="incumbency-table w-full border-collapse text-xs">
          <thead>
            <tr>
              {selectedPrintOptions.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {printRows.map((row, index) => {
              if (row.type === "section") {
                return (
                  <tr key={`print-section-${row.section.id}-${index}`} className="section-row">
                    <td colSpan={selectedPrintOptions.length}>{row.section.name}</td>
                  </tr>
                );
              }

              return (
                <tr key={`print-${getId(row.employee)}-${index}`}>
                  {selectedPrintOptions.map((column) => (
                    <td key={column.key}>{printCellValue(row, column.key) || "-"}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
        <p className="text-muted-foreground">
          Showing {totalEmployees ? startEmployee + 1 : 0}-{Math.min(endEmployee, totalEmployees)} of {totalEmployees}
        </p>
        <div className="flex items-center gap-2">
          <button type="button" className="btn-secondary rounded-lg px-3 py-2 text-xs" disabled={page <= 1} onClick={() => setPage((value) => Math.max(value - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
            Prev
          </button>
          <span className="text-xs font-semibold">
            Page {page} / {totalPages}
          </span>
          <button type="button" className="btn-secondary rounded-lg px-3 py-2 text-xs" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(value + 1, totalPages))}>
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <Modal open={formOpen} title={editingEmployee ? "Edit Row" : "Add Row"} description="Section change works like a simple transfer." onClose={() => setFormOpen(false)} size="lg">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="label-shell">Name</span>
            <input className="input-shell" value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} />
          </label>
          <label className="block">
            <span className="label-shell">Father Name</span>
            <input className="input-shell" value={form.fatherName} onChange={(event) => setForm((current) => ({ ...current, fatherName: event.target.value }))} />
          </label>
          <SearchableSelect
            label="Designation"
            value={form.designationName}
            options={activeDesignationOptions}
            placeholder="Search designation..."
            onChange={(value) => setForm((current) => ({ ...current, designationName: value }))}
          />
          <SearchableSelect
            label="Office / Section"
            value={form.sectionName}
            options={employeeSectionOptions}
            placeholder="Search office or section..."
            onChange={(value) => setForm((current) => ({ ...current, sectionName: value }))}
          />
          <label className="block">
            <span className="label-shell">Personnel No.</span>
            <input className="input-shell" value={form.personnelNumber} onChange={(event) => setForm((current) => ({ ...current, personnelNumber: event.target.value }))} />
          </label>
          <label className="block">
            <span className="label-shell">CNIC</span>
            <input className="input-shell" value={form.cnic} onChange={(event) => setForm((current) => ({ ...current, cnic: event.target.value }))} />
          </label>
          <label className="block">
            <span className="label-shell">Cell No.</span>
            <input className="input-shell" value={form.mobileNumber} onChange={(event) => setForm((current) => ({ ...current, mobileNumber: event.target.value }))} />
          </label>
          <label className="block">
            <span className="label-shell">Date of Birth</span>
            <input type="date" className="input-shell" value={form.dateOfBirth} onChange={(event) => setForm((current) => ({ ...current, dateOfBirth: event.target.value }))} />
          </label>
          <label className="block">
            <span className="label-shell">Date of Joining</span>
            <input type="date" className="input-shell" value={form.joiningDate} onChange={(event) => setForm((current) => ({ ...current, joiningDate: event.target.value }))} />
          </label>
          <label className="block">
            <span className="label-shell">Gender</span>
            <select className="input-shell" value={form.gender} onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))}>
              {genderOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label-shell">Incumbency Action</span>
            <select className="input-shell" value={form.employmentStatus} onChange={(event) => setForm((current) => ({ ...current, employmentStatus: event.target.value }))}>
              <option value="active">Active in Finance</option>
              <option value="transferred">Transferred to another department</option>
              <option value="retired">Retired</option>
            </select>
          </label>
          {form.employmentStatus === "transferred" ? (
            <>
              <label className="block">
                <span className="label-shell">Transfer Date</span>
                <input type="date" className="input-shell" value={form.transferredOutDate} onChange={(event) => setForm((current) => ({ ...current, transferredOutDate: event.target.value }))} />
              </label>
              <label className="block">
                <span className="label-shell">Transferred To Department</span>
                <input className="input-shell" placeholder="Example: Planning & Development Department" value={form.transferredToDepartment} onChange={(event) => setForm((current) => ({ ...current, transferredToDepartment: event.target.value }))} />
              </label>
            </>
          ) : null}
          {form.employmentStatus === "retired" ? (
            <label className="block">
              <span className="label-shell">Date of Retirement</span>
              <input type="date" className="input-shell" value={form.retirementDate} onChange={(event) => setForm((current) => ({ ...current, retirementDate: event.target.value }))} />
            </label>
          ) : null}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => setFormOpen(false)}>
            <X className="h-4 w-4" />
            Cancel
          </button>
          <button type="button" className="btn-primary" disabled={saving} onClick={saveEmployee}>
            <Save className="h-4 w-4" />
            Save
          </button>
        </div>
      </Modal>

      <Modal open={sectionFormOpen} title="Add Section" description="Official name builds hierarchy. Screen name keeps the sheet readable." onClose={() => setSectionFormOpen(false)} size="sm">
        <div className="space-y-4">
          <label className="block">
            <span className="label-shell">Section / Office Name</span>
            <input className="input-shell" value={sectionForm.name} onChange={(event) => setSectionForm((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label className="block">
            <span className="label-shell">Screen Name</span>
            <input className="input-shell" placeholder="Example: Budget-I, DS Budget" value={sectionForm.code} onChange={(event) => setSectionForm((current) => ({ ...current, code: event.target.value }))} />
          </label>
          <label className="block">
            <span className="label-shell">Under Parent</span>
            <select className="input-shell" value={sectionForm.parent} onChange={(event) => setSectionForm((current) => ({ ...current, parent: event.target.value }))}>
              <option value="">No parent</option>
              {sectionOptions.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.label}
                  {section.hint ? ` (${section.hint})` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => setSectionFormOpen(false)}>
            Cancel
          </button>
          <button type="button" className="btn-primary" disabled={saving} onClick={saveNewSection}>
            Save
          </button>
        </div>
      </Modal>

      <Modal open={Boolean(renamingSection)} title="Rename Section" description="Official name builds hierarchy; screen name is shown on the sheet." onClose={() => setRenamingSection(null)} size="sm">
        <label className="block">
          <span className="label-shell">Section Name</span>
          <input className="input-shell" value={nextSectionName} onChange={(event) => setNextSectionName(event.target.value)} />
        </label>
        <label className="mt-4 block">
          <span className="label-shell">Screen Name</span>
          <input className="input-shell" placeholder="Example: Budget-I, DS Budget" value={nextSectionCode} onChange={(event) => setNextSectionCode(event.target.value)} />
        </label>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => setRenamingSection(null)}>
            Cancel
          </button>
          <button type="button" className="btn-primary" disabled={saving} onClick={saveSectionName}>
            Save
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete row"
        description={`Delete ${deleteTarget?.fullName || "this row"} from the active sheet?`}
        confirmLabel="Delete"
        loading={saving}
        onConfirm={archiveEmployee}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default EmployeesPage;
