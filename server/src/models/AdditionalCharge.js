import mongoose from "mongoose";

const additionalChargeSchema = new mongoose.Schema(
  {
    vacantSeat: { type: mongoose.Schema.Types.ObjectId, ref: "Seat", required: true },
    additionalChargeHolder: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    orderNumber: { type: String, trim: true },
    remarks: { type: String, trim: true },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    endedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    endedAt: { type: Date },
  },
  { timestamps: true, versionKey: false }
);

additionalChargeSchema.index({ vacantSeat: 1, isActive: 1, startDate: -1 });

export default mongoose.model("AdditionalCharge", additionalChargeSchema);

