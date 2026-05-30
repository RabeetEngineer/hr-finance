import mongoose from "mongoose";
import AdditionalCharge from "../models/AdditionalCharge.js";
import Seat from "../models/Seat.js";
import Employee from "../models/Employee.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { apiResponse } from "../utils/apiResponse.js";
import AppError from "../utils/AppError.js";
import { parsePagination, parseSort, parseActiveFilter } from "../utils/query.js";
import { logActivity } from "../utils/activityLogger.js";
import { recordPostingHistory } from "../utils/postingHistory.js";

const shape = (record) => ({
  id: record._id,
  vacantSeat: record.vacantSeat,
  additionalChargeHolder: record.additionalChargeHolder,
  startDate: record.startDate,
  endDate: record.endDate,
  orderNumber: record.orderNumber,
  remarks: record.remarks,
  isActive: record.isActive,
  endedAt: record.endedAt,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

export const listAdditionalCharges = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const query = {};
  const isActive = req.query.isActive === undefined ? true : parseActiveFilter(req.query.isActive);
  if (isActive !== undefined) query.isActive = isActive;

  const [records, total] = await Promise.all([
    AdditionalCharge.find(query)
      .populate("vacantSeat", "seatTitle seatCode seatStatus")
      .populate("additionalChargeHolder", "fullName personnelNumber cnic employmentStatus")
      .sort(parseSort(req.query.sort, "-startDate"))
      .skip(skip)
      .limit(limit)
      .lean(),
    AdditionalCharge.countDocuments(query),
  ]);

  return apiResponse(res, 200, "Additional charge records fetched", records.map(shape), {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit) || 1,
  });
});

export const createAdditionalCharge = asyncHandler(async (req, res) => {
  const { vacantSeat, additionalChargeHolder, startDate, endDate = null, orderNumber = "", remarks = "" } = req.body;
  if (!vacantSeat || !additionalChargeHolder || !startDate) {
    throw new AppError("Vacant seat, holder and start date are required", 400);
  }

  const session = await mongoose.startSession();
  let created = null;
  await session.withTransaction(async () => {
    const seat = await Seat.findById(vacantSeat).session(session);
    if (!seat) throw new AppError("Seat not found", 404);
    if (!seat.isActive) throw new AppError("Selected seat is inactive", 400);
    if (seat.currentEmployee || seat.additionalChargeHolder) {
      throw new AppError("Seat is already occupied or under additional charge", 400);
    }

    const employee = await Employee.findById(additionalChargeHolder).session(session);
    if (!employee) throw new AppError("Employee not found", 404);
    if (employee.isArchived) throw new AppError("Archived employees cannot hold additional charge", 400);

    const record = await AdditionalCharge.create(
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

    seat.additionalChargeHolder = employee._id;
    seat.seatStatus = "additional_charge";
    await seat.save({ session });

    await recordPostingHistory({
      employee: employee._id,
      actionType: "additional_charge",
      toSeat: seat._id,
      effectiveDate: startDate,
      orderNumber,
      remarks,
      session,
    });

    created = record[0];
  });
  session.endSession();

  await logActivity({
    actorUser: req.user?._id,
    action: "create",
    entityType: "AdditionalCharge",
    entityId: created?._id,
    summary: "Created additional charge record",
    after: created ? shape(created) : null,
  });

  return apiResponse(res, 201, "Additional charge created", created ? shape(created) : null);
});

export const endAdditionalCharge = asyncHandler(async (req, res) => {
  const record = await AdditionalCharge.findById(req.params.id);
  if (!record) throw new AppError("Additional charge record not found", 404);
  const before = shape(record);

  record.isActive = false;
  record.endDate = req.body.endDate || record.endDate;
  record.endedAt = new Date();
  record.endedBy = req.user?._id;
  await record.save();

  const seat = await Seat.findById(record.vacantSeat);
  if (seat) {
    seat.additionalChargeHolder = null;
    seat.seatStatus = seat.currentEmployee ? "occupied" : "vacant";
    await seat.save();
  }

  await logActivity({
    actorUser: req.user?._id,
    action: "end",
    entityType: "AdditionalCharge",
    entityId: record._id,
    summary: `Ended additional charge for seat ${record.vacantSeat}`,
    before,
    after: shape(record),
  });

  return apiResponse(res, 200, "Additional charge ended", shape(record));
});

export const getAdditionalChargeById = asyncHandler(async (req, res) => {
  const record = await AdditionalCharge.findById(req.params.id)
    .populate("vacantSeat", "seatTitle seatCode seatStatus")
    .populate("additionalChargeHolder", "fullName personnelNumber cnic employmentStatus")
    .lean();
  if (!record) throw new AppError("Additional charge record not found", 404);
  return apiResponse(res, 200, "Additional charge fetched", shape(record));
});

export const updateAdditionalCharge = asyncHandler(async (req, res) => {
  const record = await AdditionalCharge.findById(req.params.id);
  if (!record) throw new AppError("Additional charge record not found", 404);
  const before = shape(record);

  const nextVacantSeat = req.body.vacantSeat || record.vacantSeat;
  const nextHolder = req.body.additionalChargeHolder || record.additionalChargeHolder;

  if (record.isActive && (String(nextVacantSeat) !== String(record.vacantSeat) || String(nextHolder) !== String(record.additionalChargeHolder))) {
    const previousSeat = await Seat.findById(record.vacantSeat);
    const seat = await Seat.findById(nextVacantSeat);
    const employee = await Employee.findById(nextHolder);

    if (!seat) throw new AppError("Seat not found", 404);
    if (!seat.isActive) throw new AppError("Selected seat is inactive", 400);
    if (!employee) throw new AppError("Employee not found", 404);
    if (employee.isArchived) throw new AppError("Archived employees cannot hold additional charge", 400);
    if (seat.currentEmployee || (seat.additionalChargeHolder && String(seat._id) !== String(record.vacantSeat))) {
      throw new AppError("Selected seat is already occupied or under additional charge", 409);
    }

    if (previousSeat && String(previousSeat._id) !== String(seat._id)) {
      previousSeat.additionalChargeHolder = null;
      previousSeat.seatStatus = previousSeat.currentEmployee ? "occupied" : "vacant";
      await previousSeat.save();
    }

    seat.additionalChargeHolder = employee._id;
    seat.seatStatus = "additional_charge";
    await seat.save();

    record.vacantSeat = seat._id;
    record.additionalChargeHolder = employee._id;
  }

  Object.assign(record, {
    ...req.body,
    vacantSeat: nextVacantSeat,
    additionalChargeHolder: nextHolder,
  });
  await record.save();

  await logActivity({
    actorUser: req.user?._id,
    action: "update",
    entityType: "AdditionalCharge",
    entityId: record._id,
    summary: "Updated additional charge record",
    before,
    after: shape(record),
  });

  return apiResponse(res, 200, "Additional charge updated", shape(record));
});
