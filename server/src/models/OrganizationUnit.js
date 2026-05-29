import mongoose from "mongoose";

const organizationUnitSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, sparse: true },
    type: {
      type: String,
      enum: ["department", "office", "wing", "branch", "section", "cell", "unit", "other"],
      default: "other",
      index: true,
    },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: "OrganizationUnit", default: null, index: true },
    parentOfficeSection: { type: mongoose.Schema.Types.ObjectId, ref: "OrganizationUnit", default: null },
    ancestors: [{ type: mongoose.Schema.Types.ObjectId, ref: "OrganizationUnit" }],
    level: { type: Number, default: 0, index: true },
    path: { type: String, default: "", trim: true, index: true },
    sortOrder: { type: Number, default: 0, index: true },
    displayOrder: { type: Number, default: 0 },
    headDesignation: { type: String, trim: true },
    description: { type: String, trim: true },
    wing: { type: mongoose.Schema.Types.ObjectId, ref: "Wing", default: null },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

organizationUnitSchema.index({ name: 1, code: 1, type: 1, parent: 1 });

organizationUnitSchema.pre("save", function syncCompatibilityFields(next) {
  if (this.parent && !this.parentOfficeSection) {
    this.parentOfficeSection = this.parent;
  }

  if (this.parentOfficeSection && !this.parent) {
    this.parent = this.parentOfficeSection;
  }

  if (this.sortOrder === undefined || this.sortOrder === null) {
    this.sortOrder = Number(this.displayOrder || 0);
  }

  if (this.displayOrder === undefined || this.displayOrder === null) {
    this.displayOrder = Number(this.sortOrder || 0);
  }

  next();
});

const collectionName = "officesections";

const OrganizationUnit =
  mongoose.models.OrganizationUnit || mongoose.model("OrganizationUnit", organizationUnitSchema, collectionName);
const OfficeSection = mongoose.models.OfficeSection || mongoose.model("OfficeSection", organizationUnitSchema, collectionName);

export { OfficeSection };
export default OrganizationUnit;
