import Employee from "../models/Employee.js";
import LeaveRecord from "../models/LeaveRecord.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { apiResponse } from "../utils/apiResponse.js";
import AppError from "../utils/AppError.js";
import { parsePagination, parseSort } from "../utils/query.js";
import { logActivity } from "../utils/activityLogger.js";

const shape = (leave) => ({
  id: leave._id,
  employee: leave.employee,
  leaveType: leave.leaveType,
  startDate: leave.startDate,
  endDate: leave.endDate,
  numberOfDays: leave.numberOfDays,
  reason: leave.reason,
  approvalStatus: leave.approvalStatus,
  remarks: leave.remarks,
  approvedBy: leave.approvedBy,
  approvedAt: leave.approvedAt,
  createdAt: leave.createdAt,
  updatedAt: leave.updatedAt,
});

export const listLeaves = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const query = {};
  if (req.query.employee) query.employee = req.query.employee;
  if (req.query.leaveType) query.leaveType = req.query.leaveType;
  if (req.query.approvalStatus) query.approvalStatus = req.query.approvalStatus;

  const [records, total] = await Promise.all([
    LeaveRecord.find(query)
      .populate("employee", "fullName personnelNumber cnic employmentStatus")
      .populate("approvedBy", "fullName email role")
      .sort(parseSort(req.query.sort, "-startDate"))
      .skip(skip)
      .limit(limit)
      .lean(),
    LeaveRecord.countDocuments(query),
  ]);

  return apiResponse(res, 200, "Leave records fetched", records.map(shape), {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit) || 1,
  });
});

export const createLeave = asyncHandler(async (req, res) => {
  const {
    employeeId,
    leaveType,
    startDate,
    endDate,
    numberOfDays,
    reason = "",
    approvalStatus = "pending",
    remarks = "",
  } = req.body;

  if (!employeeId || !leaveType || !startDate || !endDate || !numberOfDays) {
    throw new AppError("Employee, leave type, date range and number of days are required", 400);
  }

  const employee = await Employee.findById(employeeId);
  if (!employee) throw new AppError("Employee not found", 404);
  if (employee.isArchived) throw new AppError("Archived employees cannot be assigned leave", 400);

  const leave = await LeaveRecord.create({
    employee: employeeId,
    leaveType,
    startDate,
    endDate,
    numberOfDays,
    reason,
    approvalStatus,
    remarks,
    createdBy: req.user?._id,
  });

  if (approvalStatus === "approved") {
    employee.employmentStatus = "on_leave";
    await employee.save();
  }

  await logActivity({
    actorUser: req.user?._id,
    action: "create",
    entityType: "LeaveRecord",
    entityId: leave._id,
    summary: `Created leave record for employee ${employeeId}`,
    after: shape(leave),
  });

  return apiResponse(res, 201, "Leave record created", shape(leave));
});

export const getLeaveById = asyncHandler(async (req, res) => {
  const leave = await LeaveRecord.findById(req.params.id)
    .populate("employee", "fullName personnelNumber cnic employmentStatus")
    .populate("approvedBy", "fullName email role")
    .lean();
  if (!leave) throw new AppError("Leave record not found", 404);
  return apiResponse(res, 200, "Leave record fetched", shape(leave));
});

export const updateLeave = asyncHandler(async (req, res) => {
  const leave = await LeaveRecord.findById(req.params.id);
  if (!leave) throw new AppError("Leave record not found", 404);
  const before = shape(leave);

  Object.assign(leave, req.body);
  await leave.save();

  const employee = await Employee.findById(leave.employee);
  if (employee) {
    if (leave.approvalStatus === "approved") {
      employee.employmentStatus = "on_leave";
      await employee.save();
    } else if (employee.employmentStatus === "on_leave") {
      const approvedCount = await LeaveRecord.countDocuments({
        employee: leave.employee,
        approvalStatus: "approved",
        _id: { $ne: leave._id },
      });

      if (!approvedCount) {
        employee.employmentStatus = "active";
        await employee.save();
      }
    }
  }

  await logActivity({
    actorUser: req.user?._id,
    action: "update",
    entityType: "LeaveRecord",
    entityId: leave._id,
    summary: "Updated leave record",
    before,
    after: shape(leave),
  });

  return apiResponse(res, 200, "Leave record updated", shape(leave));
});

export const approveLeave = asyncHandler(async (req, res) => {
  const leave = await LeaveRecord.findById(req.params.id);
  if (!leave) throw new AppError("Leave record not found", 404);
  const before = shape(leave);

  leave.approvalStatus = req.body.approvalStatus || "approved";
  leave.approvedBy = req.user?._id;
  leave.approvedAt = new Date();
  await leave.save();

  const employee = await Employee.findById(leave.employee);
  if (employee) {
    if (leave.approvalStatus === "approved") {
      employee.employmentStatus = "on_leave";
      await employee.save();
    } else if (employee.employmentStatus === "on_leave") {
      const approvedCount = await LeaveRecord.countDocuments({
        employee: leave.employee,
        approvalStatus: "approved",
        _id: { $ne: leave._id },
      });

      if (!approvedCount) {
        employee.employmentStatus = "active";
        await employee.save();
      }
    }
  }

  await logActivity({
    actorUser: req.user?._id,
    action: "approve",
    entityType: "LeaveRecord",
    entityId: leave._id,
    summary: `Updated leave approval to ${leave.approvalStatus}`,
    before,
    after: shape(leave),
  });

  return apiResponse(res, 200, "Leave approval updated", shape(leave));
});
