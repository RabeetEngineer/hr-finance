import ActivityLog from "../models/ActivityLog.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { apiResponse } from "../utils/apiResponse.js";
import { parsePagination, parseSort, regexSearch } from "../utils/query.js";

const sanitize = (log) => ({
  id: log._id,
  actorUser: log.actorUser
    ? {
        id: log.actorUser._id,
        fullName: log.actorUser.fullName,
        email: log.actorUser.email,
        role: log.actorUser.role,
      }
    : null,
  action: log.action,
  entityType: log.entityType,
  entityId: log.entityId,
  summary: log.summary,
  metadata: log.metadata,
  createdAt: log.createdAt,
});

export const listActivityLogs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const query = {};

  if (req.query.q) {
    query.$or = [
      { action: regexSearch(req.query.q) },
      { entityType: regexSearch(req.query.q) },
      { summary: regexSearch(req.query.q) },
    ];
  }

  if (req.query.entityType) query.entityType = req.query.entityType;
  if (req.query.actorUser) query.actorUser = req.query.actorUser;

  const [logs, total] = await Promise.all([
    ActivityLog.find(query)
      .populate("actorUser", "fullName email role")
      .sort(parseSort(req.query.sort, "-createdAt"))
      .skip(skip)
      .limit(limit)
      .lean(),
    ActivityLog.countDocuments(query),
  ]);

  return apiResponse(
    res,
    200,
    "Activity logs fetched",
    logs.map(sanitize),
    { page, limit, total, pages: Math.ceil(total / limit) || 1 }
  );
});
