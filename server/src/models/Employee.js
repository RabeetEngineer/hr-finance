import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, required: true },
    fileName: { type: String, trim: true, required: true },
    fileUrl: { type: String, trim: true, required: true },
    fileType: { type: String, trim: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const employeeSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    fatherName: { type: String, trim: true },
    cnic: { type: String, unique: true, sparse: true, trim: true },
    personnelNumber: { type: String, unique: true, sparse: true, trim: true },
    designation: { type: mongoose.Schema.Types.ObjectId, ref: "Designation", required: true },
    bps: { type: String, trim: true },
    serviceCadre: { type: String, trim: true },
    isOfficeHead: { type: Boolean, default: false, index: true },
    gender: { type: String, enum: ["male", "female", "other"], default: "other" },
    sortOrder: { type: Number, default: 0, index: true },
    dateOfBirth: { type: Date },
    dateOfJoiningGovernmentService: { type: Date },
    dateOfJoiningCurrentDepartment: { type: Date },
    dateOfJoiningCurrentPost: { type: Date },
    transferredOutDate: { type: Date },
    transferredToDepartment: { type: String, trim: true },
    retirementDate: { type: Date },
    currentOfficeSection: { type: mongoose.Schema.Types.ObjectId, ref: "OfficeSection" },
    currentWing: { type: mongoose.Schema.Types.ObjectId, ref: "Wing" },
    currentSeat: { type: mongoose.Schema.Types.ObjectId, ref: "Seat", default: null },
    district: { type: String, trim: true },
    domicile: { type: String, trim: true },
    mobileNumber: { type: String, trim: true },
    whatsappNumber: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    qualification: { type: String, trim: true },
    employeeType: {
      type: String,
      enum: ["officer", "official", "contract", "daily_wage", "consultant"],
      default: "official",
    },
    staffCategory: {
      type: String,
      enum: ["senior_level", "mid_level", "technical_staff", "supporting_staff"],
      default: "mid_level",
    },
    employmentStatus: {
      type: String,
      enum: ["active", "transferred", "retired", "deceased", "resigned", "suspended", "on_leave"],
      default: "active",
      index: true,
    },
    profilePhoto: { type: String, trim: true },
    remarks: { type: String, trim: true },
    attachments: { type: [documentSchema], default: [] },
    isArchived: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, versionKey: false }
);

employeeSchema.index({
  fullName: "text",
  fatherName: "text",
  cnic: "text",
  personnelNumber: "text",
  serviceCadre: "text",
  mobileNumber: "text",
  email: "text",
  district: "text",
});

export default mongoose.model("Employee", employeeSchema);
