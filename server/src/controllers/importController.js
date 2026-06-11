import mongoose from "mongoose";
import Employee from "../models/Employee.js";
import Designation from "../models/Designation.js";
import OrganizationUnit from "../models/OrganizationUnit.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { apiResponse } from "../utils/apiResponse.js";
import AppError from "../utils/AppError.js";
import { logActivity } from "../utils/activityLogger.js";

const clean = (value) => String(value || "").trim();

const normalize = (value) =>
  clean(value)
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/\bO\/O\b/g, "")
    .replace(/\bOFFICE OF\b/g, "")
    .replace(/\bSSF\b/g, " SPECIAL SECRETARY FINANCE ")
    .replace(/\bAFS\b/g, " ADDITIONAL FINANCE SECRETARY ")
    .replace(/\bDS\b/g, " DEPUTY SECRETARY ")
    .replace(/\bBO\b/g, " BUDGET SECTION ")
    .replace(/\bDY\b/g, " DEPUTY ")
    .replace(/\bSECY\b/g, " SECRETARY ")
    .replace(/\bFIN\.\b/g, " FINANCE ")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\bFINANCE\b/g, " ")
    .replace(/\bSECTION\b/g, " SECTION ")
    .replace(/\s+/g, " ")
    .trim();

const inferGender = (name) => {
  const value = clean(name).toLowerCase();
  if (/^(ms\.|mrs\.|miss|madam)\b/.test(value)) return "female";
  if (/^(mr\.|mian|rana|ch\.|capt\.|hafiz|sheikh|syed|flt\.)\b/.test(value)) return "male";
  return "other";
};

const isHeaderRow = (name, designation) => {
  const label = clean(name);
  if (!label || clean(designation)) return false;
  return !["NAME", "SR.#", "SR", "INCUMBENCY POSITION"].includes(label.toUpperCase());
};

const isSkippedLabel = (name, designation) => {
  const label = clean(name).toUpperCase();
  return (!clean(designation) && ["NAME", "SR.#", "SR", "INCUMBENCY POSITION"].includes(label)) || (!label && !clean(designation));
};

const isVacantRow = (name) => /^VACANT\.?/i.test(clean(name));

const importFields = [
  { key: "fullName", aliases: ["name", "employee name", "full name", "officer name", "official name"] },
  { key: "designationName", aliases: ["designation", "desgination", "post", "job title", "title"] },
  { key: "officeName", aliases: ["office", "office name", "section", "section name", "office section", "department", "branch"] },
  { key: "fatherName", aliases: ["father", "father name", "father's name"] },
  { key: "cnic", aliases: ["cnic", "nic", "id card"] },
  { key: "mobileNumber", aliases: ["cell", "cell no", "cell number", "mobile", "mobile number", "phone", "contact"] },
  { key: "dateOfBirth", aliases: ["dob", "date of birth", "birth date"] },
  { key: "address", aliases: ["address", "home address", "residential address"] },
  { key: "personnelNumber", aliases: ["personnel", "personnel no", "personnel number", "personal no", "employee no"] },
  { key: "serviceCadre", aliases: ["cadre", "service cadre", "service"] },
  { key: "gender", aliases: ["gender", "sex"] },
  { key: "email", aliases: ["email", "email address"] },
  { key: "district", aliases: ["district"] },
  { key: "domicile", aliases: ["domicile"] },
  { key: "qualification", aliases: ["qualification", "education"] },
  { key: "joiningDate", aliases: ["joining", "joining date", "date of joining", "doj"] },
  { key: "remarks", aliases: ["remarks", "remark", "notes", "note"] },
  { key: "employmentStatus", aliases: ["status", "employment status", "incumbency action"] },
];

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

const headerKey = (value) =>
  clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const inferField = (header) => {
  const normalized = headerKey(header);
  if (!normalized) return "";
  const exact = importFields.find((field) => field.aliases.includes(normalized));
  if (exact) return exact.key;
  const fuzzy = importFields.find((field) => field.aliases.some((alias) => normalized.includes(alias) || alias.includes(normalized)));
  return fuzzy?.key || "";
};

const normalizeMapping = (columnMapping = {}, headers = []) => {
  const used = new Set();
  const mapping = {};
  importFields.forEach((field) => {
    const rawIndex = columnMapping[field.key];
    const index = rawIndex === "" || rawIndex === undefined || rawIndex === null ? -1 : Number(rawIndex);
    if (Number.isInteger(index) && index >= 0 && index < headers.length && !used.has(index)) {
      mapping[field.key] = index;
      used.add(index);
    }
  });

  headers.forEach((header, index) => {
    if (used.has(index)) return;
    const key = inferField(header);
    if (key && mapping[key] === undefined) {
      mapping[key] = index;
      used.add(index);
    }
  });

  return mapping;
};

const mappedValue = (cells, mapping, key) => {
  const index = mapping[key];
  return Number.isInteger(index) ? clean(cells[index]) : "";
};

const parseDate = (value) => {
  const text = clean(value);
  if (!text) return undefined;
  const normalized = text.replace(/\./g, "/").replace(/-/g, "/");
  const parts = normalized.split("/").map((part) => clean(part));
  if (parts.length === 3) {
    const [a, b, c] = parts.map(Number);
    const year = c < 100 ? 2000 + c : c;
    if (a > 0 && b > 0 && year > 1900) {
      const date = a > 12 ? new Date(year, b - 1, a) : new Date(year, a - 1, b);
      if (!Number.isNaN(date.getTime())) return date;
    }
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const normalizeStatus = (name, status) => {
  const value = headerKey(status);
  if (!clean(name) || isVacantRow(name) || value.includes("vacant")) return "vacant";
  if (value.includes("retired")) return "retired";
  if (value.includes("transfer")) return "transferred";
  if (value.includes("deceased") || value.includes("death")) return "deceased";
  if (value.includes("leave")) return "on_leave";
  if (value.includes("suspend")) return "suspended";
  if (value.includes("resign")) return "resigned";
  return "active";
};

const normalizeGender = (name, gender) => {
  const value = headerKey(gender);
  if (["male", "m"].includes(value)) return "male";
  if (["female", "f"].includes(value)) return "female";
  return inferGender(name);
};

const parseIncumbencyText = (rawText = "", columnMapping = {}) => {
  const rows = String(rawText || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line, index) => ({ cells: splitRow(line), lineNumber: index + 1, raw: line }));
  const sourceRows = rows.filter(({ cells }) => cells.some((cell) => clean(cell))).length;
  const headerRow = rows.find(({ cells }) => cells.some((cell) => clean(cell)));
  const headers = (headerRow?.cells || []).map((cell, index) => clean(cell) || `Column ${index + 1}`);
  const mapping = normalizeMapping(columnMapping, headers);
  const headerLine = headerRow?.lineNumber || 0;

  let currentOfficeName = "";
  const offices = new Map();
  const designations = new Map();
  const employees = [];
  const skippedRows = [];

  rows.forEach(({ cells, lineNumber }) => {
    if (lineNumber === headerLine) return;
    const name = mappedValue(cells, mapping, "fullName");
    const designation = mappedValue(cells, mapping, "designationName");
    const mappedOffice = mappedValue(cells, mapping, "officeName");
    const nonEmptyMappedValues = Object.keys(mapping).map((key) => mappedValue(cells, mapping, key)).filter(Boolean);

    if (!cells.some((cell) => clean(cell))) return;

    if (isSkippedLabel(name, designation)) {
      if (name && name.toUpperCase() !== "NAME") skippedRows.push({ lineNumber, name, reason: "Ignored sheet heading" });
      return;
    }

    if (!mappedOffice && isHeaderRow(clean(cells[0]), designation) && nonEmptyMappedValues.length <= 1) {
      currentOfficeName = clean(cells[0]);
      offices.set(normalize(currentOfficeName), currentOfficeName);
      return;
    }

    const officeName = mappedOffice || currentOfficeName;
    if (officeName) offices.set(normalize(officeName), officeName);

    if (!officeName) {
      skippedRows.push({ lineNumber, name, designation, reason: "No office/section heading above this row" });
      return;
    }

    if (!designation) {
      skippedRows.push({ lineNumber, name, designation, officeName, reason: "Designation is required" });
      return;
    }

    const employmentStatus = normalizeStatus(name, mappedValue(cells, mapping, "employmentStatus"));
    const fullName = employmentStatus === "vacant" ? clean(name).replace(/\.$/, "") || "Vacant" : name;
    designations.set(normalize(designation), designation);
    employees.push({
      lineNumber,
      fullName,
      designationName: designation,
      officeName,
      fatherName: mappedValue(cells, mapping, "fatherName"),
      cnic: mappedValue(cells, mapping, "cnic"),
      mobileNumber: mappedValue(cells, mapping, "mobileNumber"),
      dateOfBirth: parseDate(mappedValue(cells, mapping, "dateOfBirth")),
      address: mappedValue(cells, mapping, "address"),
      personnelNumber: mappedValue(cells, mapping, "personnelNumber"),
      serviceCadre: mappedValue(cells, mapping, "serviceCadre"),
      gender: normalizeGender(name, mappedValue(cells, mapping, "gender")),
      email: mappedValue(cells, mapping, "email"),
      district: mappedValue(cells, mapping, "district"),
      domicile: mappedValue(cells, mapping, "domicile"),
      qualification: mappedValue(cells, mapping, "qualification"),
      joiningDate: parseDate(mappedValue(cells, mapping, "joiningDate")),
      remarks: mappedValue(cells, mapping, "remarks"),
      employmentStatus,
    });
  });

  return {
    sourceRows,
    headers,
    mapping,
    columns: headers.map((label, index) => ({ index, label, inferredField: Object.keys(mapping).find((key) => mapping[key] === index) || "" })),
    offices: [...offices.values()],
    designations: [...designations.values()],
    employees,
    skippedRows,
  };
};

const makeLookup = (items, fields) => {
  const map = new Map();
  items.forEach((item) => {
    fields.forEach((field) => {
      const value = field(item);
      if (value) map.set(normalize(value), item);
    });
  });
  return map;
};

const analyzeImport = async (rawText, columnMapping = {}) => {
  const parsed = parseIncumbencyText(rawText, columnMapping);
  if (!parsed.employees.length && !parsed.offices.length) {
    throw new AppError("No importable rows found. Paste Google Sheets data with headers, then map columns.", 400);
  }

  const [units, designations, existingEmployees] = await Promise.all([
    OrganizationUnit.find({ isActive: true }).select("name code path type parent parentOfficeSection").lean(),
    Designation.find({ isActive: true }).select("name bps totalStrength").lean(),
    Employee.find({ isArchived: { $ne: true } })
      .populate("designation", "name")
      .populate("currentOfficeSection", "name code")
      .select("fullName designation currentOfficeSection employmentStatus cnic personnelNumber")
      .lean(),
  ]);

  const unitLookup = makeLookup(units, [(unit) => unit.name, (unit) => unit.code, (unit) => unit.path]);
  const designationLookup = makeLookup(designations, [(designation) => designation.name]);

  const officeMatches = parsed.offices.map((name) => {
    const match = unitLookup.get(normalize(name));
    return {
      name,
      matched: Boolean(match),
      unit: match ? { id: match._id, name: match.name, code: match.code || "", type: match.type } : null,
    };
  });

  const designationMatches = parsed.designations.map((name) => {
    const match = designationLookup.get(normalize(name));
    return {
      name,
      matched: Boolean(match),
      designation: match ? { id: match._id, name: match.name, bps: match.bps || "", totalStrength: match.totalStrength || 0 } : null,
    };
  });

  const existingKeys = new Set(
    existingEmployees.map((employee) =>
      [normalize(employee.fullName), normalize(employee.designation?.name), String(employee.currentOfficeSection?._id || "")].join("|")
    )
  );
  const existingCnics = new Set(existingEmployees.map((employee) => clean(employee.cnic)).filter(Boolean));
  const existingPersonnelNumbers = new Set(existingEmployees.map((employee) => clean(employee.personnelNumber)).filter(Boolean));
  const importKeys = new Set();
  const importCnics = new Set();
  const importPersonnelNumbers = new Set();
  const previewRows = parsed.employees.map((employee) => {
    const unit = unitLookup.get(normalize(employee.officeName));
    const designation = designationLookup.get(normalize(employee.designationName));
    const key = [normalize(employee.fullName), normalize(employee.designationName), String(unit?._id || "")].join("|");
    const cnic = clean(employee.cnic).replace(/\D/g, "");
    const personnelNumber = clean(employee.personnelNumber);
    const duplicateInImport = employee.employmentStatus !== "vacant" && importKeys.has(key);
    const duplicateExisting = employee.employmentStatus !== "vacant" && existingKeys.has(key);
    const duplicateCnic = cnic && (existingCnics.has(cnic) || importCnics.has(cnic));
    const duplicatePersonnelNumber = personnelNumber && (existingPersonnelNumbers.has(personnelNumber) || importPersonnelNumbers.has(personnelNumber));
    if (employee.employmentStatus !== "vacant") importKeys.add(key);
    if (cnic) importCnics.add(cnic);
    if (personnelNumber) importPersonnelNumbers.add(personnelNumber);
    return {
      ...employee,
      officeMatched: Boolean(unit),
      officeId: unit?._id || null,
      officeDisplayName: unit?.code || unit?.name || "",
      designationMatched: Boolean(designation),
      designationId: designation?._id || null,
      duplicate: duplicateInImport || duplicateExisting || duplicateCnic || duplicatePersonnelNumber,
      duplicateReason: duplicateCnic ? "CNIC already exists" : duplicatePersonnelNumber ? "Personnel number already exists" : duplicateInImport ? "Duplicate in pasted data" : duplicateExisting ? "Employee already exists" : "",
    };
  });

  return {
    parsed,
    previewRows,
    officeMatches,
    designationMatches,
    missingOffices: officeMatches.filter((row) => !row.matched).map((row) => row.name),
    missingDesignations: designationMatches.filter((row) => !row.matched).map((row) => row.name),
    duplicateRows: previewRows.filter((row) => row.duplicate),
    skippedRows: parsed.skippedRows,
  };
};

export const previewIncumbencyImport = asyncHandler(async (req, res) => {
  const analysis = await analyzeImport(req.body.rawText, req.body.columnMapping);
  return apiResponse(res, 200, "Import preview generated", {
    columns: analysis.parsed.columns,
    columnMapping: analysis.parsed.mapping,
    totals: {
      sourceRows: analysis.parsed.sourceRows,
      officesFound: analysis.officeMatches.length,
      employeesFound: analysis.previewRows.length,
      designationsFound: analysis.designationMatches.length,
      missingOffices: analysis.missingOffices.length,
      missingDesignations: analysis.missingDesignations.length,
      duplicates: analysis.duplicateRows.length,
      skippedRows: analysis.skippedRows.length,
      vacantRows: analysis.previewRows.filter((row) => row.employmentStatus === "vacant").length,
      blockedRows: analysis.previewRows.filter((row) => !row.officeMatched || !row.designationMatched).length,
      readyRows: analysis.previewRows.filter((row) => row.officeMatched && row.designationMatched && !row.duplicate).length,
    },
    officeMatches: analysis.officeMatches,
    designationMatches: analysis.designationMatches,
    missingOffices: analysis.missingOffices,
    missingDesignations: analysis.missingDesignations,
    duplicateRows: analysis.duplicateRows.slice(0, 1000),
    skippedRows: analysis.skippedRows.slice(0, 1000),
    rows: analysis.previewRows.slice(0, 1000),
  });
});

export const createMissingImportDesignations = asyncHandler(async (req, res) => {
  const analysis = await analyzeImport(req.body.rawText, req.body.columnMapping);
  const created = [];

  for (const name of analysis.missingDesignations) {
    const designation = await Designation.create({
      name,
      totalStrength: 0,
      category: "official",
      createdBy: req.user?._id,
    });
    created.push({ id: designation._id, name: designation.name });
  }

  await logActivity({
    actorUser: req.user?._id,
    action: "create",
    entityType: "Designation",
    summary: `Created ${created.length} missing import designations`,
    after: created,
  });

  return apiResponse(res, 201, "Missing designations created", { created });
});

export const commitIncumbencyImport = asyncHandler(async (req, res) => {
  const createMissingDesignations = req.body.createMissingDesignations === true;
  let analysis = await analyzeImport(req.body.rawText, req.body.columnMapping);

  if (analysis.missingOffices.length) {
    throw new AppError("Resolve missing offices/sections before importing employees.", 400);
  }

  if (analysis.missingDesignations.length && !createMissingDesignations) {
    throw new AppError("Resolve missing designations or enable auto-create before importing employees.", 400);
  }

  if (analysis.missingDesignations.length && createMissingDesignations) {
    for (const name of analysis.missingDesignations) {
      await Designation.create({ name, totalStrength: 0, category: "official", createdBy: req.user?._id });
    }
    analysis = await analyzeImport(req.body.rawText, req.body.columnMapping);
  }

  const session = await mongoose.startSession();
  const created = [];
  const skippedDuplicates = [];
  const skippedUnmatched = [];

  try {
    await session.withTransaction(async () => {
      const sortByOffice = new Map();
      const officeIds = [...new Set(analysis.previewRows.map((row) => String(row.officeId)).filter(Boolean))];
      const existingSorts = await Employee.aggregate([
        { $match: { currentOfficeSection: { $in: officeIds.map((id) => new mongoose.Types.ObjectId(id)) }, isArchived: { $ne: true } } },
        { $group: { _id: "$currentOfficeSection", maxSort: { $max: "$sortOrder" } } },
      ]).session(session);
      existingSorts.forEach((row) => sortByOffice.set(String(row._id), Number(row.maxSort || 0)));

      for (const row of analysis.previewRows) {
        if (row.duplicate) {
          skippedDuplicates.push(row);
          continue;
        }
        if (!row.officeMatched || !row.designationMatched) {
          skippedUnmatched.push({
            ...row,
            reason: !row.officeMatched ? "Office/section not matched" : "Designation not matched",
          });
          continue;
        }

        const officeId = String(row.officeId);
        const nextSort = Number(sortByOffice.get(officeId) || 0) + 10;
        sortByOffice.set(officeId, nextSort);

        const employee = await Employee.create(
          [
            {
              fullName: row.fullName,
              designation: row.designationId,
              currentOfficeSection: row.officeId,
              currentSeat: null,
              fatherName: row.fatherName,
              cnic: row.cnic,
              mobileNumber: row.mobileNumber,
              dateOfBirth: row.dateOfBirth,
              address: row.address,
              personnelNumber: row.personnelNumber,
              serviceCadre: row.serviceCadre,
              email: row.email,
              district: row.district,
              domicile: row.domicile,
              qualification: row.qualification,
              dateOfJoiningCurrentDepartment: row.joiningDate,
              remarks: row.remarks,
              gender: row.gender,
              employmentStatus: row.employmentStatus,
              sortOrder: nextSort,
              createdBy: req.user?._id,
              updatedBy: req.user?._id,
            },
          ],
          { session }
        );
        created.push({ id: employee[0]._id, fullName: employee[0].fullName, officeName: row.officeName, designationName: row.designationName });
      }

      await logActivity({
        actorUser: req.user?._id,
        action: "import",
        entityType: "Employee",
        summary: `Imported ${created.length} employees from Google Sheets`,
        after: { createdCount: created.length, skippedDuplicateCount: skippedDuplicates.length },
        session,
      });
    });
  } finally {
    session.endSession();
  }

  return apiResponse(res, 201, "Incumbency import completed", {
    sourceRows: analysis.parsed.sourceRows,
    employeesFound: analysis.previewRows.length,
    createdCount: created.length,
    skippedDuplicateCount: skippedDuplicates.length,
    skippedSheetRowsCount: analysis.skippedRows.length,
    skippedUnmatchedCount: skippedUnmatched.length,
    notSavedCount: skippedDuplicates.length + analysis.skippedRows.length + skippedUnmatched.length,
    skippedDuplicates: skippedDuplicates.slice(0, 1000),
    skippedRows: analysis.skippedRows.slice(0, 1000),
    skippedUnmatched: skippedUnmatched.slice(0, 1000),
    created: created.slice(0, 1000),
  });
});
