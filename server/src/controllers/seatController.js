import mongoose from "mongoose";
import Seat from "../models/Seat.js";
import Employee from "../models/Employee.js";
import AdditionalCharge from "../models/AdditionalCharge.js";
import Wing from "../models/Wing.js";
import OfficeSection from "../models/OfficeSection.js";
import Designation from "../models/Designation.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { apiResponse } from "../utils/apiResponse.js";
import AppError from "../utils/AppError.js";
import { parsePagination, regexSearch, parseSort, parseActiveFilter } from "../utils/query.js";
import { logActivity } from "../utils/activityLogger.js";
import { recordPostingHistory } from "../utils/postingHistory.js";
import { syncSeatState } from "../utils/seatWorkflow.js";

const shape = (seat) => ({
  id: seat._id,
  seatTitle: seat.seatTitle,
  seatCode: seat.seatCode,
  designation: seat.designation,
  officeSection: seat.officeSection,
  wing: seat.wing,
  bps: seat.bps,
  seatStatus: seat.seatStatus,
  currentEmployee: seat.currentEmployee,
  additionalChargeHolder: seat.additionalChargeHolder,
  remarks: seat.remarks,
  isActive: seat.isActive,
  createdAt: seat.createdAt,
  updatedAt: seat.updatedAt,
});

const seatQuery = (query = {}) =>
  Seat.find(query)
    .populate("designation", "name bps category")
    .populate("officeSection", "name code type path level sortOrder")
    .populate("wing", "name code")
    .populate("currentEmployee", "fullName personnelNumber cnic employmentStatus")
    .populate("additionalChargeHolder", "fullName personnelNumber cnic employmentStatus")
    .lean();

export const listSeats = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const query = {};
  if (req.query.q) query.$or = [{ seatTitle: regexSearch(req.query.q) }, { seatCode: regexSearch(req.query.q) }];
  if (req.query.wing) query.wing = req.query.wing;
  if (req.query.officeSection) query.officeSection = req.query.officeSection;
  if (req.query.designation) query.designation = req.query.designation;
  if (req.query.seatStatus) query.seatStatus = req.query.seatStatus;
  const isActive = req.query.isActive === undefined ? true : parseActiveFilter(req.query.isActive);
  if (isActive !== undefined) query.isActive = isActive;

  const [seats, total] = await Promise.all([
    seatQuery(query).sort(parseSort(req.query.sort, "seatTitle")).skip(skip).limit(limit),
    Seat.countDocuments(query),
  ]);

  return apiResponse(res, 200, "Seats fetched", seats.map(shape), {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit) || 1,
  });
});

export const listVacantSeats = asyncHandler(async (req, res) => {
  const seats = await Seat.find({
    seatStatus: "vacant",
    isActive: true,
  })
    .populate("designation", "name bps category")
    .populate("officeSection", "name code type path level sortOrder")
    .populate("wing", "name code")
    .populate("additionalChargeHolder", "fullName personnelNumber cnic employmentStatus")
    .sort("seatTitle")
    .lean();

  return apiResponse(res, 200, "Vacant seats fetched", seats.map(shape));
});

export const createSeat = asyncHandler(async (req, res) => {
  const wing = req.body.wing ? await Wing.findById(req.body.wing) : null;
  if (req.body.wing && !wing) throw new AppError("Wing not found", 404);
  if (wing && !wing.isActive) throw new AppError("Selected wing is inactive", 400);

  const officeSection = await OfficeSection.findById(req.body.officeSection);
  if (!officeSection) throw new AppError("Office/section not found", 404);
  if (!officeSection.isActive) throw new AppError("Selected office/section is inactive", 400);

  const designation = await Designation.findById(req.body.designation);
  if (!designation) throw new AppError("Designation not found", 404);
  if (!designation.isActive) throw new AppError("Selected designation is inactive", 400);

  const seat = await Seat.create({
    ...req.body,
    wing: req.body.wing || null,
    createdBy: req.user?._id,
  });
  seat.seatStatus = syncSeatState(seat);
  await seat.save();

  await logActivity({
    actorUser: req.user?._id,
    action: "create",
    entityType: "Seat",
    entityId: seat._id,
    summary: `Created seat ${seat.seatTitle}`,
    after: shape(seat),
  });

  return apiResponse(res, 201, "Seat created", shape(seat));
});

export const getSeatById = asyncHandler(async (req, res) => {
  const seat = await Seat.findById(req.params.id)
    .populate("designation", "name bps category")
    .populate("officeSection", "name code type path level sortOrder")
    .populate("wing", "name code")
    .populate("currentEmployee", "fullName personnelNumber cnic employmentStatus")
    .populate("additionalChargeHolder", "fullName personnelNumber cnic employmentStatus")
    .lean();
  if (!seat) throw new AppError("Seat not found", 404);
  return apiResponse(res, 200, "Seat fetched", shape(seat));
});

export const updateSeat = asyncHandler(async (req, res) => {
  const seat = await Seat.findById(req.params.id);
  if (!seat) throw new AppError("Seat not found", 404);
  const before = shape(seat);

  if (req.body.wing !== undefined) {
    const wing = req.body.wing ? await Wing.findById(req.body.wing) : null;
    if (req.body.wing && !wing) throw new AppError("Wing not found", 404);
    if (wing && !wing.isActive) throw new AppError("Selected wing is inactive", 400);
  }

  if (req.body.officeSection) {
    const officeSection = await OfficeSection.findById(req.body.officeSection);
    if (!officeSection) throw new AppError("Office/section not found", 404);
    if (!officeSection.isActive) throw new AppError("Selected office/section is inactive", 400);
  }

  if (req.body.designation) {
    const designation = await Designation.findById(req.body.designation);
    if (!designation) throw new AppError("Designation not found", 404);
    if (!designation.isActive) throw new AppError("Selected designation is inactive", 400);
  }

  Object.assign(seat, req.body);
  if (req.body.wing !== undefined) {
    seat.wing = req.body.wing || null;
  }
  seat.seatStatus = syncSeatState(seat);

  await seat.save();
  await logActivity({
    actorUser: req.user?._id,
    action: "update",
    entityType: "Seat",
    entityId: seat._id,
    summary: `Updated seat ${seat.seatTitle}`,
    before,
    after: shape(seat),
  });

  return apiResponse(res, 200, "Seat updated", shape(seat));
});

export const assignSeat = asyncHandler(async (req, res) => {
  const { employeeId } = req.body;
  if (!employeeId) throw new AppError("Employee is required", 400);

  const session = await mongoose.startSession();
  let response;

  await session.withTransaction(async () => {
    const seat = await Seat.findById(req.params.id).session(session);
    if (!seat) throw new AppError("Seat not found", 404);
    if (!seat.isActive) throw new AppError("Inactive seat cannot be assigned", 400);
    if (seat.seatStatus === "frozen") throw new AppError("Frozen seat cannot be assigned", 400);

    const employee = await Employee.findById(employeeId).session(session);
    if (!employee) throw new AppError("Employee not found", 404);
    if (employee.isArchived) throw new AppError("Archived employees cannot be assigned to a seat", 400);

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
    employee.employmentStatus = "active";
    await employee.save({ session });

    await recordPostingHistory({
      employee: employee._id,
      actionType: "posted",
      toWing: seat.wing,
      toOfficeSection: seat.officeSection,
      toSeat: seat._id,
      orderNumber: req.body.orderNumber || "",
      remarks: req.body.remarks || "",
      session,
    });

    await logActivity({
      actorUser: req.user?._id,
      action: "assign",
      entityType: "Seat",
      entityId: seat._id,
      summary: `Assigned employee ${employee.fullName} to seat ${seat.seatTitle}`,
      after: { seat: shape(seat), employee: employee._id },
      session,
    });

    response = { seat: shape(seat) };
  });

  session.endSession();
  return apiResponse(res, 200, "Seat assigned", response);
});

export const vacateSeat = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  let updatedSeat = null;
  await session.withTransaction(async () => {
    const seat = await Seat.findById(req.params.id).session(session);
    if (!seat) throw new AppError("Seat not found", 404);

    const employeeId = seat.currentEmployee;
    seat.currentEmployee = null;
    seat.seatStatus = seat.additionalChargeHolder ? "additional_charge" : "vacant";
    await seat.save({ session });

    if (employeeId) {
      const employee = await Employee.findById(employeeId).session(session);
      if (employee) {
        employee.currentSeat = null;
        await employee.save({ session });
      }
    }

    updatedSeat = shape(seat);

    await logActivity({
      actorUser: req.user?._id,
      action: "vacate",
      entityType: "Seat",
      entityId: seat._id,
      summary: `Vacated seat ${seat.seatTitle}`,
      before: null,
      after: updatedSeat,
      session,
    });
  });
  session.endSession();
  return apiResponse(res, 200, "Seat vacated", updatedSeat);
});

export const assignAdditionalCharge = asyncHandler(async (req, res) => {
  const { employeeId, startDate, endDate = null, orderNumber = "", remarks = "" } = req.body;
  if (!employeeId || !startDate) throw new AppError("Vacant seat, employee and start date are required", 400);

  const session = await mongoose.startSession();
  let record = null;
  await session.withTransaction(async () => {
    const seat = await Seat.findById(req.params.id).session(session);
    if (!seat) throw new AppError("Seat not found", 404);
    if (!seat.isActive) throw new AppError("Inactive seat cannot receive additional charge", 400);
    if (seat.currentEmployee || seat.additionalChargeHolder) {
      throw new AppError("Additional charge can only be assigned to a seat that is fully vacant", 400);
    }

    const employee = await Employee.findById(employeeId).session(session);
    if (!employee) throw new AppError("Employee not found", 404);
    if (employee.isArchived) throw new AppError("Archived employees cannot hold additional charge", 400);

    seat.additionalChargeHolder = employee._id;
    seat.seatStatus = "additional_charge";
    await seat.save({ session });

    record = await AdditionalCharge.create(
      [
        {
          vacantSeat: seat._id,
          additionalChargeHolder: employee._id,
          startDate,
          endDate,
          orderNumber,
          remarks,
          createdBy: req.user?._id,
        },
      ],
      { session }
    );

    await recordPostingHistory({
      employee: employee._id,
      actionType: "additional_charge",
      toSeat: seat._id,
      effectiveDate: startDate,
      orderNumber,
      remarks,
      session,
    });

    await logActivity({
      actorUser: req.user?._id,
      action: "additional_charge",
      entityType: "Seat",
      entityId: seat._id,
      summary: `Assigned additional charge for seat ${seat.seatTitle}`,
      after: { seat: shape(seat), employee: employee._id, recordId: record?.[0]?._id || null },
      session,
    });
  });
  session.endSession();

  return apiResponse(res, 201, "Additional charge assigned", record?.[0] || null);
});

export const deleteSeat = asyncHandler(async (req, res) => {
  const seat = await Seat.findById(req.params.id);
  if (!seat) throw new AppError("Seat not found", 404);

  if (seat.currentEmployee || seat.additionalChargeHolder) {
    throw new AppError("Seat cannot be deactivated while an employee or additional charge holder is linked to it", 409);
  }

  const before = shape(seat);
  seat.isActive = false;
  seat.seatStatus = "vacant";
  await seat.save();

  await logActivity({
    actorUser: req.user?._id,
    action: "deactivate",
    entityType: "Seat",
    entityId: seat._id,
    summary: `Deactivated seat ${seat.seatTitle}`,
    before,
    after: shape(seat),
  });

  return apiResponse(res, 200, "Seat deactivated", shape(seat));
});
