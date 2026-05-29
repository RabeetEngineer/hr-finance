import mongoose from "mongoose";

const designationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    bps: { type: String, trim: true },
    service: { type: String, trim: true },
    category: {
      type: String,
      enum: ["officer", "official", "support_staff"],
      required: true,
      default: "official",
    },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, versionKey: false }
);

designationSchema.index({ name: 1, bps: 1, service: 1, category: 1 });

export default mongoose.model("Designation", designationSchema);
