import Employee from "../models/Employee.js";
import OrganizationUnit from "../models/OrganizationUnit.js";
import Seat from "../models/Seat.js";
import TransferRecord from "../models/TransferRecord.js";
import LeaveRecord from "../models/LeaveRecord.js";
import AdditionalCharge from "../models/AdditionalCharge.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { apiResponse } from "../utils/apiResponse.js";
import { getUnitId, getUnitParentId } from "../utils/organizationUnit.js";

const baseEmployeePopulate = [
  { path: "designation", select: "name bps category" },
  { path: "currentWing", select: "name code" },
  { path: "currentOfficeSection", select: "name code type path level sortOrder" },
  { path: "currentSeat", select: "seatTitle seatCode seatStatus" },
];

const resolveUnitScopeIds = async (unitId, includeChildren = true) => {
  const resolvedId = getUnitId(unitId);
  if (!resolvedId) return [];

  const units = await OrganizationUnit.find({}, "_id parent parentOfficeSection");
  const byParent = new Map();

  units.forEach((unit) => {
    const parentId = getUnitParentId(unit);
    const key = parentId ? String(parentId) : "";
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(unit);
  });

  const scope = new Set([String(resolvedId)]);
  if (!includeChildren) return [...scope];

  const visit = (parentId) => {
    const children = byParent.get(String(parentId)) || [];
    children.forEach((child) => {
      const childId = String(child._id);
      if (scope.has(childId)) return;
      scope.add(childId);
      visit(childId);
    });
  };

  visit(resolvedId);
  return [...scope];
};

const applyUnitFilter = async (query, unitId, includeChildren = true) => {
  const scopeIds = await resolveUnitScopeIds(unitId, includeChildren);
  if (scopeIds.length) {
    query.currentOfficeSection = { $in: scopeIds };
  }
};

const buildSeatQuery = async (unitId, includeChildren = true) => {
  const query = { isActive: true, seatStatus: "vacant" };
  const scopeIds = await resolveUnitScopeIds(unitId, includeChildren);
  if (scopeIds.length) {
    query.officeSection = { $in: scopeIds };
  }
  return query;
};

const buildEmployeeIdsInScope = async (unitId, includeChildren = true) => {
  const scopeIds = await resolveUnitScopeIds(unitId, includeChildren);
  if (!scopeIds.length) return [];
  return Employee.distinct("_id", {
    isArchived: { $ne: true },
    currentOfficeSection: { $in: scopeIds },
  });
};

export const dashboardReport = asyncHandler(async (_req, res) => {
  const [
    totalEmployees,
    totalOfficers,
    totalOfficials,
    totalOrganizationUnits,
    topLevelUnits,
    totalSeats,
    occupiedSeats,
    vacantSeats,
    additionalChargeCases,
    onLeaveCount,
    recentTransfers,
    upcomingRetirements,
    genderCounts,
    designationCounts,
    unitCounts,
  ] = await Promise.all([
    Employee.countDocuments({ isArchived: { $ne: true }, employmentStatus: "active" }),
    Employee.countDocuments({ isArchived: { $ne: true }, employmentStatus: "active", employeeType: "officer" }),
    Employee.countDocuments({ isArchived: { $ne: true }, employmentStatus: "active", employeeType: "official" }),
    OrganizationUnit.countDocuments({ isActive: true }),
    OrganizationUnit.countDocuments({ isActive: true, $or: [{ parent: null }, { parentOfficeSection: null }] }),
    Seat.countDocuments({ isActive: true }),
    Seat.countDocuments({ isActive: true, seatStatus: "occupied" }),
    Seat.countDocuments({ isActive: true, seatStatus: "vacant" }),
    AdditionalCharge.countDocuments({ isActive: true }),
    Employee.countDocuments({ employmentStatus: "on_leave", isArchived: { $ne: true } }),
    TransferRecord.find()
      .populate("employee", "fullName personnelNumber")
      .populate("fromWing", "name code")
      .populate("fromOfficeSection", "name code type path level sortOrder")
      .populate("toWing", "name code")
      .populate("toOfficeSection", "name code type path level sortOrder")
      .sort("-transferDate")
      .limit(5),
    Employee.find({
      dateOfBirth: { $exists: true, $ne: null },
      isArchived: { $ne: true },
    })
      .sort({ dateOfBirth: 1 })
      .limit(10)
      .select("fullName personnelNumber dateOfBirth employmentStatus"),
    Employee.aggregate([
      { $match: { isArchived: { $ne: true }, employmentStatus: "active" } },
      { $group: { _id: "$gender", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Employee.aggregate([
      { $match: { isArchived: { $ne: true }, employmentStatus: "active" } },
      { $group: { _id: "$designation", count: { $sum: 1 } } },
      { $lookup: { from: "designations", localField: "_id", foreignField: "_id", as: "designation" } },
      { $unwind: { path: "$designation", preserveNullAndEmptyArrays: true } },
      { $project: { _id: 1, count: 1, name: "$designation.name" } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    Employee.aggregate([
      { $match: { isArchived: { $ne: true }, employmentStatus: "active" } },
      { $group: { _id: "$currentOfficeSection", count: { $sum: 1 } } },
      { $lookup: { from: "officesections", localField: "_id", foreignField: "_id", as: "unit" } },
      { $unwind: { path: "$unit", preserveNullAndEmptyArrays: true } },
      { $project: { _id: 1, count: 1, name: "$unit.name", code: "$unit.code", type: "$unit.type", path: "$unit.path" } },
      { $sort: { count: -1 } },
      { $limit: 12 },
    ]),
  ]);

  return apiResponse(res, 200, "Dashboard data fetched", {
    counts: {
      totalEmployees,
      totalOfficers,
      totalOfficials,
      totalOrganizationUnits,
      topLevelUnits,
      totalSeats,
      occupiedSeats,
      vacantSeats,
      additionalChargeCases,
      onLeaveCount,
    },
    recentTransfers,
    upcomingRetirements,
    charts: {
      genderCounts,
      designationCounts,
      unitCounts,
    },
  });
});

export const incumbencyReport = asyncHandler(async (req, res) => {
  const query = { employmentStatus: "active", isArchived: { $ne: true } };
  if (req.query.organizationUnit || req.query.officeSection || req.query.section) {
    await applyUnitFilter(query, req.query.organizationUnit || req.query.officeSection || req.query.section, req.query.includeChildren !== "false");
  }

  const employees = await Employee.find(query)
    .populate(baseEmployeePopulate)
    .sort({ fullName: 1 });

  return apiResponse(res, 200, "Incumbency report fetched", employees);
});

export const vacantSeatsReport = asyncHandler(async (req, res) => {
  const query = await buildSeatQuery(req.query.organizationUnit || req.query.officeSection || req.query.section, req.query.includeChildren !== "false");
  const seats = await Seat.find(query)
    .populate("designation", "name bps category")
    .populate("wing", "name code")
    .populate("officeSection", "name code type path level sortOrder")
    .populate("additionalChargeHolder", "fullName personnelNumber")
    .sort({ officeSection: 1, seatTitle: 1 });

  return apiResponse(res, 200, "Vacant seats report fetched", seats);
});

export const additionalChargeReport = asyncHandler(async (req, res) => {
  const unitId = req.query.organizationUnit || req.query.officeSection || req.query.section;
  let recordsQuery = { isActive: true };

  if (unitId) {
    const scopeIds = await resolveUnitScopeIds(unitId, req.query.includeChildren !== "false");
    const seatIds = await Seat.distinct("_id", { isActive: true, officeSection: { $in: scopeIds } });
    recordsQuery.vacantSeat = { $in: seatIds };
  }

  const records = await AdditionalCharge.find(recordsQuery)
    .populate("vacantSeat", "seatTitle seatCode seatStatus officeSection")
    .populate("additionalChargeHolder", "fullName personnelNumber cnic employmentStatus")
    .sort({ startDate: -1 });
  return apiResponse(res, 200, "Additional charge report fetched", records);
});

export const transferHistoryReport = asyncHandler(async (req, res) => {
  const unitId = req.query.organizationUnit || req.query.officeSection || req.query.section;
  const recordsQuery = {};

  if (unitId) {
    const scopeIds = await resolveUnitScopeIds(unitId, req.query.includeChildren !== "false");
    recordsQuery.$or = [
      { fromOfficeSection: { $in: scopeIds } },
      { toOfficeSection: { $in: scopeIds } },
    ];
  }

  const records = await TransferRecord.find(recordsQuery)
    .populate("employee", "fullName personnelNumber cnic employmentStatus")
    .populate("fromWing", "name code")
    .populate("fromOfficeSection", "name code type path level sortOrder")
    .populate("fromSeat", "seatTitle seatCode")
    .populate("toWing", "name code")
    .populate("toOfficeSection", "name code type path level sortOrder")
    .populate("toSeat", "seatTitle seatCode")
    .sort({ transferDate: -1 });
  return apiResponse(res, 200, "Transfer report fetched", records);
});

export const leaveReport = asyncHandler(async (req, res) => {
  const unitId = req.query.organizationUnit || req.query.officeSection || req.query.section;
  const query = {};

  if (unitId) {
    const employeeIds = await buildEmployeeIdsInScope(unitId, req.query.includeChildren !== "false");
    query.employee = { $in: employeeIds };
  }

  const records = await LeaveRecord.find(query)
    .populate("employee", "fullName personnelNumber cnic employmentStatus")
    .populate("approvedBy", "fullName email role")
    .sort({ startDate: -1 });
  return apiResponse(res, 200, "Leave report fetched", records);
});

export const retirementDueReport = asyncHandler(async (req, res) => {
  const today = new Date();
  const dueDate = new Date();
  dueDate.setMonth(dueDate.getMonth() + 12);

  const query = {
    dateOfBirth: { $ne: null },
    isArchived: { $ne: true },
    employmentStatus: "active",
  };

  if (req.query.organizationUnit || req.query.officeSection || req.query.section) {
    await applyUnitFilter(query, req.query.organizationUnit || req.query.officeSection || req.query.section, req.query.includeChildren !== "false");
  }

  const employees = await Employee.find(query)
    .select("fullName personnelNumber dateOfBirth employmentStatus currentOfficeSection")
    .sort({ dateOfBirth: 1 });

  const mapped = employees.filter((employee) => {
    if (!employee.dateOfBirth) return false;
    const retirementDate = new Date(employee.dateOfBirth);
    retirementDate.setFullYear(retirementDate.getFullYear() + 60);
    return retirementDate >= today && retirementDate <= dueDate;
  });

  return apiResponse(res, 200, "Retirement due report fetched", mapped);
});

export const summaryByDimension = asyncHandler(async (req, res) => {
  const { dimension } = req.params;
  const allowed = new Set(["district", "gender", "bps", "designation", "wing", "organizationUnit", "officeSection", "employeeType"]);
  if (!allowed.has(dimension)) {
    return apiResponse(res, 400, "Unsupported dimension", []);
  }

  const groupField =
    dimension === "organizationUnit" || dimension === "officeSection"
      ? "$currentOfficeSection"
      : dimension === "wing"
      ? "$currentWing"
      : `$${dimension}`;

  const pipeline = [{ $match: { isArchived: { $ne: true } } }, { $group: { _id: groupField, count: { $sum: 1 } } }, { $sort: { count: -1 } }];

  if (dimension === "organizationUnit" || dimension === "officeSection") {
    pipeline.splice(2, 0, {
      $lookup: { from: "officesections", localField: "_id", foreignField: "_id", as: "unit" },
    });
    pipeline.splice(3, 0, { $unwind: { path: "$unit", preserveNullAndEmptyArrays: true } });
    pipeline.push({ $project: { _id: 1, count: 1, name: "$unit.name", code: "$unit.code", type: "$unit.type", path: "$unit.path" } });
  } else if (dimension === "wing") {
    pipeline.splice(2, 0, {
      $lookup: { from: "wings", localField: "_id", foreignField: "_id", as: "wing" },
    });
    pipeline.splice(3, 0, { $unwind: { path: "$wing", preserveNullAndEmptyArrays: true } });
    pipeline.push({ $project: { _id: 1, count: 1, name: "$wing.name", code: "$wing.code" } });
  } else if (dimension === "designation") {
    pipeline.splice(2, 0, {
      $lookup: { from: "designations", localField: "_id", foreignField: "_id", as: "designation" },
    });
    pipeline.splice(3, 0, { $unwind: { path: "$designation", preserveNullAndEmptyArrays: true } });
    pipeline.push({ $project: { _id: 1, count: 1, name: "$designation.name", code: "$designation.bps" } });
  }

  const summary = await Employee.aggregate(pipeline);
  return apiResponse(res, 200, `${dimension} summary fetched`, summary);
});
