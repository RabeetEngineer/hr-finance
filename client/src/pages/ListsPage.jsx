import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Printer, Search } from "lucide-react";
import { toast } from "sonner";
import { employeeService } from "@/services/employeeService";
import { designationService } from "@/services/designationService";
import { formatDate } from "@/utils/formatDate";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { designationSummary, statusLabel } from "@/utils/incumbencyCalculations";

const getId = (item) => item?.id || item?._id || item || "";
const clean = (value) => String(value || "").trim();
const compactUnitName = (unit) => clean(unit?.code || unit?.name || unit?.path || "Unassigned");
const compareText = (a, b) => clean(a).localeCompare(clean(b), undefined, { numeric: true, sensitivity: "base" });

const columns = [
  { key: "total", label: "Sr.#" },
  { key: "sectionSerial", label: "Section Sr.#" },
  { key: "name", label: "Name" },
  { key: "fatherName", label: "Father Name" },
  { key: "remarks", label: "Remarks / Notes" },
  { key: "designation", label: "Designation" },
  { key: "serviceCadre", label: "Service/Cadre" },
  { key: "section", label: "Office / Section" },
  { key: "personnelNumber", label: "Personnel No." },
  { key: "cnic", label: "CNIC" },
  { key: "mobileNumber", label: "Cell No." },
  { key: "dateOfBirth", label: "DOB" },
  { key: "joining", label: "Joining" },
  { key: "gender", label: "Gender" },
  { key: "status", label: "Status" },
];

const defaultListColumns = ["total", "name", "remarks", "designation", "section"];
const listColumnDefaultsVersion = 2;

const savedColumnSetting = (key, fallback) => {
  try {
    const saved = JSON.parse(localStorage.getItem("hrf_lists_ui_settings") || "{}");
    if (Number(saved.columnDefaultsVersion || 0) < listColumnDefaultsVersion) {
      const next = { ...saved, [key]: fallback, columnDefaultsVersion: listColumnDefaultsVersion };
      localStorage.setItem("hrf_lists_ui_settings", JSON.stringify(next));
      return fallback;
    }
    return Array.isArray(saved[key]) && saved[key].length ? saved[key] : fallback;
  } catch {
    return fallback;
  }
};

const saveColumnSetting = (key, values) => {
  try {
    const saved = JSON.parse(localStorage.getItem("hrf_lists_ui_settings") || "{}");
    localStorage.setItem(
      "hrf_lists_ui_settings",
      JSON.stringify({ ...saved, [key]: values, columnDefaultsVersion: listColumnDefaultsVersion })
    );
  } catch {
    // localStorage is optional for this page.
  }
};

const fetchAll = async (service, params = {}) => {
  const first = await service.list({ ...params, page: 1, limit: 800 });
  const rows = [...(first.data.data || [])];
  const pages = Number(first.data.meta?.pages || 1);
  for (let page = 2; page <= pages; page += 1) {
    const response = await service.list({ ...params, page, limit: 800 });
    rows.push(...(response.data.data || []));
  }
  return rows;
};

const rowText = (employee) =>
  [
    employee.fullName,
    employee.fatherName,
    employee.designation?.name,
    employee.serviceCadre,
    compactUnitName(employee.currentOfficeSection),
    employee.personnelNumber,
    employee.cnic,
    employee.mobileNumber,
    employee.remarks,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const cellValue = (employee, key, index, sectionIndex) => {
  const values = {
    total: index + 1,
    sectionSerial: sectionIndex,
    name: employee.fullName || "",
    fatherName: employee.fatherName || "",
    remarks: employee.remarks || "",
    designation: employee.designation?.name || "",
    serviceCadre: employee.serviceCadre || "",
    section: compactUnitName(employee.currentOfficeSection),
    personnelNumber: employee.personnelNumber || "",
    cnic: employee.cnic || "",
    mobileNumber: employee.mobileNumber || "",
    dateOfBirth: formatDate(employee.dateOfBirth),
    joining: formatDate(employee.dateOfJoiningCurrentDepartment || employee.dateOfJoiningGovernmentService),
    gender: employee.gender || "",
    status: statusLabel(employee.employmentStatus),
  };
  return values[key] || "";
};

const toggleValue = (values, value) => (values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);

const MultiSelect = ({ label, options, values, onChange }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);
  const selectedLabels = options.filter((option) => values.includes(option.value)).map((option) => option.label);
  const filteredOptions = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle ? options.filter((option) => option.label.toLowerCase().includes(needle)) : options;
  }, [options, search]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button type="button" className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-border bg-white px-3 py-1.5 text-left text-sm" onClick={() => setOpen((value) => !value)}>
        <span className="min-w-0">
          <span className="block truncate text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
          <span className="block truncate text-xs font-semibold text-foreground">{selectedLabels.length ? `${selectedLabels.length} selected` : "Default"}</span>
        </span>
        <span className="text-xs text-muted-foreground">{selectedLabels.length || ""}</span>
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-30 mt-1 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-border bg-surface shadow-soft">
          <div className="border-b border-border bg-surface p-2">
            <input className="input-shell h-9 rounded-md px-3 py-1.5 text-xs" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${label.toLowerCase()}...`} autoFocus />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" className="rounded-md border border-border px-2 py-1.5 text-xs font-bold text-foreground hover:bg-muted" onClick={() => onChange(options.map((option) => option.value))}>
                Select all
              </button>
              <button type="button" className="rounded-md border border-border px-2 py-1.5 text-xs font-bold text-muted-foreground hover:bg-muted" onClick={() => onChange(defaultListColumns)}>
                Default
              </button>
            </div>
          </div>
          <div className="max-h-64 overflow-auto p-2">
            {filteredOptions.map((option) => (
              <label key={option.value} className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                <input type="checkbox" className="mt-1" checked={values.includes(option.value)} onChange={() => onChange(toggleValue(values, option.value))} />
                <span className="font-medium">{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const ListsPage = () => {
  const [designations, setDesignations] = useState([]);
  const [selectedDesignationId, setSelectedDesignationId] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [section, setSection] = useState("");
  const [screenColumns, setScreenColumns] = useState(() => savedColumnSetting("screenColumns", defaultListColumns));
  const [printColumns, setPrintColumns] = useState(() => savedColumnSetting("printColumns", defaultListColumns));

  useEffect(() => {
    const loadDesignations = async () => {
      try {
        setDesignations(await fetchAll(designationService, { isActive: "true", sort: "sortOrder name" }));
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to load designations"));
      }
    };
    loadDesignations();
  }, []);

  const selectedDesignation = useMemo(
    () => designations.find((designation) => String(getId(designation)) === String(selectedDesignationId)) || null,
    [designations, selectedDesignationId]
  );

  const loadDesignation = async (designationId) => {
    setSelectedDesignationId(designationId);
    setQuery("");
    setSection("");
    if (!designationId) {
      setRows([]);
      return;
    }

    setLoading(true);
    try {
      setRows(await fetchAll(employeeService, { designation: designationId, status: "active,vacant", sort: "hierarchy" }));
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load designation list"));
    } finally {
      setLoading(false);
    }
  };

  const sectionOptions = useMemo(() => {
    const sections = new Map();
    rows.forEach((employee) => {
      const id = getId(employee.currentOfficeSection) || "unassigned";
      if (!sections.has(id)) sections.set(id, compactUnitName(employee.currentOfficeSection));
    });
    return [...sections.entries()];
  }, [rows]);

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((employee) => {
      const sectionId = getId(employee.currentOfficeSection) || "unassigned";
      if (section && sectionId !== section) return false;
      if (!needle) return true;
      return rowText(employee).includes(needle);
    });
  }, [query, rows, section]);

  const summary = useMemo(() => designationSummary(rows), [rows]);
  const visibleScreenColumns = useMemo(() => columns.filter((column) => screenColumns.includes(column.key)), [screenColumns]);
  const selectedPrintColumns = useMemo(() => columns.filter((column) => printColumns.includes(column.key)), [printColumns]);
  const sectionSerials = useMemo(() => {
    const counts = new Map();
    return filteredRows.map((employee) => {
      const id = getId(employee.currentOfficeSection) || "unassigned";
      const next = Number(counts.get(id) || 0) + 1;
      counts.set(id, next);
      return next;
    });
  }, [filteredRows]);

  const setScreenColumnSelection = (values) => {
    const next = values.length ? values : defaultListColumns;
    setScreenColumns(next);
    saveColumnSetting("screenColumns", next);
  };

  const setPrintColumnSelection = (values) => {
    const next = values.length ? values : defaultListColumns;
    setPrintColumns(next);
    saveColumnSetting("printColumns", next);
  };

  const exportList = () => {
    const exportColumns = visibleScreenColumns.length ? visibleScreenColumns : columns.filter((column) => defaultListColumns.includes(column.key));
    const csvRows = [exportColumns.map((column) => column.label)];
    filteredRows.forEach((employee, index) => {
      csvRows.push(exportColumns.map((column) => cellValue(employee, column.key, index, sectionSerials[index])));
    });
    const csv = csvRows.map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${clean(selectedDesignation?.name || "designation-list").replace(/\s+/g, "-").toLowerCase()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3 print:block">
      <div className="rounded-lg border border-border bg-surface p-4 shadow-sm no-print">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">Designation-wise Lists</p>
            <h1 className="mt-1 text-xl font-black">Lists</h1>
            <p className="mt-1 text-xs text-muted-foreground">Select one designation to view current filled and vacant rows department-wide.</p>
          </div>
          <Link to="/dashboard" className="btn-secondary w-full px-3 py-2 text-xs sm:w-auto">Back to Dashboard</Link>
        </div>
      </div>

      <section className="rounded-lg border border-border bg-surface p-3 shadow-sm no-print">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_minmax(160px,0.7fr)_minmax(150px,0.7fr)_minmax(150px,0.7fr)_auto]">
          <select className="input-shell" value={selectedDesignationId} onChange={(event) => loadDesignation(event.target.value)}>
            <option value="">Select designation</option>
            {designations
              .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || compareText(a.name, b.name))
              .map((designation) => (
                <option key={getId(designation)} value={getId(designation)}>
                  {designation.name}{designation.bps ? ` - BPS ${designation.bps}` : ""}
                </option>
              ))}
          </select>
          <label className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input className="w-full bg-transparent text-sm outline-none" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search within list..." />
          </label>
          <select className="input-shell" value={section} onChange={(event) => setSection(event.target.value)}>
            <option value="">All sections</option>
            {sectionOptions.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
          <MultiSelect label="Screen columns" options={columns.map((column) => ({ value: column.key, label: column.label }))} values={screenColumns} onChange={setScreenColumnSelection} />
          <MultiSelect label="Print columns" options={columns.map((column) => ({ value: column.key, label: column.label }))} values={printColumns} onChange={setPrintColumnSelection} />
          <div className="grid grid-cols-2 gap-2 md:col-span-2 xl:col-span-1">
            <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={exportList} disabled={!selectedDesignation}>
              <Download className="h-4 w-4" />
              Export
            </button>
            <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={() => window.print()} disabled={!selectedDesignation}>
              <Printer className="h-4 w-4" />
              Print
            </button>
          </div>
        </div>
      </section>

      {selectedDesignation ? (
        <>
          <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Designation</p>
                <h2 className="mt-1 text-xl font-black">{selectedDesignation.name}</h2>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Total Strength", summary.totalStrength],
                  ["Filled", summary.active],
                  ["Vacant", summary.vacant],
                  ["Sections Covered", summary.sectionsCovered],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-surface-2 px-3 py-2">
                    <p className="text-[11px] font-bold text-muted-foreground">{label}</p>
                    <p className="text-lg font-black">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-surface p-3 shadow-sm screen-only">
            <div className="hidden overflow-auto md:block">
              <table className="incumbency-table w-full min-w-fit border-collapse text-xs">
                <thead>
                  <tr>
                    {visibleScreenColumns.map((column) => (
                      <th key={column.key}>{column.label}</th>
                    ))}
                    <th className="no-print text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={visibleScreenColumns.length + 1} className="py-8 text-center text-muted-foreground">Loading designation list...</td>
                    </tr>
                  ) : filteredRows.length ? (
                    filteredRows.map((employee, index) => (
                      <tr key={employee.id || employee._id} className={employee.employmentStatus === "vacant" ? "vacant-row" : undefined}>
                        {visibleScreenColumns.map((column) => (
                          <td key={column.key} className={column.key === "gender" ? "capitalize" : undefined}>
                            {cellValue(employee, column.key, index, sectionSerials[index]) || "-"}
                          </td>
                        ))}
                        <td className="no-print text-right">
                          <Link to="/employees" className="font-bold text-primary">View Sheet</Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={visibleScreenColumns.length + 1} className="py-8 text-center text-muted-foreground">No current records found for this designation.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 md:hidden">
              {loading ? (
                <div className="rounded-lg border border-border bg-surface-2 p-6 text-center text-sm font-semibold text-muted-foreground">Loading designation list...</div>
              ) : filteredRows.length ? (
                filteredRows.map((employee, index) => (
                  <div key={`mobile-list-${employee.id || employee._id}`} className={employee.employmentStatus === "vacant" ? "rounded-lg border border-slate-300 bg-slate-50 p-4 shadow-sm" : "rounded-lg border border-border bg-white p-4 shadow-sm"}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Sr.# {index + 1}</p>
                        <h3 className="mt-1 truncate text-base font-black">{employee.fullName || "-"}</h3>
                        <p className="text-sm font-semibold text-muted-foreground">{employee.designation?.name || "-"}</p>
                      </div>
                      <span className={employee.employmentStatus === "vacant" ? "rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700" : "rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700"}>
                        {statusLabel(employee.employmentStatus)}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Remarks</span>
                        <span className="text-right font-semibold">{employee.remarks || "-"}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Office / Section</span>
                        <span className="text-right font-semibold">{compactUnitName(employee.currentOfficeSection)}</span>
                      </div>
                    </div>
                    <Link to="/employees" className="mt-3 inline-flex text-sm font-bold text-primary">View Sheet</Link>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-border bg-surface-2 p-6 text-center text-sm font-semibold text-muted-foreground">No current records found for this designation.</div>
              )}
            </div>
          </section>

          <section className="print-only">
            <table className="incumbency-table w-full border-collapse text-xs">
              <thead>
                <tr>
                  {selectedPrintColumns.map((column) => (
                    <th key={column.key}>{column.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((employee, index) => (
                  <tr key={`print-${employee.id || employee._id}`}>
                    {selectedPrintColumns.map((column) => (
                      <td key={column.key}>{cellValue(employee, column.key, index, sectionSerials[index]) || "-"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      ) : (
        <section className="rounded-lg border border-border bg-surface p-8 text-center text-sm font-semibold text-muted-foreground shadow-sm">
          Select a designation to open its current department-wide list.
        </section>
      )}
    </div>
  );
};

export default ListsPage;
