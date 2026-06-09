import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import User from "../models/User.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
});

const ADMIN_SEED = {
  fullName: "Super Admin",
  email: process.env.SUPER_ADMIN_EMAIL || "admin@finance.gov.pk",
  mobile: process.env.SUPER_ADMIN_MOBILE || "",
  password: process.env.SUPER_ADMIN_PASSWORD || "Admin123@",
  role: "super_admin",
};

const seedSuperAdmin = async () => {
  await connectDB();

  const passwordHash = await bcrypt.hash(ADMIN_SEED.password, 12);
  const email = ADMIN_SEED.email.toLowerCase();

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    existingUser.fullName = ADMIN_SEED.fullName;
    existingUser.mobile = ADMIN_SEED.mobile;
    existingUser.passwordHash = passwordHash;
    existingUser.role = ADMIN_SEED.role;
    existingUser.isActive = true;
    existingUser.isEmailVerified = true;
    await existingUser.save();
    console.log(`Updated Super Admin user: ${existingUser.email}`);
  } else {
    await User.create({
      fullName: ADMIN_SEED.fullName,
      email,
      mobile: ADMIN_SEED.mobile,
      passwordHash,
      role: ADMIN_SEED.role,
      isActive: true,
      isEmailVerified: true,
    });
    console.log(`Created Super Admin user: ${email}`);
  }

  await mongoose.disconnect();
};

seedSuperAdmin()
  .then(() => {
    console.log("Super Admin seed completed successfully.");
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("Super Admin seed failed:", error);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
