import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import {
  employeeStatusOptions,
  employeeTypeOptions,
  genderOptions,
} from "@/constants/statusOptions";

const schema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  fatherName: z.string().optional(),
  cnic: z.string().min(5, "CNIC is required"),
  personnelNumber: z.string().min(1, "Personnel number is required"),
  designation: z.string().min(1, "Designation is required"),
  bps: z.string().optional(),
  gender: z.enum(["male", "female", "other"]),
  dateOfBirth: z.string().optional(),
  dateOfJoiningGovernmentService: z.string().optional(),
  dateOfJoiningCurrentDepartment: z.string().optional(),
  dateOfJoiningCurrentPost: z.string().optional(),
  currentOfficeSection: z.string().optional().nullable(),
  currentWing: z.string().optional().nullable(),
  currentSeat: z.string().optional().nullable(),
  district: z.string().optional(),
  domicile: z.string().optional(),
  mobileNumber: z.string().optional(),
  whatsappNumber: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  qualification: z.string().optional(),
  employeeType: z.enum([
    "officer",
    "official",
    "contract",
    "daily_wage",
    "consultant",
  ]),
  employmentStatus: z.enum([
    "active",
    "vacant",
    "transferred",
    "retired",
    "deceased",
    "resigned",
    "suspended",
    "on_leave",
  ]),
  profilePhoto: z.string().optional(),
  remarks: z.string().optional(),
  isArchived: z.coerce.boolean().optional(),
});

const emptyDocument = () => ({
  title: "",
  fileName: "",
  fileUrl: "",
  fileType: "",
});

const Section = ({ title, children, hint }) => (
  <div className="rounded-3xl border border-border bg-surface/80 p-5">
    <div className="mb-5">
      <h3 className="text-lg font-bold text-foreground">{title}</h3>
      {hint ? (
        <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
      ) : null}
    </div>
    {children}
  </div>
);

const Input = React.forwardRef(
  ({ label, error, className = "", ...props }, ref) => {
    return (
      <div>
        <label className="label-shell">{label}</label>
        <input
          ref={ref}
          className={`input-shell ${className}`.trim()}
          {...props}
        />
        {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
      </div>
    );
  },
);
Input.displayName = "Input";

const Select = React.forwardRef(
  ({ label, children, options, error, className = "", ...props }, ref) => {
    const optionNodes =
      children ||
      (Array.isArray(options)
        ? options.map((option) => {
            const value = option?.value ?? option?.id ?? option;
            const labelText = option?.label ?? option?.name ?? value;
            return (
              <option key={String(value)} value={value}>
                {labelText}
              </option>
            );
          })
        : null);

    return (
      <div>
        <label className="label-shell">{label}</label>
        <select
          ref={ref}
          className={`input-shell ${className}`.trim()}
          {...props}
        >
          {optionNodes}
        </select>
        {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
      </div>
    );
  },
);
Select.displayName = "Select";

const TextArea = React.forwardRef(
  ({ label, className = "", ...props }, ref) => {
    return (
      <div>
        <label className="label-shell">{label}</label>
        <textarea
          ref={ref}
          className={`input-shell min-h-28 ${className}`.trim()}
          {...props}
        />
      </div>
    );
  },
);
TextArea.displayName = "TextArea";

const EmployeeForm = ({
  defaultValues,
  onSubmit,
  submitLabel = "Save Employee",
  designationOptions = [],
  wingOptions = [],
  officeOptions = [],
  seatOptions = [],
}) => {
  const [step, setStep] = useState(0);
  const [documents, setDocuments] = useState([emptyDocument()]);

  const {
    register,
    handleSubmit,
    trigger,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: defaultValues || {
      fullName: "",
      fatherName: "",
      cnic: "",
      personnelNumber: "",
      designation: "",
      bps: "",
      gender: "male",
      dateOfBirth: "",
      dateOfJoiningGovernmentService: "",
      dateOfJoiningCurrentDepartment: "",
      dateOfJoiningCurrentPost: "",
      currentOfficeSection: "",
      currentWing: "",
      currentSeat: "",
      district: "",
      domicile: "",
      mobileNumber: "",
      whatsappNumber: "",
      email: "",
      address: "",
      qualification: "",
      employeeType: "official",
      employmentStatus: "active",
      profilePhoto: "",
      remarks: "",
      isArchived: false,
    },
  });

  useEffect(() => {
    if (defaultValues) {
      reset(defaultValues);
      setDocuments(
        defaultValues.attachments?.length
          ? defaultValues.attachments
          : [emptyDocument()],
      );
    }
  }, [defaultValues, reset]);

  const steps = useMemo(
    () => [
      {
        label: "Personal",
        fields: [
          "fullName",
          "fatherName",
          "cnic",
          "personnelNumber",
          "gender",
          "dateOfBirth",
          "district",
          "domicile",
          "profilePhoto",
        ],
      },
      {
        label: "Service",
        fields: [
          "designation",
          "bps",
          "employeeType",
          "employmentStatus",
          "currentWing",
          "currentOfficeSection",
          "currentSeat",
          "dateOfJoiningGovernmentService",
          "dateOfJoiningCurrentDepartment",
          "dateOfJoiningCurrentPost",
        ],
      },
      {
        label: "Contact & Documents",
        fields: [
          "mobileNumber",
          "whatsappNumber",
          "email",
          "address",
          "qualification",
          "remarks",
        ],
      },
    ],
    [],
  );

  const goNext = async () => {
    const valid = await trigger(steps[step].fields);
    if (valid) setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const goBack = () => setStep((current) => Math.max(current - 1, 0));

  const updateDocument = (index, field, value) => {
    setDocuments((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  };

  const addDocument = () =>
    setDocuments((current) => [...current, emptyDocument()]);
  const removeDocument = (index) =>
    setDocuments((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );

  const submit = async (values) => {
    const attachments = documents
      .filter((item) => item.title || item.fileName || item.fileUrl)
      .map((item) => ({
        title: item.title || item.fileName || "Document",
        fileName: item.fileName || item.title || "Document",
        fileUrl: item.fileUrl || "",
        fileType: item.fileType || "",
      }));

    const payload = {
      ...values,
      currentSeat: values.currentSeat || null,
      currentWing: values.currentWing || null,
      currentOfficeSection: values.currentOfficeSection || null,
      attachments,
    };

    await onSubmit(payload);
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit(submit)}>
      <div className="card-surface p-4">
        <div className="flex flex-wrap items-center gap-3">
          {steps.map((item, index) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setStep(index)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                index === step
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground/70"
              }`}
            >
              {index + 1}. {item.label}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -18 }}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          {step === 0 ? (
            <Section
              title="Employee Identity"
              hint="Core personal and identification details"
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Input
                  label="Full Name"
                  placeholder="Muhammad Ali"
                  {...register("fullName")}
                  error={errors.fullName?.message}
                />
                <Input
                  label="Father Name"
                  placeholder="Abdul Karim"
                  {...register("fatherName")}
                />
                <Input
                  label="CNIC"
                  placeholder="35101-1234567-1"
                  {...register("cnic")}
                  error={errors.cnic?.message}
                />
                <Input
                  label="Personnel Number"
                  placeholder="PN-1234"
                  {...register("personnelNumber")}
                  error={errors.personnelNumber?.message}
                />
                <Select
                  label="Gender"
                  {...register("gender")}
                  error={errors.gender?.message}
                >
                  {genderOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <Input
                  label="Date of Birth"
                  type="date"
                  {...register("dateOfBirth")}
                />
                <Input
                  label="District"
                  placeholder="Lahore"
                  {...register("district")}
                />
                <Input
                  label="Domicile"
                  placeholder="Punjab"
                  {...register("domicile")}
                />
                <Input
                  label="Profile Photo URL"
                  placeholder="https://..."
                  {...register("profilePhoto")}
                />
              </div>
            </Section>
          ) : null}

          {step === 1 ? (
            <Section
              title="Service Posting"
              hint="Current service, posting, and payroll context"
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Select
                  label="Designation"
                  {...register("designation")}
                  error={errors.designation?.message}
                >
                  <option value="">Select designation</option>
                  {designationOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <Input
                  label="BPS / Grade"
                  placeholder="17"
                  {...register("bps")}
                />
                <Select label="Employee Type" {...register("employeeType")}>
                  {employeeTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Incumbency Action"
                  {...register("employmentStatus")}
                >
                  {employeeStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <Select label="Wing (Optional)" {...register("currentWing")}>
                  <option value="">No wing</option>
                  {wingOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Organization Unit"
                  {...register("currentOfficeSection")}
                >
                  <option value="">Select organization unit</option>
                  {officeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <Select label="Current Seat" {...register("currentSeat")}>
                  <option value="">No seat assigned</option>
                  {seatOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <Input
                  label="Join Govt Service"
                  type="date"
                  {...register("dateOfJoiningGovernmentService")}
                />
                <Input
                  label="Join Current Dept."
                  type="date"
                  {...register("dateOfJoiningCurrentDepartment")}
                />
                <Input
                  label="Join Current Post"
                  type="date"
                  {...register("dateOfJoiningCurrentPost")}
                />
              </div>
            </Section>
          ) : null}

          {step === 2 ? (
            <Section
              title="Contact and Records"
              hint="Communication details, remarks, and supporting documents"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Mobile Number"
                  placeholder="0300-1234567"
                  {...register("mobileNumber")}
                />
                <Input
                  label="WhatsApp Number"
                  placeholder="0300-1234567"
                  {...register("whatsappNumber")}
                />
                <Input
                  label="Email"
                  placeholder="name@punjab.gov.pk"
                  {...register("email")}
                  error={errors.email?.message}
                />
                <Input
                  label="Qualification"
                  placeholder="MSc Economics"
                  {...register("qualification")}
                />
              </div>
              <div className="mt-4">
                <TextArea label="Address" {...register("address")} />
              </div>
              <div className="mt-4">
                <TextArea
                  label="Remarks / Notes"
                  placeholder="Enter leave, training, look-after arrangement, additional charge, temporary attachment, or any other administrative note..."
                  {...register("remarks")}
                />
              </div>

              <div className="mt-6 rounded-3xl border border-border bg-surface-2/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-base font-bold">Documents</h4>
                    <p className="text-sm text-muted-foreground">
                      Add supporting files and record titles for easy reference.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={addDocument}
                  >
                    Add document
                  </button>
                </div>

                <div className="mt-4 space-y-4">
                  {documents.map((document, index) => (
                    <div
                      key={index}
                      className="rounded-2xl border border-border bg-surface p-4"
                    >
                      <div className="grid gap-4 md:grid-cols-2">
                        <Input
                          label="Title"
                          value={document.title}
                          onChange={(event) =>
                            updateDocument(index, "title", event.target.value)
                          }
                          placeholder="CNIC Copy"
                        />
                        <Input
                          label="File Name"
                          value={document.fileName}
                          onChange={(event) =>
                            updateDocument(
                              index,
                              "fileName",
                              event.target.value,
                            )
                          }
                          placeholder="cnic-copy.pdf"
                        />
                        <Input
                          label="File URL"
                          value={document.fileUrl}
                          onChange={(event) =>
                            updateDocument(index, "fileUrl", event.target.value)
                          }
                          placeholder="https://..."
                        />
                        <Input
                          label="File Type"
                          value={document.fileType}
                          onChange={(event) =>
                            updateDocument(
                              index,
                              "fileType",
                              event.target.value,
                            )
                          }
                          placeholder="PDF"
                        />
                      </div>
                      {documents.length > 1 ? (
                        <div className="mt-4 flex justify-end">
                          <button
                            type="button"
                            className="btn-ghost text-danger"
                            onClick={() => removeDocument(index)}
                          >
                            Remove
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </Section>
          ) : null}
        </motion.div>
      </AnimatePresence>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          className="btn-secondary"
          onClick={goBack}
          disabled={step === 0}
        >
          Previous
        </button>
        <div className="flex items-center gap-3">
          {step < steps.length - 1 ? (
            <button type="button" className="btn-primary" onClick={goNext}>
              Next
            </button>
          ) : null}
          {step === steps.length - 1 ? (
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : submitLabel}
            </button>
          ) : null}
        </div>
      </div>
    </form>
  );
};

export default EmployeeForm;
