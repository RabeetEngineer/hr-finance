import mongoose from "mongoose";
import Employee from "../models/Employee.js";
import Seat from "../models/Seat.js";
import TransferRecord from "../models/TransferRecord.js";
import LeaveRecord from "../models/LeaveRecord.js";
import AdditionalCharge from "../models/AdditionalCharge.js";
import PostingHistory from "../models/PostingHistory.js";
import Designation from "../models/Designation.js";
import OrganizationUnit from "../models/OrganizationUnit.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { apiResponse } from "../utils/apiResponse.js";
import AppError from "../utils/AppError.js";
import { parsePagination, regexSearch, parseSort } from "../utils/query.js";
import { logActivity } from "../utils/activityLogger.js";
import { recordPostingHistory } from "../utils/postingHistory.js";

const shape = (employee) => ({
  id: employee._id,
  fullName: employee.fullName,
  fatherName: employee.fatherName,
  cnic: employee.cnic,
  personnelNumber: employee.personnelNumber,
  designation: employee.designation,
  bps: employee.bps,
  serviceCadre: employee.serviceCadre,
  isOfficeHead: employee.isOfficeHead,
  gender: employee.gender,
  sortOrder: employee.sortOrder,
  dateOfBirth: employee.dateOfBirth,
  dateOfJoiningGovernmentService: employee.dateOfJoiningGovernmentService,
  dateOfJoiningCurrentDepartment: employee.dateOfJoiningCurrentDepartment,
  dateOfJoiningCurrentPost: employee.dateOfJoiningCurrentPost,
  transferredOutDate: employee.transferredOutDate,
  transferredToDepartment: employee.transferredToDepartment,
  retirementDate: employee.retirementDate,
  currentOfficeSection: employee.currentOfficeSection,
  currentWing: employee.currentWing,
  currentSeat: employee.currentSeat,
  district: employee.district,
  domicile: employee.domicile,
  mobileNumber: employee.mobileNumber,
  whatsappNumber: employee.whatsappNumber,
  email: employee.email,
  address: employee.address,
  qualification: employee.qualification,
  employeeType: employee.employeeType,
  staffCategory: employee.staffCategory,
  employmentStatus: employee.employmentStatus,
  profilePhoto: employee.profilePhoto,
  remarks: employee.remarks,
  attachments: employee.attachments,
  isArchived: employee.isArchived,
  archivedAt: employee.archivedAt,
  createdAt: employee.createdAt,
  updatedAt: employee.updatedAt,
});

const toObjectIds = (values) =>
  String(values || "")
    .split(",")
    .filter((value) => mongoose.Types.ObjectId.isValid(value))
    .map((value) => new mongoose.Types.ObjectId(value));

const buildQuery = (queryParams) => {
  const query = {};

  if (queryParams.q) {
    query.$or = [
      { fullName: regexSearch(queryParams.q) },
      { fatherName: regexSearch(queryParams.q) },
      { cnic: regexSearch(queryParams.q) },
      { personnelNumber: regexSearch(queryParams.q) },
      { serviceCadre: regexSearch(queryParams.q) },
      { mobileNumber: regexSearch(queryParams.q) },
      { whatsappNumber: regexSearch(queryParams.q) },
      { email: regexSearch(queryParams.q) },
    ];
  }

  if (queryParams.wing) query.currentWing = queryParams.wing;
  if (queryParams.section) query.currentOfficeSection = queryParams.section;
  if (queryParams.sectionIds) {
    query.currentOfficeSection = { $in: toObjectIds(queryParams.sectionIds) };
  }
  if (queryParams.designation) query.designation = queryParams.designation;
  if (queryParams.designationIds) {
    query.designation = { $in: toObjectIds(queryParams.designationIds) };
  }
  if (queryParams.status) query.employmentStatus = queryParams.status;
  if (queryParams.gender) query.gender = queryParams.gender;
  if (queryParams.district) query.district = regexSearch(queryParams.district);
  if (queryParams.bps) query.bps = queryParams.bps;
  if (queryParams.employeeType) query.employeeType = queryParams.employeeType;

  if (queryParams.includeArchived !== "true") {
    query.isArchived = { $ne: true };
  }

  if (queryParams.fromDate || queryParams.toDate) {
    query.dateOfJoiningGovernmentService = {};
    if (queryParams.fromDate) query.dateOfJoiningGovernmentService.$gte = new Date(queryParams.fromDate);
    if (queryParams.toDate) query.dateOfJoiningGovernmentService.$lte = new Date(queryParams.toDate);
  }

  return query;
};

const buildOrganizationRankMap = async () => {
  const units = await OrganizationUnit.find({ isActive: true })
    .select("_id name code parent parentOfficeSection sortOrder")
    .lean();
  const byId = new Map(units.map((unit) => [String(unit._id), { ...unit, children: [] }]));
  const roots = [];

  byId.forEach((unit) => {
    const parentId = String(unit.parent || unit.parentOfficeSection || "");
    const parent = parentId ? byId.get(parentId) : null;
    if (parent) parent.children.push(unit);
    else roots.push(unit);
  });

  const sortUnits = (items) =>
    items.sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || String(a.code || a.name || "").localeCompare(String(b.code || b.name || "")));

  const ranks = new Map();
  let rank = 0;
  const visit = (items) => {
    sortUnits(items).forEach((unit) => {
      rank += 1;
      ranks.set(String(unit._id), rank);
      visit(unit.children || []);
    });
  };
  visit(roots);
  return ranks;
};

const detachEmployeeFromSeat = async (employee, session) => {
  if (!employee.currentSeat) return null;

  const seat = await Seat.findById(employee.currentSeat).session(session);
  if (!seat) {
    employee.currentSeat = null;
    return null;
  }

  seat.currentEmployee = null;
  seat.seatStatus = seat.additionalChargeHolder ? "additional_charge" : "vacant";
  await seat.save({ session });

  employee.currentSeat = null;
  return seat;
};

const attachEmployeeToSeat = async (employee, seatId, session) => {
  if (!seatId) return null;

  const seat = await Seat.findById(seatId).session(session);
  if (!seat) throw new AppError("Seat not found", 404);
  if (seat.seatStatus === "frozen") throw new AppError("Frozen seat cannot be assigned", 400);
  if (seat.currentEmployee && String(seat.currentEmployee) !== String(employee._id)) {
    throw new AppError("Seat is already occupied", 409);
  }

  if (employee.currentSeat && String(employee.currentSeat) !== String(seat._id)) {
    const previousSeat = await Seat.findById(employee.currentSeat).session(session);
    if (previousSeat) {
      previousSeat.currentEmployee = null;
      previousSeat.seatStatus = previousSeat.additionalChargeHolder ? "additional_charge" : "vacant";
      await previousSeat.save({ session });
    }
  }

  seat.currentEmployee = employee._id;
  seat.additionalChargeHolder = null;
  seat.seatStatus = "occupied";
  await seat.save({ session });

  employee.currentSeat = seat._id;
  employee.currentWing = seat.wing;
  employee.currentOfficeSection = seat.officeSection;
  employee.designation = seat.designation;
  employee.bps = seat.bps || employee.bps;
  return seat;
};

const assertDesignationCapacity = async ({ designationId, employeeId = null, session = null }) => {
  if (!designationId) return;
  const designation = await Designation.findById(designationId).session(session);
  if (!designation || !Number(designation.totalStrength || 0)) return;

  const query = {
    designation: designationId,
    employmentStatus: "active",
    isArchived: { $ne: true },
  };
  if (employeeId) query._id = { $ne: employeeId };

  const currentCount = await Employee.countDocuments(query).session(session);
  if (currentCount >= Number(designation.totalStrength)) {
    throw new AppError(`${designation.name} strength limit reached (${designation.totalStrength})`, 409);
  }
};

export const listEmployees = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const query = buildQuery(req.query);

  if (req.query.q) {
    const [matchingDesignations, matchingSections] = await Promise.all([
      Designation.find({ name: regexSearch(req.query.q), isActive: { $ne: false } }).select("_id").lean(),
      OrganizationUnit.find({
        isActive: { $ne: false },
        $or: [{ name: regexSearch(req.query.q) }, { code: regexSearch(req.query.q) }, { path: regexSearch(req.query.q) }],
      }).select("_id").lean(),
    ]);
    const designationIds = matchingDesignations.map((designation) => designation._id);
    const sectionIds = matchingSections.map((section) => section._id);
    if (designationIds.length) query.$or.push({ designation: { $in: designationIds } });
    if (sectionIds.length) query.$or.push({ currentOfficeSection: { $in: sectionIds } });
  }

  const employeeQuery = Employee.find(query)
    .populate("designation", "name bps category")
    .populate("currentWing", "name code")
    .populate("currentOfficeSection", "name code type path level sortOrder")
    .populate("currentSeat", "seatTitle seatCode seatStatus");

  let paginated = [];
  let total = 0;

  if (req.query.sort === "hierarchy") {
    const [rows, ranks] = await Promise.all([employeeQuery, buildOrganizationRankMap()]);
    const sortedRows = rows.sort((a, b) => {
      const firstRank = ranks.get(String(a.currentOfficeSection?._id || a.currentOfficeSection || "")) || 999999;
      const secondRank = ranks.get(String(b.currentOfficeSection?._id || b.currentOfficeSection || "")) || 999999;
      return firstRank - secondRank || Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || String(a.fullName || "").localeCompare(String(b.fullName || ""));
    });
    total = sortedRows.length;
    paginated = sortedRows.slice(skip, skip + limit);
  } else {
    [paginated, total] = await Promise.all([
      employeeQuery.sort(parseSort(req.query.sort, "fullName")).skip(skip).limit(limit),
      Employee.countDocuments(query),
    ]);
  }

  return apiResponse(res, 200, "Employees fetched", paginated.map(shape), {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit) || 1,
  });
});

export const getEmployeeSectionCounts = asyncHandler(async (req, res) => {
  const query = buildQuery({ ...req.query, section: undefined, sectionIds: undefined });

  if (req.query.q) {
    const [matchingDesignations, matchingSections] = await Promise.all([
      Designation.find({ name: regexSearch(req.query.q), isActive: { $ne: false } }).select("_id").lean(),
      OrganizationUnit.find({
        isActive: { $ne: false },
        $or: [{ name: regexSearch(req.query.q) }, { code: regexSearch(req.query.q) }, { path: regexSearch(req.query.q) }],
      }).select("_id").lean(),
    ]);
    const designationIds = matchingDesignations.map((designation) => designation._id);
    const sectionIds = matchingSections.map((section) => section._id);
    if (designationIds.length) query.$or.push({ designation: { $in: designationIds } });
    if (sectionIds.length) query.$or.push({ currentOfficeSection: { $in: sectionIds } });
  }

  const rows = await Employee.aggregate([
    { $match: query },
    { $group: { _id: "$currentOfficeSection", count: { $sum: 1 } } },
  ]);

  return apiResponse(
    res,
    200,
    "Employee section counts fetched",
    rows.map((row) => ({ sectionId: row._id, count: row.count }))
  );
});

export const createEmployee = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  let createdEmployee = null;
  let posting = null;

  await session.withTransaction(async () => {
    const payload = {
      ...req.body,
      createdBy: req.user?._id,
      updatedBy: req.user?._id,
    };

    if ((payload.employmentStatus || "active") === "active") {
      await assertDesignationCapacity({ designationId: payload.designation, session });
    }

    const employee = await Employee.create([payload], { session });
    const created = employee[0];

    if (payload.currentSeat) {
      await attachEmployeeToSeat(created, payload.currentSeat, session);
      created.employmentStatus = "active";
      created.dateOfJoiningCurrentPost = created.dateOfJoiningCurrentPost || new Date();
      await created.save({ session });

      posting = await recordPostingHistory({
        employee: created._id,
        actionType: "appointed",
        toWing: created.currentWing,
        toOfficeSection: created.currentOfficeSection,
        toSeat: created.currentSeat,
        effectiveDate: payload.dateOfJoiningCurrentPost || new Date(),
        orderNumber: req.body.orderNumber || "",
        remarks: req.body.remarks || "",
        session,
      });
    }

    createdEmployee = created;

    await logActivity({
      actorUser: req.user?._id,
      action: "create",
      entityType: "Employee",
      entityId: created._id,
      summary: `Created employee ${created.fullName}`,
      after: shape(created),
      session,
    });
  });

  session.endSession();
  return apiResponse(res, 201, "Employee created", shape(createdEmployee), {
    postingHistoryId: posting?._id || null,
  });
});

export const getEmployeeById = asyncHandler(async (req, res) => {
  const employee = await Employee.findById(req.params.id)
    .populate("designation", "name bps category")
    .populate("currentWing", "name code")
    .populate("currentOfficeSection", "name code type path level sortOrder")
    .populate("currentSeat", "seatTitle seatCode seatStatus currentEmployee additionalChargeHolder");

  if (!employee) throw new AppError("Employee not found", 404);

  const [postingHistory, transfers, leaves, chargeRecords] = await Promise.all([
    PostingHistory.find({ employee: employee._id })
      .populate("fromWing", "name code")
      .populate("fromOfficeSection", "name code type path level sortOrder")
      .populate("fromSeat", "seatTitle seatCode")
      .populate("toWing", "name code")
      .populate("toOfficeSection", "name code type path level sortOrder")
      .populate("toSeat", "seatTitle seatCode")
      .sort({ effectiveDate: -1 }),
    TransferRecord.find({ employee: employee._id })
      .populate("fromWing", "name code")
      .populate("fromOfficeSection", "name code type path level sortOrder")
      .populate("fromSeat", "seatTitle seatCode")
      .populate("toWing", "name code")
      .populate("toOfficeSection", "name code type path level sortOrder")
      .populate("toSeat", "seatTitle seatCode")
      .sort({ transferDate: -1 }),
    LeaveRecord.find({ employee: employee._id }).populate("approvedBy", "fullName email role").sort({ startDate: -1 }),
    AdditionalCharge.find({ additionalChargeHolder: employee._id })
      .populate("vacantSeat", "seatTitle seatCode seatStatus")
      .sort({ startDate: -1 }),
  ]);

  return apiResponse(res, 200, "Employee fetched", {
    ...shape(employee),
    postingHistory,
    transfers,
    leaves,
    chargeRecords,
  });
});

export const updateEmployee = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  let updatedEmployee = null;

  await session.withTransaction(async () => {
    const employee = await Employee.findById(req.params.id).session(session);
    if (!employee) throw new AppError("Employee not found", 404);

    const before = shape(employee);
    const { currentSeat, employmentStatus, ...rest } = req.body;

    Object.assign(employee, rest, {
      updatedBy: req.user?._id,
    });

    if (currentSeat !== undefined) {
      if (currentSeat) {
        await attachEmployeeToSeat(employee, currentSeat, session);
      } else {
        await detachEmployeeFromSeat(employee, session);
      }
    }

    if (employmentStatus) {
      employee.employmentStatus = employmentStatus;
      if (["transferred", "retired", "deceased", "resigned"].includes(employmentStatus)) {
        await detachEmployeeFromSeat(employee, session);
      }
    }

    if (employee.employmentStatus === "active") {
      await assertDesignationCapacity({ designationId: employee.designation, employeeId: employee._id, session });
    }

    if (employee.currentSeat) {
      const seat = await Seat.findById(employee.currentSeat).session(session);
      if (seat) {
        employee.currentWing = seat.wing;
        employee.currentOfficeSection = seat.officeSection;
        employee.designation = seat.designation;
        employee.bps = seat.bps || employee.bps;
      }
    }

    await employee.save({ session });

    if (before.currentSeat?.toString() !== employee.currentSeat?.toString() || before.employmentStatus !== employee.employmentStatus) {
      await recordPostingHistory({
        employee: employee._id,
        actionType:
          employee.employmentStatus === "retired"
            ? "retired"
            : employee.employmentStatus === "deceased"
            ? "deceased"
            : employee.employmentStatus === "resigned"
            ? "resigned"
            : employee.employmentStatus === "transferred"
            ? "transferred"
            : employee.employmentStatus === "suspended"
            ? "suspended"
            : employee.employmentStatus === "on_leave"
            ? "on_leave"
            : "posted",
        fromWing: before.currentWing,
        fromOfficeSection: before.currentOfficeSection,
        fromSeat: before.currentSeat,
        toWing: employee.currentWing,
        toOfficeSection: employee.currentOfficeSection,
        toSeat: employee.currentSeat,
        effectiveDate: new Date(),
        remarks: req.body.remarks || "",
        session,
      });
    }

    await logActivity({
      actorUser: req.user?._id,
      action: "update",
      entityType: "Employee",
      entityId: employee._id,
      summary: `Updated employee ${employee.fullName}`,
      before,
      after: shape(employee),
      session,
    });

    updatedEmployee = employee;
  });

  session.endSession();
  return apiResponse(res, 200, "Employee updated", shape(updatedEmployee));
});

export const updateEmployeeStatus = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  let updatedEmployee = null;

  await session.withTransaction(async () => {
    const employee = await Employee.findById(req.params.id).session(session);
    if (!employee) throw new AppError("Employee not found", 404);

    const before = shape(employee);
    const nextStatus = req.body.employmentStatus;
    if (!nextStatus) throw new AppError("Employment status is required", 400);

    employee.employmentStatus = nextStatus;

    if (["transferred", "retired", "deceased", "resigned"].includes(nextStatus)) {
      await detachEmployeeFromSeat(employee, session);
    }

    if (nextStatus === "on_leave") {
      // Seat remains occupied; only the lifecycle status changes.
    }

    await employee.save({ session });

    await recordPostingHistory({
      employee: employee._id,
      actionType:
        nextStatus === "retired"
          ? "retired"
          : nextStatus === "deceased"
          ? "deceased"
          : nextStatus === "resigned"
          ? "resigned"
          : nextStatus === "transferred"
          ? "transferred"
          : nextStatus === "suspended"
          ? "suspended"
          : nextStatus === "on_leave"
          ? "on_leave"
          : "posted",
      fromWing: before.currentWing,
      fromOfficeSection: before.currentOfficeSection,
      fromSeat: before.currentSeat,
      toWing: employee.currentWing,
      toOfficeSection: employee.currentOfficeSection,
      toSeat: employee.currentSeat,
      effectiveDate: new Date(),
      remarks: req.body.remarks || "",
      session,
    });

    updatedEmployee = employee;
  });

  session.endSession();
  return apiResponse(res, 200, "Employee status updated", shape(updatedEmployee));
});

export const deleteEmployee = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  let archived = null;

  await session.withTransaction(async () => {
    const employee = await Employee.findById(req.params.id).session(session);
    if (!employee) throw new AppError("Employee not found", 404);

    const before = shape(employee);
    await detachEmployeeFromSeat(employee, session);
    employee.isArchived = true;
    employee.archivedAt = new Date();
    await employee.save({ session });

    await logActivity({
      actorUser: req.user?._id,
      action: "archive",
      entityType: "Employee",
      entityId: employee._id,
      summary: `Archived employee ${employee.fullName}`,
      before,
      after: shape(employee),
      session,
    });

    archived = employee;
  });

  session.endSession();
  return apiResponse(res, 200, "Employee archived", shape(archived));
});
