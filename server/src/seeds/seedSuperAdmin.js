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
  email: "admin@finance.gov.pk",
  password: "Admin123@",
  role: "super_admin",
};

const seedSuperAdmin = async () => {
  await connectDB();

  const passwordHash = await bcrypt.hash(ADMIN_SEED.password, 12);
  const email = ADMIN_SEED.email.toLowerCase();

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    existingUser.fullName = ADMIN_SEED.fullName;
    existingUser.passwordHash = passwordHash;
    existingUser.role = ADMIN_SEED.role;
    existingUser.isActive = true;
    await existingUser.save();
    console.log(`Updated Super Admin user: ${existingUser.email}`);
  } else {
    await User.create({
      fullName: ADMIN_SEED.fullName,
      email,
      passwordHash,
      role: ADMIN_SEED.role,
      isActive: true,
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

