import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Crown, FileDown, Pencil, Plus, Printer, RefreshCw, Save, Search, Star, Trash2, X } from "lucide-react";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import Modal from "@/components/common/Modal";
import { employeeService } from "@/services/employeeService";
import { designationService } from "@/services/designationService";
import { organizationUnitService } from "@/services/organizationUnitService";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@/utils/formatDate";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { applyUiSettings } from "@/utils/applyUiSettings";
import { notifyResourceChanged, subscribeResourceChanged } from "@/utils/resourceEvents";
import { toast } from "sonner";

const blankForm = {
  fullName: "",
  fatherName: "",
  designationName: "",
  serviceCadre: "",
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
  { key: "serviceCadre", label: "Service/Cadre" },
  { key: "section", label: "Section" },
  { key: "personnelNumber", label: "Personnel No." },
  { key: "cnic", label: "CNIC" },
  { key: "mobileNumber", label: "Cell No." },
  { key: "dateOfBirth", label: "DOB" },
  { key: "joining", label: "Joining" },
  { key: "gender", label: "Gender" },
  { key: "status", label: "Status" },
];

const defaultPrintColumns = ["total", "name", "designation", "section"];
const screenColumnOptions = printColumnOptions;
const defaultScreenColumns = ["total", "sectionSerial", "name", "fatherName", "designation", "personnelNumber", "joining", "status"];

const savedColumnSetting = (key, fallback) => {
  try {
    const saved = JSON.parse(localStorage.getItem("hrf_ui_settings") || "{}");
    return Array.isArray(saved[key]) && saved[key].length ? saved[key] : fallback;
  } catch {
    return fallback;
  }
};

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
    employee.serviceCadre,
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
const statusLabel = (value) => clean(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Active";

const toggleValue = (values, value) => (values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
const normalizeSearch = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/\baddl\.?\b/g, "additional")
    .replace(/\bdy\.?\b/g, "deputy")
    .replace(/\bsecy\b/g, "secretary")
    .replace(/\bfin\.?\b/g, "finance")
    .replace(/\s+/g, " ")
    .trim();

const MultiSelect = ({ label, options, values, onChange, maxVisible = 2, summaryMode = "names" }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);
  const selectedLabels = options.filter((option) => values.includes(option.value)).map((option) => option.label);
  const filteredOptions = useMemo(() => {
    const needle = normalizeSearch(search);
    if (!needle) return options;
    const scoreOption = (option) => {
      const label = normalizeSearch(option.label);
      const name = normalizeSearch(option.name);
      const hint = normalizeSearch(option.hint);
      const pathText = normalizeSearch(option.pathText);
      const searchText = normalizeSearch(option.searchText);
      const directText = `${label} ${name}`.trim();
      if (label === needle || name === needle) return 0;
      if (label.startsWith(needle) || name.startsWith(needle)) return 1;
      if (directText.includes(needle)) return 2;
      if (hint.includes(needle)) return 5;
      if (pathText.includes(needle) || searchText.includes(needle)) return 8;
      return 99;
    };
    return options
      .map((option) => ({ option, score: scoreOption(option) }))
      .filter((row) => row.score < 99)
      .sort((a, b) => a.score - b.score || String(a.option.label).localeCompare(String(b.option.label), undefined, { sensitivity: "base" }))
      .map((row) => row.option);
  }, [options, search]);

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
      <button type="button" className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-border bg-white px-3 py-1.5 text-left text-sm" onClick={() => setOpen((value) => !value)}>
        <span className="min-w-0">
          <span className="block truncate text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
          <span className="block truncate text-xs font-semibold text-foreground">
            {summaryMode === "count" && selectedLabels.length ? `${selectedLabels.length} selected` : selectedLabels.length ? selectedLabels.slice(0, maxVisible).join(", ") : "All"}
            {summaryMode !== "count" && selectedLabels.length > maxVisible ? ` +${selectedLabels.length - maxVisible}` : ""}
          </span>
        </span>
        <span className="text-xs text-muted-foreground">{selectedLabels.length || ""}</span>
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-30 mt-1 w-80 overflow-hidden rounded-lg border border-border bg-surface shadow-soft">
        <div className="border-b border-border bg-surface p-2">
          <input
            className="input-shell h-9 rounded-md px-3 py-1.5 text-xs"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onInput={(event) => setSearch(event.currentTarget.value)}
            placeholder={`Search ${label.toLowerCase()}...`}
            autoFocus
          />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" className="rounded-md border border-border px-2 py-1.5 text-xs font-bold text-foreground hover:bg-muted" onClick={() => onChange(options.map((option) => option.value))}>
              Select all
            </button>
            <button type="button" className="rounded-md border border-border px-2 py-1.5 text-xs font-bold text-muted-foreground hover:bg-muted" onClick={() => onChange([])}>
              Unselect all
            </button>
          </div>
        </div>
        <div className="max-h-64 overflow-auto p-2">
        {filteredOptions.length ? filteredOptions.map((option) => (
          <label key={option.value} className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
            <input type="checkbox" className="mt-1" checked={values.includes(option.value)} onChange={() => onChange(toggleValue(values, option.value))} />
            <span>
              <span className="block font-medium">{option.label}</span>
              {option.hint ? <span className="block text-xs text-muted-foreground">{option.hint}</span> : null}
            </span>
          </label>
        )) : <div className="px-2 py-4 text-center text-xs font-semibold text-muted-foreground">No matching option.</div>}
        </div>
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

const EmployeesPage = ({ publicMode = false }) => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [sections, setSections] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({ q: "", designations: [], sections: [], gender: "", sort: "hierarchy", pageSize: 25 });
  const [employeeMeta, setEmployeeMeta] = useState({ page: 1, limit: 25, total: 0, pages: 1 });
  const [sectionCounts, setSectionCounts] = useState({});
  const [screenColumns, setScreenColumns] = useState(() => savedColumnSetting("screenColumns", defaultScreenColumns));
  const [printColumns, setPrintColumns] = useState(() => savedColumnSetting("printColumns", defaultPrintColumns));
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState("edit");
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [renamingSection, setRenamingSection] = useState(null);
  const [nextSectionName, setNextSectionName] = useState("");
  const [nextSectionCode, setNextSectionCode] = useState("");
  const [sectionFormOpen, setSectionFormOpen] = useState(false);
  const [sectionForm, setSectionForm] = useState(blankSectionForm);
  const [uiSettings, setUiSettings] = useState(defaultUiSettings);
  const employeeRequestRef = useRef(0);
  const sectionCountRequestRef = useRef(0);

  useEffect(() => {
    const loadSettings = () => setUiSettings({ ...defaultUiSettings, ...JSON.parse(localStorage.getItem("hrf_ui_settings") || "{}") });
    applyUiSettings();
    loadSettings();
    window.addEventListener("hrf-ui-settings-changed", loadSettings);
    window.addEventListener("hrf-ui-settings-changed", applyUiSettings);
    return () => {
      window.removeEventListener("hrf-ui-settings-changed", loadSettings);
      window.removeEventListener("hrf-ui-settings-changed", applyUiSettings);
    };
  }, []);

  const employeeQueryParams = useCallback(
    (overrides = {}) => {
      const sortMap = {
        hierarchy: "hierarchy",
        name: "fullName",
        personnel: "personnelNumber fullName",
        gender: "gender fullName",
        designation: "sortOrder fullName",
        section: "sortOrder fullName",
      };

      return {
        page,
        limit: filters.pageSize,
        sort: sortMap[filters.sort] || "sortOrder fullName",
        status: "active",
        q: clean(filters.q) || undefined,
        designationIds: filters.designations.length ? filters.designations.join(",") : undefined,
        sectionIds: filters.sections.length ? filters.sections.join(",") : undefined,
        gender: filters.gender || undefined,
        ...overrides,
      };
    },
    [filters, page]
  );

  const loadMasterData = useCallback(async () => {
    try {
      const [sectionRows, designationRows] = await Promise.all([
        fetchAll(organizationUnitService, { isActive: "true", sort: "sortOrder name" }),
        fetchAll(designationService, { isActive: "true", sort: "sortOrder name" }),
      ]);

      setSections(sectionRows);
      setDesignations(designationRows);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load offices and designations"));
    }
  }, []);

  const loadEmployees = useCallback(async () => {
    const requestId = employeeRequestRef.current + 1;
    employeeRequestRef.current = requestId;
    setLoading(true);
    try {
      const response = await employeeService.list(employeeQueryParams());
      if (requestId !== employeeRequestRef.current) return;
      setEmployees(response.data.data || []);
      setEmployeeMeta(response.data.meta || { page, limit: filters.pageSize, total: 0, pages: 1 });
    } catch (error) {
      if (requestId !== employeeRequestRef.current) return;
      toast.error(getErrorMessage(error, "Failed to load employees"));
    } finally {
      if (requestId === employeeRequestRef.current) setLoading(false);
    }
  }, [employeeQueryParams, filters.pageSize, page]);

  const loadSectionCounts = useCallback(async () => {
    const requestId = sectionCountRequestRef.current + 1;
    sectionCountRequestRef.current = requestId;
    try {
      const response = await employeeService.sectionCounts(employeeQueryParams({ page: undefined, limit: undefined, sectionIds: undefined, sort: undefined }));
      if (requestId !== sectionCountRequestRef.current) return;
      const nextCounts = {};
      (response.data.data || []).forEach((row) => {
        nextCounts[String(row.sectionId || "unassigned")] = Number(row.count || 0);
      });
      setSectionCounts(nextCounts);
    } catch {
      if (requestId !== sectionCountRequestRef.current) return;
      setSectionCounts({});
    }
  }, [employeeQueryParams]);

  useEffect(() => {
    loadMasterData();
  }, [loadMasterData]);

  useEffect(() => {
    loadEmployees();
    loadSectionCounts();
  }, [loadEmployees, loadSectionCounts]);

  useEffect(() => {
    const unsubscribe = subscribeResourceChanged(({ resource }) => {
      if (resource === "employees") {
        loadEmployees();
        loadSectionCounts();
      }
      if (["organization-units", "designations"].includes(resource)) {
        loadMasterData();
      }
    });

    return () => unsubscribe();
  }, [loadEmployees, loadMasterData, loadSectionCounts]);

  const canEditEmployees = !publicMode && ["super_admin", "admin", "data_entry"].includes(user?.role);
  const canManageStructure = !publicMode && ["super_admin", "admin"].includes(user?.role);
  const canDeleteEmployees = !publicMode && ["super_admin", "admin"].includes(user?.role);
  const showActions = canEditEmployees || canManageStructure || canDeleteEmployees;
  const visibleScreenColumns = useMemo(() => {
    const selected = screenColumnOptions.filter((option) => screenColumns.includes(option.key));
    return selected.length ? selected : screenColumnOptions.filter((option) => defaultScreenColumns.includes(option.key));
  }, [screenColumns]);
  const tableColSpan = visibleScreenColumns.length + (showActions ? 1 : 0);

  const updateFilters = (patch) => {
    setPage(1);
    setFilters((current) => ({ ...current, ...patch }));
  };

  const sectionsById = useMemo(() => new Map(sections.map((section) => [String(getId(section)), section])), [sections]);
  const designationOptions = useMemo(
    () =>
      designations
        .filter((designation) => designation.isActive !== false)
        .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || compareText(a.name, b.name))
        .map((designation) => ({ value: getId(designation), label: designation.name })),
    [designations]
  );
  const activeDesignationOptions = useMemo(
    () =>
      designations
        .filter((designation) => designation.isActive !== false)
        .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || compareText(a.name, b.name))
        .map((designation) => ({ value: designation.name, label: designation.name, hint: designation.bps ? `BPS ${designation.bps}` : "" })),
    [designations]
  );
  const sectionOptions = useMemo(
    () =>
      [...sections]
        .sort((a, b) => compareText(compactUnitName(a), compactUnitName(b)))
        .map((section) => ({
          id: getId(section),
          value: getId(section),
          label: compactUnitName(section),
          hint: parentHint(section, sectionsById),
          name: section.name,
          searchText: [section.name, section.code, section.path, compactUnitName(section), parentHint(section, sectionsById)].filter(Boolean).join(" "),
          pathText: section.path || "",
        })),
    [sections, sectionsById]
  );
  const employeeSectionOptions = useMemo(
    () => sectionOptions.map((section) => ({ ...section, value: section.label })),
    [sectionOptions]
  );
  const selectedSectionId = filters.sections.length === 1 ? filters.sections[0] : "";
  const selectedSection = selectedSectionId ? sectionsById.get(String(selectedSectionId)) : null;
  const filteredEmployees = useMemo(() => {
    return employees;
  }, [employees]);

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
    const includeEmptySections = false;

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

  const serverRowOffset = (page - 1) * (Number(filters.pageSize) || 25);

  const displayRows = useMemo(() => {
    if (filters.sort !== "hierarchy") {
      return sortedEmployees.map((employee, index) => ({ type: "employee", employee, globalIndex: serverRowOffset + index + 1, sectionIndex: null }));
    }

    let globalIndex = serverRowOffset;
    return hierarchySections.flatMap((section) => {
      const header = [{ type: "section", section }];
      const rows = section.rows.map((employee, index) => {
        globalIndex += 1;
        return { type: "employee", employee, section, globalIndex, sectionIndex: index + 1 };
      });
      if (!rows.length) return [...header, { type: "empty", section }];
      return [...header, ...rows];
    });
  }, [filters.sort, hierarchySections, serverRowOffset, sortedEmployees]);

  const employeeDisplayRows = displayRows.filter((row) => row.type === "employee");
  const totalEmployees = Number(employeeMeta.total || employeeDisplayRows.length);
  const pageSize = Number(employeeMeta.limit || filters.pageSize) || 25;
  const totalPages = Math.max(Number(employeeMeta.pages || 1), 1);
  const startEmployee = (page - 1) * pageSize;
  const endEmployee = startEmployee + employeeDisplayRows.length;

  const pagedRows = useMemo(() => {
    return filters.sort === "hierarchy" ? displayRows : employeeDisplayRows;
  }, [displayRows, employeeDisplayRows, filters.sort]);

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
      serviceCadre: employee.serviceCadre || "",
      section: compactUnitName(employee.currentOfficeSection) || "",
      personnelNumber: employee.personnelNumber || "",
      cnic: employee.cnic || "",
      mobileNumber: employee.mobileNumber || "",
      dateOfBirth: formatDate(employee.dateOfBirth),
      joining: formatDate(employee.dateOfJoiningCurrentDepartment || employee.dateOfJoiningGovernmentService),
      gender: employee.gender || "",
      status: employee.isOfficeHead ? "Head" : statusLabel(employee.employmentStatus || "active"),
    };

    return values[key] || "";
  };

  const screenCellValue = (row, key) => printCellValue(row, key);

  const stats = useMemo(() => {
    const male = filteredEmployees.filter((employee) => employee.gender === "male").length;
    const female = filteredEmployees.filter((employee) => employee.gender === "female").length;
    return { total: totalEmployees, sections: Object.values(sectionCounts).filter((count) => count > 0).length, male, female };
  }, [filteredEmployees, sectionCounts, totalEmployees]);

  const openAddForm = (sectionName = "") => {
    setEditingEmployee(null);
    setFormMode("add");
    setForm({ ...blankForm, sectionName });
    setFormOpen(true);
  };

  const openEditForm = (employee, mode = "edit") => {
    setEditingEmployee(employee);
    setFormMode(mode);
    setForm({
      fullName: employee.fullName || "",
      fatherName: employee.fatherName || "",
      designationName: employee.designation?.name || "",
      serviceCadre: employee.serviceCadre || "",
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

  const openTransferForm = (employee) => {
    openEditForm(employee, "transfer");
    toast.info("Office / Section change kar ke Save karein, ya Incumbency Action se another department / retirement choose karein.");
  };

  const captureScrollPosition = () => {
    const sheet = document.querySelector(".sheet-scroll");
    return {
      windowX: window.scrollX,
      windowY: window.scrollY,
      sheetLeft: sheet?.scrollLeft || 0,
      sheetTop: sheet?.scrollTop || 0,
    };
  };

  const restoreScrollPosition = (position) => {
    window.scrollTo(position.windowX, position.windowY);
    const sheet = document.querySelector(".sheet-scroll");
    if (sheet) {
      sheet.scrollLeft = position.sheetLeft;
      sheet.scrollTop = position.sheetTop;
    }
  };

  const reloadDataInPlace = async () => {
    const position = captureScrollPosition();
    await loadEmployees();
    await loadSectionCounts();
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => restoreScrollPosition(position));
    });
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
      serviceCadre: clean(form.serviceCadre) || undefined,
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
      await reloadDataInPlace();
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
      await reloadDataInPlace();
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not delete row"));
    } finally {
      setSaving(false);
    }
  };

  const moveRow = async (section, employeeId, direction) => {
    const rows = section?.id
      ? await fetchAll(employeeService, { section: section.id, sort: "sortOrder fullName", status: "active" })
      : section.rows || [];
    const rowIndex = rows.findIndex((employee) => String(getId(employee)) === String(employeeId));
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
      await reloadDataInPlace();
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not move row"));
    } finally {
      setSaving(false);
    }
  };

  const toggleOfficeHead = async (employee) => {
    setSaving(true);
    try {
      await employeeService.update(getId(employee), { isOfficeHead: !employee.isOfficeHead });
      toast.success(employee.isOfficeHead ? "Office head mark removed" : "Office head highlighted");
      notifyResourceChanged("employees");
      await reloadDataInPlace();
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not update office head"));
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
      await reloadDataInPlace();
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
      await reloadDataInPlace();
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not add section"));
    } finally {
      setSaving(false);
    }
  };

  const resetFilters = () => {
    setPage(1);
    setFilters({ q: "", designations: [], sections: [], gender: "", sort: "hierarchy", pageSize: 25 });
  };

  const exportSheet = async () => {
    const csvRows = [];
    csvRows.push(visibleScreenColumns.map((column) => column.label));

    try {
      const rows = await fetchAll(employeeService, employeeQueryParams({ page: 1, limit: 200 }));
      rows.forEach((employee, index) => {
        csvRows.push(visibleScreenColumns.map((column) => screenCellValue({ type: "employee", employee, globalIndex: index + 1, sectionIndex: "" }, column.key) || ""));
      });
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not export employees"));
      return;
    }

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

      <div className="no-print rounded-xl border border-border bg-surface px-3 py-2 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-700">Punjab Finance Department</p>
            <h1 className="text-lg font-black text-foreground">{selectedSection ? compactUnitName(selectedSection) : "Employee Directory"}</h1>
            {publicMode ? <p className="mt-1 text-xs text-muted-foreground">Public read-only view</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs font-bold">{stats.total} employees</span>
            <span className="rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs font-bold">{stats.sections} sections</span>
            <span className="rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs font-bold">Showing {employeeDisplayRows.length}</span>
            <button type="button" className="btn-secondary px-2.5 py-1.5 text-xs" disabled={loading} onClick={reloadDataInPlace}>
              <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Refresh
            </button>
            <button type="button" className="btn-secondary px-2.5 py-1.5 text-xs" onClick={printSheet}>
              <Printer className="h-4 w-4" />
              Print
            </button>
            <button type="button" className="btn-secondary px-2.5 py-1.5 text-xs" onClick={exportSheet}>
              <FileDown className="h-4 w-4" />
              Export Excel
            </button>
            {publicMode ? (
              <Link to="/login" className="btn-primary px-2.5 py-1.5 text-xs">
                Login to edit
              </Link>
            ) : null}
            {canManageStructure ? (
              <button type="button" className="btn-secondary px-2.5 py-1.5 text-xs" onClick={() => openAddSection()}>
                <Plus className="h-4 w-4" />
                Add Section
              </button>
            ) : null}
            {canEditEmployees ? (
              <button type="button" className="btn-primary px-2.5 py-1.5 text-xs" onClick={() => openAddForm()}>
                <Plus className="h-4 w-4" />
                Add Employee
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-1.5 grid gap-2 lg:grid-cols-[minmax(260px,1.4fr)_minmax(170px,0.8fr)_minmax(170px,0.8fr)_130px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="input-shell h-10 rounded-lg py-2 pl-9 pr-3"
              value={filters.q}
              onChange={(event) => updateFilters({ q: event.target.value })}
              placeholder="Search name, CNIC, designation, section, cell..."
            />
          </label>
          <MultiSelect label="Designations" options={designationOptions} values={filters.designations} onChange={(values) => updateFilters({ designations: values })} />
          <MultiSelect label="Offices / Sections" options={sectionOptions} values={filters.sections} onChange={(values) => updateFilters({ sections: values })} />
          <select className="input-shell rounded-lg px-3 py-2" value={filters.gender} onChange={(event) => updateFilters({ gender: event.target.value })}>
              <option value="">All gender</option>
              {genderOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-surface-2/70 p-1.5">
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">View</span>
          <select className="input-shell h-9 min-w-36 max-w-44 rounded-lg px-3 py-1.5" value={filters.sort} onChange={(event) => updateFilters({ sort: event.target.value })}>
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          <select className="input-shell h-9 min-w-32 max-w-40 rounded-lg px-3 py-1.5" value={filters.pageSize} onChange={(event) => updateFilters({ pageSize: Number(event.target.value) })}>
              {[25, 50, 100, 150, 200, 500, 700, 800].map((size) => (
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

      <div className="screen-only">
        <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm print:border-0">
        {loading ? (
          <div className="p-8 text-center text-sm font-semibold text-muted-foreground">Loading incumbency sheet...</div>
        ) : (
          <>
          <div className="sheet-scroll hidden md:block">
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
                              <span className="text-sm md:text-[15px]">
                                {row.section.name}
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
                      <tr key={getId(employee)} className={employee.isOfficeHead ? "office-head-row" : undefined}>
                        {visibleScreenColumns.map((column) => (
                          <td key={column.key} className={column.key === "name" ? "font-semibold text-foreground" : column.key === "gender" ? "capitalize" : undefined}>
                            {column.key === "name" ? (
                              <span className="inline-flex items-center gap-1.5">
                                {employee.isOfficeHead ? <Crown className="h-3.5 w-3.5 text-amber-600" /> : null}
                                {screenCellValue(row, column.key) || "-"}
                              </span>
                            ) : (
                              screenCellValue(row, column.key) || "-"
                            )}
                          </td>
                        ))}
                        {showActions ? (
                          <td className="no-print">
                            <div className="flex justify-end gap-1">
                              {canEditEmployees ? (
                                <button type="button" className={employee.isOfficeHead ? "icon-action text-amber-700" : "icon-action"} title={employee.isOfficeHead ? "Remove head highlight" : "Mark as office head"} disabled={saving} onClick={() => toggleOfficeHead(employee)}>
                                  <Star className={employee.isOfficeHead ? "h-3.5 w-3.5 fill-current" : "h-3.5 w-3.5"} />
                                </button>
                              ) : null}
                              {canEditEmployees && row.section ? (
                                <>
                                  <button type="button" className="icon-action" title="Move up" disabled={saving || row.sectionIndex === 1} onClick={() => moveRow(row.section, getId(employee), "up")}>
                                    <ArrowUp className="h-3.5 w-3.5" />
                                  </button>
                                  <button type="button" className="icon-action" title="Move down" disabled={saving || row.sectionIndex === row.section.rows.length} onClick={() => moveRow(row.section, getId(employee), "down")}>
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
          <div className="space-y-3 p-2 md:hidden">
            {pagedRows.length ? (
              pagedRows.map((row, index) => {
                if (row.type === "section") {
                  return (
                    <div key={`mobile-section-${row.section.id}-${index}`} className="rounded-xl border border-border bg-surface-2 px-3 py-3">
                      <p className="text-base font-black">{row.section.name}</p>
                    </div>
                  );
                }
                if (row.type !== "employee") return null;
                const employee = row.employee;
                const mobileDetailColumns = visibleScreenColumns.filter((column) => !["name", "designation"].includes(column.key));
                return (
                  <div key={`mobile-employee-${getId(employee)}`} className={employee.isOfficeHead ? "rounded-xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm" : "rounded-xl border border-border bg-surface p-4 shadow-sm"}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="inline-flex items-center gap-1.5 text-base font-black">
                          {employee.isOfficeHead ? <Crown className="h-4 w-4 text-amber-600" /> : null}
                          {employee.fullName || "-"}
                        </p>
                        <p className="text-sm text-muted-foreground">{employee.designation?.name || "-"}</p>
                      </div>
                      <span className={employee.isOfficeHead ? "rounded-md bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800" : "rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700"}>
                        {employee.isOfficeHead ? "Head" : "Active"}
                      </span>
                    </div>
                    {mobileDetailColumns.length ? (
                      <div className="mt-4 grid gap-2 text-sm">
                        {mobileDetailColumns.map((column) => (
                          <div key={column.key} className="flex justify-between gap-3">
                            <span className="text-muted-foreground">{column.label}</span>
                            <span className="text-right font-semibold">{screenCellValue(row, column.key) || "-"}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {showActions ? (
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        {canEditEmployees && row.section ? (
                          <>
                            <button type="button" className="btn-secondary px-3 py-2 text-xs" disabled={saving || row.sectionIndex === 1} onClick={() => moveRow(row.section, getId(employee), "up")}>
                              <ArrowUp className="h-4 w-4" />
                              Move Up
                            </button>
                            <button type="button" className="btn-secondary px-3 py-2 text-xs" disabled={saving || row.sectionIndex === row.section.rows.length} onClick={() => moveRow(row.section, getId(employee), "down")}>
                              <ArrowDown className="h-4 w-4" />
                              Move Down
                            </button>
                          </>
                        ) : null}
                        {canEditEmployees ? (
                          <>
                            <button type="button" className={employee.isOfficeHead ? "btn-secondary px-3 py-2 text-xs text-amber-700" : "btn-secondary px-3 py-2 text-xs"} disabled={saving} onClick={() => toggleOfficeHead(employee)}>
                              <Star className={employee.isOfficeHead ? "h-4 w-4 fill-current" : "h-4 w-4"} />
                              {employee.isOfficeHead ? "Unmark Head" : "Mark Head"}
                            </button>
                            <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={() => openEditForm(employee, "transfer")}>
                              <Pencil className="h-4 w-4" />
                              Edit/Transfer
                            </button>
                          </>
                        ) : null}
                        {canDeleteEmployees ? (
                          <button type="button" className="btn-secondary col-span-2 px-3 py-2 text-xs text-danger" onClick={() => setDeleteTarget(employee)}>
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted-foreground">No records match the current filters.</div>
            )}
          </div>
          </>
        )}
        </section>
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

      <Modal
        open={formOpen}
        title={formMode === "transfer" ? "Transfer Row" : editingEmployee ? "Edit Row" : "Add Row"}
        description={
          formMode === "transfer"
            ? "Office / Section change karein for internal transfer, ya Incumbency Action se another department / retirement select karein."
            : "Section change works like a simple transfer."
        }
        onClose={() => setFormOpen(false)}
        size="lg"
      >
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
          <label className="block">
            <span className="label-shell">Service/Cadre</span>
            <input className="input-shell" placeholder="Example: PAS, PMS, Secretariat, Technical..." value={form.serviceCadre} onChange={(event) => setForm((current) => ({ ...current, serviceCadre: event.target.value }))} />
          </label>
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
