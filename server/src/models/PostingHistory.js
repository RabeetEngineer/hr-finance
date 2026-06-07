import mongoose from "mongoose";

const postingHistorySchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    actionType: {
      type: String,
      enum: ["appointed", "posted", "vacant", "transferred", "relieved", "retired", "deceased", "resigned", "suspended", "on_leave", "additional_charge"],
      required: true,
    },
    fromWing: { type: mongoose.Schema.Types.ObjectId, ref: "Wing", default: null },
    fromOfficeSection: { type: mongoose.Schema.Types.ObjectId, ref: "OfficeSection", default: null },
    fromSeat: { type: mongoose.Schema.Types.ObjectId, ref: "Seat", default: null },
    toWing: { type: mongoose.Schema.Types.ObjectId, ref: "Wing", default: null },
    toOfficeSection: { type: mongoose.Schema.Types.ObjectId, ref: "OfficeSection", default: null },
    toSeat: { type: mongoose.Schema.Types.ObjectId, ref: "Seat", default: null },
    effectiveDate: { type: Date, default: Date.now },
    orderNumber: { type: String, trim: true },
    remarks: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, versionKey: false }
);

postingHistorySchema.index({ employee: 1, effectiveDate: -1, actionType: 1 });

export default mongoose.model("PostingHistory", postingHistorySchema);
