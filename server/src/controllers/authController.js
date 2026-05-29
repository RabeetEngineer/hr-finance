import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import ActivityLog from "../models/ActivityLog.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import AppError from "../utils/AppError.js";
import { apiResponse } from "../utils/apiResponse.js";

const signToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

const sanitizeUser = (user) => ({
  id: user._id,
  fullName: user.fullName,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  lastLoginAt: user.lastLoginAt,
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: String(email).toLowerCase() }).select("+passwordHash");
  if (!user || !user.isActive) {
    throw new AppError("Invalid credentials", 401);
  }

  const isValid = await bcrypt.compare(String(password || ""), user.passwordHash);
  if (!isValid) {
    throw new AppError("Invalid credentials", 401);
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

