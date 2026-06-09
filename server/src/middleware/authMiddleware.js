import jwt from "jsonwebtoken";
import AppError from "../utils/AppError.js";
import User from "../models/User.js";

export const protect = async (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new AppError("Not authorized, token missing", 401));
  }

  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id).select("-passwordHash");
    if (!user || !user.isActive) {
      return next(new AppError("User not found or inactive", 401));
    }

    req.user = user;
    next();
  } catch (error) {
    next(new AppError("Not authorized, token invalid", 401));
  }
};
