import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import connectDB from "./config/db.js";
import { errorHandler, notFound } from "./middleware/errorMiddleware.js";
import { sanitizeRequest } from "./middleware/sanitizeMiddleware.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import employeeRoutes from "./routes/employeeRoutes.js";
import wingRoutes from "./routes/wingRoutes.js";
import officeRoutes from "./routes/officeRoutes.js";
import organizationUnitRoutes from "./routes/organizationUnitRoutes.js";
import designationRoutes from "./routes/designationRoutes.js";
import seatRoutes from "./routes/seatRoutes.js";
import transferRoutes from "./routes/transferRoutes.js";
import leaveRoutes from "./routes/leaveRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import additionalChargeRoutes from "./routes/additionalChargeRoutes.js";
import activityLogRoutes from "./routes/activityLogRoutes.js";
import importRoutes from "./routes/importRoutes.js";

const app = express();
const port = process.env.PORT || 5000;
const allowedOrigins = (process.env.CLIENT_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length
      ? (origin, callback) => {
          if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
          return callback(new Error("Not allowed by CORS"));
        }
      : true,
    credentials: false,
  })
);
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(sanitizeRequest);
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/api/v1/health", (_req, res) => {
  res.json({ success: true, message: "API is healthy" });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/employees", employeeRoutes);
app.use("/api/v1/wings", wingRoutes);
app.use("/api/v1/organization-units", organizationUnitRoutes);
app.use("/api/v1/offices", officeRoutes);
app.use("/api/v1/designations", designationRoutes);
app.use("/api/v1/seats", seatRoutes);
app.use("/api/v1/transfers", transferRoutes);
app.use("/api/v1/leaves", leaveRoutes);
app.use("/api/v1/additional-charges", additionalChargeRoutes);
app.use("/api/v1/activity-logs", activityLogRoutes);
app.use("/api/v1/reports", reportRoutes);
app.use("/api/v1/import", importRoutes);

app.use(notFound);
app.use(errorHandler);

const start = async () => {
  await connectDB();
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
};

start().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
