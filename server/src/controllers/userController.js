import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import User from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { apiResponse } from "../utils/apiResponse.js";
import AppError from "../utils/AppError.js";
import { parsePagination, regexSearch, parseSort, parseActiveFilter } from "../utils/query.js";
import { logActivity } from "../utils/activityLogger.js";
import { sendEmail } from "../utils/email.js";

const codeTtlMinutes = Number(process.env.ACCOUNT_CODE_TTL_MINUTES || 15);
const generateCode = () => String(crypto.randomInt(100000, 1000000));
const hashCode = (code) => crypto.createHash("sha256").update(String(code)).digest("hex");
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const normalizeMobile = (value) => String(value || "").trim();
const validRoles = new Set(["super_admin", "admin", "data_entry", "viewer"]);

const sanitize = (user) => ({
  id: user._id,
  fullName: user.fullName,
  email: user.email,
  mobile: user.mobile || "",
  role: user.role,
  isActive: user.isActive,
  isEmailVerified: user.isEmailVerified,
  lastLoginAt: user.lastLoginAt,
  createdBy: user.createdBy,
  updatedBy: user.updatedBy,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const sendActivationCode = async (user, code) =>
  sendEmail({
    to: user.email,
    subject: "HR Finance account activation code",
    text: `Dear ${user.fullName},\n\nYour HR Finance account activation code is ${code}. It expires in ${codeTtlMinutes} minutes.`,
    html: `<p>Dear ${user.fullName},</p><p>Your HR Finance account activation code is <strong>${code}</strong>.</p><p>It expires in ${codeTtlMinutes} minutes.</p>`,
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
  const { fullName, email, mobile, password, role = "viewer" } = req.body;
  if (!fullName || !email || !password) throw new AppError("Full name, email and password are required", 400);
  if (!validRoles.has(role)) throw new AppError("Invalid role selected", 400);

  const normalizedEmail = normalizeEmail(email);
  const existing = await User.findOne({ email: normalizedEmail }).lean();
  if (existing) throw new AppError("A user with this email already exists", 409);

  const passwordHash = await bcrypt.hash(String(password), 12);
  const activationCode = generateCode();
  const user = await User.create({
    fullName: String(fullName).trim(),
    email: normalizedEmail,
    mobile: normalizeMobile(mobile),
    passwordHash,
    role,
    isActive: req.body.isActive === undefined ? true : req.body.isActive === true || req.body.isActive === "true",
    isEmailVerified: req.body.isEmailVerified === true || req.body.isEmailVerified === "true",
    emailVerificationCodeHash: hashCode(activationCode),
    emailVerificationExpiresAt: new Date(Date.now() + codeTtlMinutes * 60 * 1000),
    createdBy: req.user?._id,
    updatedBy: req.user?._id,
  });
  const emailResult = user.isEmailVerified ? { sent: false } : await sendActivationCode(user, activationCode);

  await logActivity({
    actorUser: req.user?._id,
    action: "create",
    entityType: "User",
    entityId: user._id,
    summary: `Created user ${user.fullName}`,
    after: sanitize(user),
    metadata: { role: user.role, activationEmailSent: emailResult.sent },
  });

  return apiResponse(
    res,
    201,
    user.isEmailVerified ? "User created" : "User created and activation code sent",
    sanitize(user),
    process.env.NODE_ENV === "production" || user.isEmailVerified ? null : { devActivationCode: activationCode, emailSent: emailResult.sent }
  );
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
  const { fullName, email, mobile, password, role, isActive, isEmailVerified } = req.body;

  if (fullName !== undefined) user.fullName = String(fullName).trim();
  if (email !== undefined) {
    const normalizedEmail = normalizeEmail(email);
    const existing = await User.findOne({ email: normalizedEmail, _id: { $ne: user._id } }).lean();
    if (existing) throw new AppError("A user with this email already exists", 409);
    user.email = normalizedEmail;
  }
  if (mobile !== undefined) user.mobile = normalizeMobile(mobile);
  if (role !== undefined) {
    if (!validRoles.has(role)) throw new AppError("Invalid role selected", 400);
    if (String(user._id) === String(req.user?._id) && user.role === "super_admin" && role !== "super_admin") {
      throw new AppError("You cannot remove your own Super Admin role", 400);
    }
    user.role = role;
  }
  if (isActive !== undefined) user.isActive = isActive === true || isActive === "true";
  if (isEmailVerified !== undefined) user.isEmailVerified = isEmailVerified === true || isEmailVerified === "true";
  if (password) user.passwordHash = await bcrypt.hash(String(password), 12);
  user.updatedBy = req.user?._id;

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
  if (String(user._id) === String(req.user?._id) && !nextStatus) {
    throw new AppError("You cannot deactivate your own account", 400);
  }
  user.isActive = nextStatus;
  user.updatedBy = req.user?._id;
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

export const resendUserActivation = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select("+emailVerificationCodeHash +emailVerificationExpiresAt");
  if (!user) throw new AppError("User not found", 404);
  if (!user.isActive) throw new AppError("User must be active before activation email can be sent", 400);
  if (user.isEmailVerified) return apiResponse(res, 200, "User is already activated", sanitize(user));

  const activationCode = generateCode();
  user.emailVerificationCodeHash = hashCode(activationCode);
  user.emailVerificationExpiresAt = new Date(Date.now() + codeTtlMinutes * 60 * 1000);
  await user.save();
  const emailResult = await sendActivationCode(user, activationCode);

  await logActivity({
    actorUser: req.user?._id,
    action: "activation_resend",
    entityType: "User",
    entityId: user._id,
    summary: `Resent activation code for ${user.fullName}`,
    metadata: { emailSent: emailResult.sent },
  });

  return apiResponse(
    res,
    200,
    emailResult.sent ? "Activation code sent" : "Activation code generated; SMTP is not configured",
    sanitize(user),
    process.env.NODE_ENV === "production" ? null : { devActivationCode: activationCode, emailSent: emailResult.sent }
  );
});

export const updateUserRole = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError("User not found", 404);
  if (!validRoles.has(req.body.role)) throw new AppError("Invalid role selected", 400);
  if (String(user._id) === String(req.user?._id) && user.role === "super_admin" && req.body.role !== "super_admin") {
    throw new AppError("You cannot remove your own Super Admin role", 400);
  }

  const before = sanitize(user);
  user.role = req.body.role;
  user.updatedBy = req.user?._id;
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
  if (String(user._id) === String(req.user?._id)) {
    throw new AppError("You cannot delete your own account", 400);
  }

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

export const activateUserManually = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select("+emailVerificationCodeHash +emailVerificationExpiresAt");
  if (!user) throw new AppError("User not found", 404);

  const before = sanitize(user);
  user.isActive = true;
  user.isEmailVerified = true;
  user.emailVerificationCodeHash = undefined;
  user.emailVerificationExpiresAt = undefined;
  user.updatedBy = req.user?._id;
  await user.save();

  await logActivity({
    actorUser: req.user?._id,
    action: "manual_activate",
    entityType: "User",
    entityId: user._id,
    summary: `Manually activated user ${user.fullName}`,
    before,
    after: sanitize(user),
  });

  return apiResponse(res, 200, "User activated", sanitize(user));
});

export const resetUserPasswordManually = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select("+passwordHash +passwordResetCodeHash +passwordResetExpiresAt");
  if (!user) throw new AppError("User not found", 404);

  const password = String(req.body.password || "");
  if (password.length < 6) throw new AppError("Password must be at least 6 characters", 400);

  user.passwordHash = await bcrypt.hash(password, 12);
  user.passwordResetCodeHash = undefined;
  user.passwordResetExpiresAt = undefined;
  user.updatedBy = req.user?._id;
  await user.save();

  await logActivity({
    actorUser: req.user?._id,
    action: "manual_password_reset",
    entityType: "User",
    entityId: user._id,
    summary: `Manually reset password for ${user.fullName}`,
    metadata: { targetUser: user.email },
  });

  return apiResponse(res, 200, "User password reset", sanitize(user));
});
