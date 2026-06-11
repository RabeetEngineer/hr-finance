import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Plus, RefreshCw, UploadCloud } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { importService } from "@/services/importService";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { notifyResourceChanged } from "@/utils/resourceEvents";
import { toast } from "sonner";

const sampleText = `Name\tDesignation\tOffice Name\tCNIC\tCell\tDOB\tAddress
Mr. Mujahid Sherdil\tFinance Secretary\tO/O FINANCE SECRETARY\t\t0300 0000000\t01/01/1970\tLahore
Vacant\tProgrammer\tO/O FINANCE SECRETARY\t\t\t\t
\tAssistant\tBUDGET SECTION-I\t\t\t\t
Ms. Misbah Asghar\tBudget Officer\tBUDGET SECTION-I\t\t0300 1111111\t05/08/1985\tLahore`;

const fieldOptions = [
  { key: "", label: "Do not import" },
  { key: "fullName", label: "Name" },
  { key: "designationName", label: "Designation" },
  { key: "officeName", label: "Office / Section" },
  { key: "fatherName", label: "Father Name" },
  { key: "cnic", label: "CNIC" },
  { key: "mobileNumber", label: "Cell / Mobile" },
  { key: "dateOfBirth", label: "DOB" },
  { key: "address", label: "Address" },
  { key: "personnelNumber", label: "Personnel No." },
  { key: "serviceCadre", label: "Service / Cadre" },
  { key: "gender", label: "Gender" },
  { key: "email", label: "Email" },
  { key: "district", label: "District" },
  { key: "domicile", label: "Domicile" },
  { key: "qualification", label: "Qualification" },
  { key: "joiningDate", label: "Joining Date" },
  { key: "employmentStatus", label: "Status" },
  { key: "remarks", label: "Remarks" },
];

const fieldAliases = {
  fullName: ["name", "employee name", "full name", "officer name", "official name"],
  designationName: ["designation", "desgination", "post", "job title", "title"],
  officeName: ["office", "office name", "section", "section name", "office section", "department"],
  fatherName: ["father", "father name"],
  cnic: ["cnic", "nic", "id card"],
  mobileNumber: ["cell", "cell no", "cell number", "mobile", "mobile number", "phone"],
  dateOfBirth: ["dob", "date of birth", "birth date"],
  address: ["address"],
  personnelNumber: ["personnel", "personnel no", "personnel number", "employee no"],
  serviceCadre: ["cadre", "service cadre", "service"],
  gender: ["gender", "sex"],
  email: ["email", "email address"],
  district: ["district"],
  domicile: ["domicile"],
  qualification: ["qualification", "education"],
  joiningDate: ["joining", "joining date", "date of joining", "doj"],
  employmentStatus: ["status", "employment status", "incumbency action"],
  remarks: ["remarks", "remark", "notes"],
};

const clean = (value) => String(value || "").trim();
const headerKey = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const splitRow = (line) => {
  const text = String(line || "");
  if (text.includes("\t")) return text.split("\t");
  const cells = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
};

const inferField = (label) => {
  const normalized = headerKey(label);
  return Object.entries(fieldAliases).find(([, aliases]) => aliases.some((alias) => alias === normalized || normalized.includes(alias)))?.[0] || "";
};

const Metric = ({ label, value, hint }) => (
  <div className="rounded-lg border border-border bg-surface px-4 py-3">
    <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
    <p className="mt-1 text-2xl font-black">{value}</p>
    {hint ? <p className="mt-1 text-[11px] font-semibold text-muted-foreground">{hint}</p> : null}
  </div>
);

const ListPanel = ({ title, items, emptyText, tone = "warning", action }) => {
  const isWarning = tone === "warning";
  return (
    <div className={isWarning ? "rounded-lg border border-amber-200 bg-amber-50 p-3" : "rounded-lg border border-emerald-200 bg-emerald-50 p-3"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className={isWarning ? "font-black text-amber-900" : "font-black text-emerald-900"}>{title}</h3>
        {action}
      </div>
      {items.length ? (
        <div className="mt-3 max-h-48 overflow-auto rounded-md bg-white/80 p-2">
          {items.map((item) => (
            <p key={item} className="border-b border-border py-1 text-sm last:border-b-0">
              {item}
            </p>
          ))}
        </div>
      ) : (
        <p className={isWarning ? "mt-3 text-sm text-amber-800" : "mt-3 text-sm text-emerald-800"}>{emptyText}</p>
      )}
    </div>
  );
};

const ImportIncumbencyPage = () => {
  const [rawText, setRawText] = useState("");
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [creatingDesignations, setCreatingDesignations] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [autoCreateDesignations, setAutoCreateDesignations] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [columnMapping, setColumnMapping] = useState({});

  const pastedColumns = useMemo(() => {
    const firstRow = rawText
      .replace(/\r/g, "")
      .split("\n")
      .map(splitRow)
      .find((cells) => cells.some((cell) => clean(cell)));
    return (firstRow || []).map((cell, index) => ({ index, label: clean(cell) || `Column ${index + 1}`, inferredField: inferField(cell) }));
  }, [rawText]);

  const mappingSignature = pastedColumns.map((column) => `${column.index}:${column.label}`).join("|");

  useEffect(() => {
    const next = {};
    pastedColumns.forEach((column) => {
      if (column.inferredField && next[column.inferredField] === undefined) next[column.inferredField] = column.index;
    });
    setColumnMapping(next);
  }, [mappingSignature]);

  const mappedFieldSet = useMemo(() => new Set(Object.keys(columnMapping).filter((key) => columnMapping[key] !== "" && columnMapping[key] !== undefined)), [columnMapping]);
  const requiredMappingReady = columnMapping.designationName !== undefined && columnMapping.officeName !== undefined;

  const canImport = useMemo(() => {
    if (!preview) return false;
    if (preview.missingOffices?.length) return false;
    if (preview.missingDesignations?.length && !autoCreateDesignations) return false;
    return Number(preview.totals?.readyRows || 0) > 0 || (autoCreateDesignations && Number(preview.totals?.employeesFound || 0) > 0);
  }, [autoCreateDesignations, preview]);

  const runPreview = async () => {
    if (!rawText.trim()) {
      toast.error("Paste Google Sheets data first");
      return;
    }
    if (!requiredMappingReady) {
      toast.error("Map Designation and Office / Section columns first");
      return;
    }

    setLoading(true);
    try {
      const response = await importService.previewIncumbency(rawText, columnMapping);
      setPreview(response.data.data);
      setImportResult(null);
      toast.success("Preview ready");
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not preview import"));
    } finally {
      setLoading(false);
    }
  };

  const createMissingDesignations = async () => {
    setCreatingDesignations(true);
    try {
      const response = await importService.createMissingDesignations(rawText, columnMapping);
      toast.success(`${response.data.data.created.length} designations created`);
      notifyResourceChanged("designations");
      await runPreview();
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not create missing designations"));
    } finally {
      setCreatingDesignations(false);
    }
  };

  const commitImport = async () => {
    if (!canImport) return;
    setCommitting(true);
    try {
      const response = await importService.commitIncumbency({ rawText, columnMapping, createMissingDesignations: autoCreateDesignations });
      const data = response.data.data;
      setImportResult(data);
      toast.success(`${data.createdCount} employees imported`);
      notifyResourceChanged("employees");
      notifyResourceChanged("designations");
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not import employees"));
    } finally {
      setCommitting(false);
    }
  };

  const updateMappedField = (columnIndex, fieldKey) => {
    setPreview(null);
    setImportResult(null);
    setColumnMapping((current) => {
      const next = { ...current };
      Object.keys(next).forEach((key) => {
        if (Number(next[key]) === Number(columnIndex)) delete next[key];
      });
      if (fieldKey) next[fieldKey] = columnIndex;
      return next;
    });
  };

  const mappedFieldForColumn = (columnIndex) => Object.keys(columnMapping).find((key) => Number(columnMapping[key]) === Number(columnIndex)) || "";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Import Incumbency"
        description="Paste any Google Sheets columns, map each column once, preview matches, then import safely."
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={() => { setRawText(sampleText); setPreview(null); setImportResult(null); }}>
              <FileSpreadsheet className="h-4 w-4" />
              Load Sample
            </button>
            <button type="button" className="btn-primary" disabled={loading || !requiredMappingReady} onClick={runPreview}>
              <RefreshCw className="h-4 w-4" />
              {loading ? "Checking..." : "Preview Import"}
            </button>
          </>
        }
      />

      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h3 className="font-black">Google Sheets Data</h3>
            <p className="text-sm text-muted-foreground">Copy from Google Sheets and paste here. First row should contain column headings like Name, Designation, Office Name, CNIC, Cell, DOB, Address.</p>
          </div>
          <UploadCloud className="h-5 w-5 text-primary" />
        </div>
        <textarea
          className="min-h-64 w-full resize-y rounded-lg border border-border bg-white p-3 font-mono text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
          value={rawText}
          onChange={(event) => { setRawText(event.target.value); setPreview(null); setImportResult(null); }}
          placeholder="Paste columns from Google Sheets..."
        />
      </section>

      {pastedColumns.length ? (
        <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-black">Column Matching</h3>
              <p className="text-sm text-muted-foreground">Confirm which pasted column belongs to which employee field. Name can be blank for vacant rows; Designation and Office / Section are required.</p>
            </div>
            <span className={requiredMappingReady ? "rounded-md bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700" : "rounded-md bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-800"}>
              {requiredMappingReady ? "Ready to preview" : "Map required columns"}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {pastedColumns.map((column) => {
              const selectedField = mappedFieldForColumn(column.index);
              return (
                <label key={`${column.index}-${column.label}`} className="rounded-lg border border-border bg-surface-2/60 p-3">
                  <span className="block truncate text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">{column.label}</span>
                  <select className="input-shell mt-2 bg-white" value={selectedField} onChange={(event) => updateMappedField(column.index, event.target.value)}>
                    {fieldOptions.map((field) => {
                      const alreadyUsed = field.key && mappedFieldSet.has(field.key) && field.key !== selectedField;
                      return (
                        <option key={field.key || "none"} value={field.key} disabled={alreadyUsed}>
                          {field.label}
                        </option>
                      );
                    })}
                  </select>
                </label>
              );
            })}
          </div>
        </section>
      ) : null}

      {preview ? (
        <>
          <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
            <Metric label="Pasted Rows" value={preview.totals.sourceRows} hint="Non-empty rows" />
            <Metric label="Importable Rows" value={preview.totals.employeesFound} hint={`${preview.totals.vacantRows || 0} vacant`} />
            <Metric label="Ready Rows" value={preview.totals.readyRows} hint="Will be saved" />
            <Metric label="Offices" value={preview.totals.officesFound} />
            <Metric label="Missing Offices" value={preview.totals.missingOffices} />
            <Metric label="Designations" value={preview.totals.designationsFound} />
            <Metric label="Missing Designations" value={preview.totals.missingDesignations} />
            <Metric label="Duplicates" value={preview.totals.duplicates} />
            <Metric label="Skipped" value={preview.totals.skippedRows} hint="Needs correction" />
          </div>

          {importResult ? (
            <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-black text-emerald-950">Last Import Result</h3>
                  <p className="text-sm font-semibold text-emerald-800">
                    {importResult.createdCount} saved out of {importResult.employeesFound} importable employee rows.
                  </p>
                </div>
                <div className="grid min-w-full gap-2 sm:min-w-0 sm:grid-cols-4">
                  <Metric label="Saved" value={importResult.createdCount} />
                  <Metric label="Not Saved" value={importResult.notSavedCount} />
                  <Metric label="Duplicates" value={importResult.skippedDuplicateCount} />
                  <Metric label="Sheet Skipped" value={importResult.skippedSheetRowsCount} />
                </div>
              </div>
              {importResult.notSavedCount ? (
                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                  <ListPanel
                    title="Skipped Sheet Rows"
                    items={(importResult.skippedRows || []).map((row) => `Line ${row.lineNumber}: ${row.name || row.designation || "-"} (${row.reason})`)}
                    emptyText="No sheet rows skipped."
                    tone={importResult.skippedRows?.length ? "warning" : "success"}
                  />
                  <ListPanel
                    title="Duplicate Employees"
                    items={(importResult.skippedDuplicates || []).map((row) => `Line ${row.lineNumber}: ${row.fullName} - ${row.designationName} - ${row.officeName}${row.duplicateReason ? ` (${row.duplicateReason})` : ""}`)}
                    emptyText="No duplicate employees skipped."
                    tone={importResult.skippedDuplicates?.length ? "warning" : "success"}
                  />
                  <ListPanel
                    title="Unmatched Rows"
                    items={(importResult.skippedUnmatched || []).map((row) => `Line ${row.lineNumber}: ${row.fullName || row.designationName} (${row.reason})`)}
                    emptyText="No unmatched rows skipped."
                    tone={importResult.skippedUnmatched?.length ? "warning" : "success"}
                  />
                </div>
              ) : null}
            </section>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <ListPanel
              title="Missing Offices / Sections"
              items={preview.missingOffices || []}
              emptyText="All offices/sections matched."
              tone={preview.missingOffices?.length ? "warning" : "success"}
              action={
                preview.missingOffices?.length ? (
                  <Link to="/structure" className="btn-secondary px-3 py-2 text-xs">
                    Create Manually
                  </Link>
                ) : null
              }
            />
            <ListPanel
              title="Missing Designations"
              items={preview.missingDesignations || []}
              emptyText="All designations matched."
              tone={preview.missingDesignations?.length ? "warning" : "success"}
              action={
                preview.missingDesignations?.length ? (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-primary px-3 py-2 text-xs" disabled={creatingDesignations} onClick={createMissingDesignations}>
                      <Plus className="h-4 w-4" />
                      {creatingDesignations ? "Creating..." : "Create Missing"}
                    </button>
                    <Link to="/designations" className="btn-secondary px-3 py-2 text-xs">
                      Manual
                    </Link>
                  </div>
                ) : null
              }
            />
          </div>

          {preview.skippedRows?.length || preview.duplicateRows?.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <ListPanel
                title="Rows That Will Not Save"
                items={(preview.skippedRows || []).map((row) => `Line ${row.lineNumber}: ${row.name || row.designation || "-"} (${row.reason})`)}
                emptyText="No sheet rows will be skipped."
                tone={preview.skippedRows?.length ? "warning" : "success"}
              />
              <ListPanel
                title="Duplicate Rows"
                items={(preview.duplicateRows || []).map((row) => `Line ${row.lineNumber}: ${row.fullName} - ${row.designationName} - ${row.officeName}${row.duplicateReason ? ` (${row.duplicateReason})` : ""}`)}
                emptyText="No duplicates found."
                tone={preview.duplicateRows?.length ? "warning" : "success"}
              />
            </div>
          ) : null}

          <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-black">Final Import</h3>
                <p className="text-sm text-muted-foreground">Vacant or blank-name rows will be saved as vacant. Duplicates are skipped. Missing offices must be resolved manually to protect hierarchy accuracy.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm">
                  <input type="checkbox" checked={autoCreateDesignations} onChange={(event) => setAutoCreateDesignations(event.target.checked)} />
                  Auto-create missing designations during import
                </label>
                <button type="button" className="btn-primary" disabled={!canImport || committing} onClick={commitImport}>
                  <CheckCircle2 className="h-4 w-4" />
                  {committing ? "Importing..." : "Import Employees"}
                </button>
              </div>
            </div>
            {preview.missingOffices?.length ? (
              <p className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                <AlertTriangle className="h-4 w-4" />
                Create or rename missing offices/sections first, then preview again.
              </p>
            ) : null}
          </section>

          <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-black">Preview Rows</h3>
              <p className="text-xs text-muted-foreground">Showing first {preview.rows.length} parsed rows</p>
            </div>
            <div className="overflow-auto">
              <table className="incumbency-table w-full min-w-[920px] border-collapse text-xs">
                <thead>
                  <tr>
                    <th>Line</th>
                    <th>Name</th>
                    <th>Designation</th>
                    <th>Office / Section</th>
                    <th>CNIC</th>
                    <th>Cell</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr key={`${row.lineNumber}-${row.fullName}-${row.designationName}`}>
                      <td>{row.lineNumber}</td>
                      <td className="font-semibold">{row.fullName}</td>
                      <td>{row.designationName}</td>
                      <td>{row.officeDisplayName || row.officeName}</td>
                      <td>{row.cnic || "-"}</td>
                      <td>{row.mobileNumber || "-"}</td>
                      <td>
                        {row.duplicate ? (
                          <span className="font-bold text-amber-700">{row.duplicateReason || "Duplicate skipped"}</span>
                        ) : row.officeMatched && row.designationMatched ? (
                          <span className="font-bold text-emerald-700">Ready</span>
                        ) : (
                          <span className="font-bold text-danger">Needs review</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
};

export default ImportIncumbencyPage;
