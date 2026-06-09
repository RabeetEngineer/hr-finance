import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import ActivityLog from "../models/ActivityLog.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import AppError from "../utils/AppError.js";
import { apiResponse } from "../utils/apiResponse.js";
import { sendEmail } from "../utils/email.js";

const signToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

const codeTtlMinutes = Number(process.env.ACCOUNT_CODE_TTL_MINUTES || 15);

const generateCode = () => String(crypto.randomInt(100000, 1000000));
const hashCode = (code) => crypto.createHash("sha256").update(String(code)).digest("hex");
const codeExpiry = () => new Date(Date.now() + codeTtlMinutes * 60 * 1000);
const safeEmail = (value) => String(value || "").trim().toLowerCase();

const sanitizeUser = (user) => ({
  id: user._id,
  fullName: user.fullName,
  email: user.email,
  mobile: user.mobile || "",
  role: user.role,
  isActive: user.isActive,
  isEmailVerified: user.isEmailVerified,
  lastLoginAt: user.lastLoginAt,
});

const sendAccountCode = async ({ user, code, purpose }) => {
  const subject = purpose === "reset" ? "HR Finance password reset code" : "HR Finance account activation code";
  const text = `Dear ${user.fullName},\n\nYour ${purpose === "reset" ? "password reset" : "account activation"} code is ${code}. It expires in ${codeTtlMinutes} minutes.\n\nIf you did not request this, please contact the system administrator.`;

  const emailResult = await sendEmail({
    to: user.email,
    subject,
    text,
    html: `<p>Dear ${user.fullName},</p><p>Your ${purpose === "reset" ? "password reset" : "account activation"} code is <strong>${code}</strong>.</p><p>It expires in ${codeTtlMinutes} minutes.</p>`,
  });

  return emailResult;
};

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: safeEmail(email) }).select("+passwordHash +emailVerificationCodeHash");
  if (!user || !user.isActive) {
    throw new AppError("Invalid credentials", 401);
  }
  if (!user.isEmailVerified && user.emailVerificationCodeHash) {
    throw new AppError("Account email is not verified. Please activate your account first.", 403);
  }

  const isValid = await bcrypt.compare(String(password || ""), user.passwordHash);
  if (!isValid) {
    throw new AppError("Invalid credentials", 401);
  }

  if (!user.isEmailVerified) {
    user.isEmailVerified = true;
  }
  user.lastLoginAt = new Date();
  await user.save();

  const token = signToken(user._id);

  await ActivityLog.create({
    actorUser: user._id,
    action: "login",
    entityType: "User",
    entityId: user._id,
    summary: `${user.fullName} logged in`,
    metadata: { email: user.email },
  });

  return apiResponse(res, 200, "Login successful", {
    user: sanitizeUser(user),
    token,
  });
});

export const getMe = asyncHandler(async (req, res) => {
  return apiResponse(res, 200, "Current user fetched", sanitizeUser(req.user));
});

export const requestActivationCode = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: safeEmail(req.body.email) }).select(
    "+emailVerificationCodeHash +emailVerificationExpiresAt"
  );

  if (!user) {
    return apiResponse(res, 200, "If the account exists, an activation code has been sent");
  }
  if (!user.isActive) throw new AppError("Account is not approved yet. Please contact the super admin.", 403);
  if (user.isEmailVerified) return apiResponse(res, 200, "Account is already activated");

  const code = generateCode();
  user.emailVerificationCodeHash = hashCode(code);
  user.emailVerificationExpiresAt = codeExpiry();
  await user.save();

  const emailResult = await sendAccountCode({ user, code, purpose: "activation" });
  await ActivityLog.create({
    actorUser: user._id,
    action: "activation_code",
    entityType: "User",
    entityId: user._id,
    summary: `Activation code requested for ${user.email}`,
    metadata: { emailSent: emailResult.sent },
  });

  return apiResponse(
    res,
    200,
    emailResult.sent ? "Activation code sent to email" : "Activation code generated; SMTP is not configured",
    null,
    process.env.NODE_ENV === "production" ? null : { devCode: code, emailSent: emailResult.sent }
  );
});

export const activateAccount = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: safeEmail(req.body.email) }).select(
    "+emailVerificationCodeHash +emailVerificationExpiresAt"
  );
  if (!user) throw new AppError("Invalid or expired activation code", 400);
  if (!user.isActive) throw new AppError("Account is not approved yet. Please contact the super admin.", 403);
  if (user.isEmailVerified) return apiResponse(res, 200, "Account is already activated", sanitizeUser(user));

  const code = String(req.body.code || "").trim();
  if (!code || hashCode(code) !== user.emailVerificationCodeHash || user.emailVerificationExpiresAt < new Date()) {
    throw new AppError("Invalid or expired activation code", 400);
  }

  user.isEmailVerified = true;
  user.emailVerificationCodeHash = undefined;
  user.emailVerificationExpiresAt = undefined;
  await user.save();

  await ActivityLog.create({
    actorUser: user._id,
    action: "activate",
    entityType: "User",
    entityId: user._id,
    summary: `${user.fullName} activated account`,
    metadata: { email: user.email },
  });

  return apiResponse(res, 200, "Account activated", sanitizeUser(user));
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: safeEmail(req.body.email) }).select(
    "+passwordResetCodeHash +passwordResetExpiresAt"
  );

  if (!user) {
    return apiResponse(res, 200, "If the account exists, a password reset code has been sent");
  }
  if (!user.isActive) throw new AppError("Account is not approved yet. Please contact the super admin.", 403);
  if (!user.isEmailVerified) throw new AppError("Please activate your account before resetting password.", 403);

  const code = generateCode();
  user.passwordResetCodeHash = hashCode(code);
  user.passwordResetExpiresAt = codeExpiry();
  await user.save();

  const emailResult = await sendAccountCode({ user, code, purpose: "reset" });
  await ActivityLog.create({
    actorUser: user._id,
    action: "password_reset_code",
    entityType: "User",
    entityId: user._id,
    summary: `Password reset code requested for ${user.email}`,
    metadata: { emailSent: emailResult.sent },
  });

  return apiResponse(
    res,
    200,
    emailResult.sent ? "Password reset code sent to email" : "Password reset code generated; SMTP is not configured",
    null,
    process.env.NODE_ENV === "production" ? null : { devCode: code, emailSent: emailResult.sent }
  );
});

export const resetPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: safeEmail(req.body.email) }).select(
    "+passwordHash +passwordResetCodeHash +passwordResetExpiresAt"
  );
  if (!user) throw new AppError("Invalid or expired password reset code", 400);

  const code = String(req.body.code || "").trim();
  const password = String(req.body.password || "");
  if (password.length < 6) throw new AppError("Password must be at least 6 characters", 400);
  if (!code || hashCode(code) !== user.passwordResetCodeHash || user.passwordResetExpiresAt < new Date()) {
    throw new AppError("Invalid or expired password reset code", 400);
  }

  user.passwordHash = await bcrypt.hash(password, 12);
  user.passwordResetCodeHash = undefined;
  user.passwordResetExpiresAt = undefined;
  await user.save();

  await ActivityLog.create({
    actorUser: user._id,
    action: "password_reset",
    entityType: "User",
    entityId: user._id,
    summary: `${user.fullName} reset password`,
    metadata: { email: user.email },
  });

  return apiResponse(res, 200, "Password reset successful");
});
