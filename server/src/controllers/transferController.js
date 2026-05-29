import mongoose from "mongoose";
import Employee from "../models/Employee.js";
import Seat from "../models/Seat.js";
import Wing from "../models/Wing.js";
import OfficeSection from "../models/OfficeSection.js";
import TransferRecord from "../models/TransferRecord.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { apiResponse } from "../utils/apiResponse.js";
import AppError from "../utils/AppError.js";
import { parsePagination, parseSort } from "../utils/query.js";
import { logActivity } from "../utils/activityLogger.js";
import { recordPostingHistory } from "../utils/postingHistory.js";

const shape = (record) => ({
  id: record._id,
  employee: record.employee,
  fromWing: record.fromWing,
  fromOfficeSection: record.fromOfficeSection,
  fromSeat: record.fromSeat,
  toWing: record.toWing,
  toOfficeSection: record.toOfficeSection,
  toSeat: record.toSeat,
  transferDate: record.transferDate,
  orderNumber: record.orderNumber,
  remarks: record.remarks,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

export const listTransfers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const query = {};
  if (req.query.employee) query.employee = req.query.employee;
  if (req.query.fromDate || req.query.toDate) {
    query.transferDate = {};
    if (req.query.fromDate) query.transferDate.$gte = new Date(req.query.fromDate);
    if (req.query.toDate) query.transferDate.$lte = new Date(req.query.toDate);
  }

  const [records, total] = await Promise.all([
    TransferRecord.find(query)
      .populate("employee", "fullName personnelNumber cnic employmentStatus")
      .populate("fromWing", "name code")
      .populate("fromOfficeSection", "name code type path level sortOrder")
      .populate("fromSeat", "seatTitle seatCode")
      .populate("toWing", "name code")
      .populate("toOfficeSection", "name code type path level sortOrder")
      .populate("toSeat", "seatTitle seatCode")
      .sort(parseSort(req.query.sort, "-transferDate"))
      .skip(skip)
      .limit(limit),
    TransferRecord.countDocuments(query),
  ]);

  return apiResponse(res, 200, "Transfer records fetched", records.map(shape), {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit) || 1,
  });
});

export const createTransfer = asyncHandler(async (req, res) => {
  const { employeeId, transferDate, orderNumber = "", remarks = "", toWing = null, toOfficeSection = null, toSeat = null } = req.body;
  if (!employeeId || !transferDate) throw new AppError("Employee and transfer date are required", 400);

  const session = await mongoose.startSession();
  let created = null;

  await session.withTransaction(async () => {
    const employee = await Employee.findById(employeeId).session(session);
    if (!employee) throw new AppError("Employee not found", 404);
    if (employee.isArchived) throw new AppError("Archived employees cannot be transferred", 400);
    const fromWing = employee.currentWing;
    const fromOfficeSection = employee.currentOfficeSection;
    const fromSeatId = employee.currentSeat;

    if (toWing) {
      const wing = await Wing.findById(toWing).session(session);
      if (!wing) throw new AppError("Target wing not found", 404);
      if (!wing.isActive) throw new AppError("Target wing is inactive", 400);
    }

    if (toOfficeSection) {
      const office = await OfficeSection.findById(toOfficeSection).session(session);
      if (!office) throw new AppError("Target office/section not found", 404);
      if (!office.isActive) throw new AppError("Target office/section is inactive", 400);
    }

    const fromSeat = fromSeatId ? await Seat.findById(fromSeatId).session(session) : null;
    if (fromSeat) {
      fromSeat.currentEmployee = null;
      fromSeat.seatStatus = fromSeat.additionalChargeHolder ? "additional_charge" : "vacant";
      await fromSeat.save({ session });
    }

    if (toSeat) {
      const targetSeat = await Seat.findById(toSeat).session(session);
      if (!targetSeat) throw new AppError("Target seat not found", 404);
      if (!targetSeat.isActive) throw new AppError("Target seat is inactive", 400);
      if (targetSeat.currentEmployee || targetSeat.additionalChargeHolder) {
        throw new AppError("Target seat must be fully vacant before transfer", 409);
      }
    }

    const record = await TransferRecord.create(
      [
        {
          employee: employee._id,
          fromWing,
          fromOfficeSection,
          fromSeat: fromSeatId,
          toWing,
          toOfficeSection,
          toSeat,
          transferDate,
          orderNumber,
          remarks,
          createdBy: req.user?._id,
        },
      ],
      { session }
    );

    employee.employmentStatus = "transferred";
    employee.currentSeat = null;
    employee.currentWing = toWing || employee.currentWing;
    employee.currentOfficeSection = toOfficeSection || employee.currentOfficeSection;
    await employee.save({ session });

    await recordPostingHistory({
      employee: employee._id,
      actionType: "transferred",
      fromWing,
      fromOfficeSection,
      fromSeat: fromSeat?._id || null,
      toWing,
      toOfficeSection,
      toSeat,
      effectiveDate: transferDate,
      orderNumber,
      remarks,
      session,
    });

    await logActivity({
      actorUser: req.user?._id,
      action: "transfer",
      entityType: "Employee",
      entityId: employee._id,
      summary: `Transferred employee ${employee.fullName}`,
      metadata: { transferDate, orderNumber },
      session,
    });

    created = record[0];
  });

  session.endSession();
  return apiResponse(res, 201, "Transfer recorded", shape(created));
});

export const getTransferById = asyncHandler(async (req, res) => {
  const record = await TransferRecord.findById(req.params.id)
    .populate("employee", "fullName personnelNumber cnic employmentStatus")
    .populate("fromWing", "name code")
    .populate("fromOfficeSection", "name code type path level sortOrder")
    .populate("fromSeat", "seatTitle seatCode")
    .populate("toWing", "name code")
    .populate("toOfficeSection", "name code type path level sortOrder")
    .populate("toSeat", "seatTitle seatCode");

  if (!record) throw new AppError("Transfer record not found", 404);
  return apiResponse(res, 200, "Transfer record fetched", shape(record));
});
