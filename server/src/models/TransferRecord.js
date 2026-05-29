import mongoose from "mongoose";

const transferRecordSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    fromWing: { type: mongoose.Schema.Types.ObjectId, ref: "Wing" },
    fromOfficeSection: { type: mongoose.Schema.Types.ObjectId, ref: "OfficeSection" },
    fromSeat: { type: mongoose.Schema.Types.ObjectId, ref: "Seat" },
    toWing: { type: mongoose.Schema.Types.ObjectId, ref: "Wing" },
    toOfficeSection: { type: mongoose.Schema.Types.ObjectId, ref: "OfficeSection" },
    toSeat: { type: mongoose.Schema.Types.ObjectId, ref: "Seat" },
    transferDate: { type: Date, required: true },
    orderNumber: { type: String, trim: true },
    remarks: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, versionKey: false }
);

transferRecordSchema.index({ employee: 1, transferDate: -1 });

export default mongoose.model("TransferRecord", transferRecordSchema);

