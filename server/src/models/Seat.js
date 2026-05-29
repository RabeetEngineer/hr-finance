import mongoose from "mongoose";

const seatSchema = new mongoose.Schema(
  {
    seatTitle: { type: String, required: true, trim: true },
    seatCode: { type: String, trim: true, sparse: true },
    designation: { type: mongoose.Schema.Types.ObjectId, ref: "Designation", required: true },
    officeSection: { type: mongoose.Schema.Types.ObjectId, ref: "OfficeSection", required: true },
    wing: { type: mongoose.Schema.Types.ObjectId, ref: "Wing", required: true },
    bps: { type: String, trim: true },
    seatStatus: {
      type: String,
      enum: ["occupied", "vacant", "additional_charge", "frozen"],
      default: "vacant",
      index: true,
    },
    currentEmployee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
    additionalChargeHolder: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
    remarks: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, versionKey: false }
);

seatSchema.index({ seatTitle: 1, officeSection: 1, wing: 1, seatStatus: 1 });

export default mongoose.model("Seat", seatSchema);

