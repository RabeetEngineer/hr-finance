import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { apiResponse } from "../utils/apiResponse.js";
import AppError from "../utils/AppError.js";
import { parsePagination, regexSearch, parseSort, parseActiveFilter } from "../utils/query.js";
import { logActivity } from "../utils/activityLogger.js";

const sanitize = (user) => ({
  id: user._id,
  fullName: user.fullName,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const query = {};
  if (req.query.q) {
    query.$or = [
      { fullName: regexSearch(req.query.q) },
      { email: regexSearch(req.query.q) },
    ];
  }

  if (req.query.role) query.role = req.query.role;
  const isActive = parseActiveFilter(req.query.isActive);
  if (isActive !== undefined) query.isActive = isActive;

  const [users, total] = await Promise.all([
    User.find(query).sort(parseSort(req.query.sort, "-createdAt")).skip(skip).limit(limit).lean(),
    User.countDocuments(query),
  ]);

  return apiResponse(
    res,
    200,
    "Users fetched",
    users.map(sanitize),
    { page, limit, total, pages: Math.ceil(total / limit) || 1 }
  );
});

export const createUser = asyncHandler(async (req, res) => {
  const { fullName, email, password, role = "viewer" } = req.body;
  if (!fullName || !email || !password) throw new AppError("Full name, email and password are required", 400);

  const passwordHash = await bcrypt.hash(String(password), 12);
  const user = await User.create({
    fullName,
    email,
    passwordHash,
    role,
    isActive: true,
  });

  await logActivity({
    actorUser: req.user?._id,
    action: "create",
    entityType: "User",
    entityId: user._id,
    summary: `Created user ${user.fullName}`,
    after: sanitize(user),
    metadata: { role: user.role },
  });

  return apiResponse(res, 201, "User created", sanitize(user));
});

export const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError("User not found", 404);
  return apiResponse(res, 200, "User fetched", sanitize(user));
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError("User not found", 404);

  const before = sanitize(user);
  const { fullName, email, password, role, isActive } = req.body;

  if (fullName !== undefined) user.fullName = fullName;
  if (email !== undefined) user.email = email;
  if (role !== undefined) user.role = role;
  if (isActive !== undefined) user.isActive = isActive === true || isActive === "true";
  if (password) user.passwordHash = await bcrypt.hash(String(password), 12);

  await user.save();

  await logActivity({
    actorUser: req.user?._id,
    action: "update",
    entityType: "User",
    entityId: user._id,
    summary: `Updated user ${user.fullName}`,
    before,
    after: sanitize(user),
  });

  return apiResponse(res, 200, "User updated", sanitize(user));
});

export const updateUserStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError("User not found", 404);

  const before = sanitize(user);
  const nextStatus = req.body.isActive === true || req.body.isActive === "true";
  user.isActive = nextStatus;
  await user.save();

  await logActivity({
    actorUser: req.user?._id,
    action: "status",
    entityType: "User",
    entityId: user._id,
    summary: `Updated user status for ${user.fullName}`,
    before,
    after: sanitize(user),
  });

  return apiResponse(res, 200, "User status updated", sanitize(user));
});

export const updateUserRole = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError("User not found", 404);

  const before = sanitize(user);
  user.role = req.body.role;
  await user.save();

  await logActivity({
    actorUser: req.user?._id,
    action: "role",
    entityType: "User",
    entityId: user._id,
    summary: `Updated user role for ${user.fullName}`,
    before,
    after: sanitize(user),
  });

  return apiResponse(res, 200, "User role updated", sanitize(user));
});

export const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError("User not found", 404);

  await User.deleteOne({ _id: user._id });
  await logActivity({
    actorUser: req.user?._id,
    action: "delete",
    entityType: "User",
    entityId: user._id,
    summary: `Deleted user ${user.fullName}`,
    before: sanitize(user),
  });
  return apiResponse(res, 200, "User deleted", sanitize(user));
});
