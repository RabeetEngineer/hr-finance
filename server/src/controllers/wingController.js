import Wing from "../models/Wing.js";
import OfficeSection from "../models/OfficeSection.js";
import Seat from "../models/Seat.js";
import Employee from "../models/Employee.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { apiResponse } from "../utils/apiResponse.js";
import AppError from "../utils/AppError.js";
import { parsePagination, regexSearch, parseSort, parseActiveFilter } from "../utils/query.js";
import { logActivity } from "../utils/activityLogger.js";

const shape = (wing) => ({
  id: wing._id,
  name: wing.name,
  code: wing.code,
  description: wing.description,
  sortOrder: wing.sortOrder,
  isActive: wing.isActive,
  createdAt: wing.createdAt,
  updatedAt: wing.updatedAt,
});

export const listWings = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const query = {};
  if (req.query.q) query.$or = [{ name: regexSearch(req.query.q) }, { code: regexSearch(req.query.q) }];
  const isActive = req.query.isActive === undefined ? true : parseActiveFilter(req.query.isActive);
  if (isActive !== undefined) query.isActive = isActive;

  const [wings, total] = await Promise.all([
    Wing.find(query).sort(parseSort(req.query.sort, "sortOrder name")).skip(skip).limit(limit).lean(),
    Wing.countDocuments(query),
  ]);

  return apiResponse(res, 200, "Wings fetched", wings.map(shape), {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit) || 1,
  });
});

export const createWing = asyncHandler(async (req, res) => {
  const wing = await Wing.create({
    ...req.body,
    createdBy: req.user?._id,
  });

  await logActivity({
    actorUser: req.user?._id,
    action: "create",
    entityType: "Wing",
    entityId: wing._id,
    summary: `Created wing ${wing.name}`,
    after: shape(wing),
  });

  return apiResponse(res, 201, "Wing created", shape(wing));
});

export const getWingById = asyncHandler(async (req, res) => {
  const wing = await Wing.findById(req.params.id).lean();
  if (!wing) throw new AppError("Wing not found", 404);
  return apiResponse(res, 200, "Wing fetched", shape(wing));
});

export const updateWing = asyncHandler(async (req, res) => {
  const wing = await Wing.findById(req.params.id);
  if (!wing) throw new AppError("Wing not found", 404);
  const before = shape(wing);

  Object.assign(wing, req.body);
  await wing.save();

  await logActivity({
    actorUser: req.user?._id,
    action: "update",
    entityType: "Wing",
    entityId: wing._id,
    summary: `Updated wing ${wing.name}`,
    before,
    after: shape(wing),
  });

  return apiResponse(res, 200, "Wing updated", shape(wing));
});

export const deleteWing = asyncHandler(async (req, res) => {
  const wing = await Wing.findById(req.params.id);
  if (!wing) throw new AppError("Wing not found", 404);

  const [officeCount, seatCount, employeeCount] = await Promise.all([
    OfficeSection.countDocuments({ wing: wing._id }),
    Seat.countDocuments({ wing: wing._id }),
    Employee.countDocuments({ currentWing: wing._id }),
  ]);

  if (officeCount || seatCount || employeeCount) {
    throw new AppError(
      "Wing cannot be deactivated because offices, seats, or employees are still linked to it",
      409
    );
  }

  const before = shape(wing);
  wing.isActive = false;
  await wing.save();

  await logActivity({
    actorUser: req.user?._id,
    action: "deactivate",
    entityType: "Wing",
    entityId: wing._id,
    summary: `Deactivated wing ${wing.name}`,
    before,
    after: shape(wing),
  });

  return apiResponse(res, 200, "Wing deactivated", shape(wing));
});
