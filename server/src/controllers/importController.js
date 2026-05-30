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
  return (!clean(designation) && ["NAME", "SR.#", "SR", "INCUMBENCY POSITION"].includes(label)) || !label;
};

const isVacantRow = (name) => /^VACANT\.?/i.test(clean(name));

const splitRow = (line) => {
  const cells = String(line).split("\t");
  if (cells.length === 1) return String(line).split(",");
  return cells;
};

const parseIncumbencyText = (rawText = "") => {
  const rows = String(rawText || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line, index) => ({ cells: splitRow(line), lineNumber: index + 1 }));
  const sourceRows = rows.filter(({ cells }) => cells.some((cell) => clean(cell))).length;

  let currentOfficeName = "";
  const offices = new Map();
  const designations = new Map();
  const employees = [];
  const skippedRows = [];

  rows.forEach(({ cells, lineNumber }) => {
    const name = clean(cells[0]);
    const designation = clean(cells[1]);

    if (isSkippedLabel(name, designation)) {
      if (name && name.toUpperCase() !== "NAME") skippedRows.push({ lineNumber, name, reason: "Ignored sheet heading" });
      return;
    }

    if (isHeaderRow(name, designation)) {
      currentOfficeName = name;
      offices.set(normalize(name), name);
      return;
    }

    if (!name && !designation) return;

    if (!currentOfficeName) {
      skippedRows.push({ lineNumber, name, designation, reason: "No office/section heading above this row" });
      return;
    }

    if (!name || !designation) {
      skippedRows.push({ lineNumber, name, designation, reason: "Employee row needs both name and designation" });
      return;
    }

    if (isVacantRow(name)) {
      skippedRows.push({ lineNumber, name, designation, officeName: currentOfficeName, reason: "Vacant row skipped" });
      return;
    }

    designations.set(normalize(designation), designation);
    employees.push({
      lineNumber,
      fullName: name,
      designationName: designation,
      officeName: currentOfficeName,
      gender: inferGender(name),
    });
  });

  return {
    sourceRows,
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

const analyzeImport = async (rawText) => {
  const parsed = parseIncumbencyText(rawText);
  if (!parsed.employees.length && !parsed.offices.length) {
    throw new AppError("No importable rows found. Paste Google Sheets data with Name and Designation columns.", 400);
  }

  const [units, designations, existingEmployees] = await Promise.all([
    OrganizationUnit.find({ isActive: true }).select("name code path type parent parentOfficeSection").lean(),
    Designation.find({ isActive: true }).select("name bps totalStrength").lean(),
    Employee.find({ isArchived: { $ne: true } })
      .populate("designation", "name")
      .populate("currentOfficeSection", "name code")
      .select("fullName designation currentOfficeSection employmentStatus")
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
  const importKeys = new Set();
  const previewRows = parsed.employees.map((employee) => {
    const unit = unitLookup.get(normalize(employee.officeName));
    const designation = designationLookup.get(normalize(employee.designationName));
    const key = [normalize(employee.fullName), normalize(employee.designationName), String(unit?._id || "")].join("|");
    const duplicateInImport = importKeys.has(key);
    importKeys.add(key);
    return {
      ...employee,
      officeMatched: Boolean(unit),
      officeId: unit?._id || null,
      officeDisplayName: unit?.code || unit?.name || "",
      designationMatched: Boolean(designation),
      designationId: designation?._id || null,
      duplicate: duplicateInImport || existingKeys.has(key),
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
  const analysis = await analyzeImport(req.body.rawText);
  return apiResponse(res, 200, "Import preview generated", {
    totals: {
      sourceRows: analysis.parsed.sourceRows,
      officesFound: analysis.officeMatches.length,
      employeesFound: analysis.previewRows.length,
      designationsFound: analysis.designationMatches.length,
      missingOffices: analysis.missingOffices.length,
      missingDesignations: analysis.missingDesignations.length,
      duplicates: analysis.duplicateRows.length,
      skippedRows: analysis.skippedRows.length,
      vacantRows: analysis.skippedRows.filter((row) => row.reason === "Vacant row skipped").length,
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
  const analysis = await analyzeImport(req.body.rawText);
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
  let analysis = await analyzeImport(req.body.rawText);

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
    analysis = await analyzeImport(req.body.rawText);
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
              gender: row.gender,
              employmentStatus: "active",
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
