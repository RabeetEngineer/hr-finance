import Designation from "../models/Designation.js";
import Seat from "../models/Seat.js";
import Employee from "../models/Employee.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { apiResponse } from "../utils/apiResponse.js";
import AppError from "../utils/AppError.js";
import { parsePagination, regexSearch, parseSort, parseActiveFilter } from "../utils/query.js";
import { logActivity } from "../utils/activityLogger.js";

const shape = (designation) => ({
  id: designation._id,
  name: designation.name,
  bps: designation.bps,
  totalStrength: designation.totalStrength,
  category: designation.category,
  sortOrder: designation.sortOrder,
  isActive: designation.isActive,
  createdAt: designation.createdAt,
  updatedAt: designation.updatedAt,
});

export const listDesignations = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const query = {};
  if (req.query.q) query.$or = [{ name: regexSearch(req.query.q) }, { bps: regexSearch(req.query.q) }];
  if (req.query.category) query.category = req.query.category;
  const isActive = req.query.isActive === undefined ? true : parseActiveFilter(req.query.isActive);
  if (isActive !== undefined) query.isActive = isActive;

  const [designations, total] = await Promise.all([
    Designation.find(query)
      .select("name bps totalStrength category sortOrder isActive createdAt updatedAt")
      .sort(parseSort(req.query.sort, "sortOrder name"))
      .skip(skip)
      .limit(limit)
      .lean(),
    Designation.countDocuments(query),
  ]);

  return apiResponse(res, 200, "Designations fetched", designations.map(shape), {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit) || 1,
  });
});

export const createDesignation = asyncHandler(async (req, res) => {
  const designation = await Designation.create({
    ...req.body,
    createdBy: req.user?._id,
  });

  await logActivity({
    actorUser: req.user?._id,
    action: "create",
    entityType: "Designation",
    entityId: designation._id,
    summary: `Created designation ${designation.name}`,
    after: shape(designation),
  });

  return apiResponse(res, 201, "Designation created", shape(designation));
});

export const getDesignationById = asyncHandler(async (req, res) => {
  const designation = await Designation.findById(req.params.id).lean();
  if (!designation) throw new AppError("Designation not found", 404);
  return apiResponse(res, 200, "Designation fetched", shape(designation));
});

export const updateDesignation = asyncHandler(async (req, res) => {
  const designation = await Designation.findById(req.params.id);
  if (!designation) throw new AppError("Designation not found", 404);
  const before = shape(designation);

  Object.assign(designation, req.body);
  await designation.save();

  await logActivity({
    actorUser: req.user?._id,
    action: "update",
    entityType: "Designation",
    entityId: designation._id,
    summary: `Updated designation ${designation.name}`,
    before,
    after: shape(designation),
  });

  return apiResponse(res, 200, "Designation updated", shape(designation));
});

export const deleteDesignation = asyncHandler(async (req, res) => {
  const designation = await Designation.findById(req.params.id);
  if (!designation) throw new AppError("Designation not found", 404);

  const [seatCount, employeeCount] = await Promise.all([
    Seat.countDocuments({ designation: designation._id }),
    Employee.countDocuments({ designation: designation._id }),
  ]);

  if (seatCount || employeeCount) {
    throw new AppError(
      "Designation cannot be deleted because seats or employees are still linked to it",
      409
    );
  }

  const before = shape(designation);
  await Designation.deleteOne({ _id: designation._id });

  await logActivity({
    actorUser: req.user?._id,
    action: "delete",
    entityType: "Designation",
    entityId: designation._id,
    summary: `Deleted designation ${designation.name}`,
    before,
  });

  return apiResponse(res, 200, "Designation deleted", before);
});
