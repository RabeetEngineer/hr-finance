import ActivityLog from "../models/ActivityLog.js";

const summarizeChanges = (before, after) => {
  if (!before || !after || typeof before !== "object" || typeof after !== "object") return [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys]
    .filter((key) => JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null))
    .slice(0, 50);
};

export const logActivity = async ({
  actorUser = null,
  action,
  entityType,
  entityId = null,
  summary,
  before = null,
  after = null,
  metadata = {},
  session = null,
}) => {
  const log = await ActivityLog.create(
    [
      {
        actorUser,
        action,
        entityType,
        entityId,
        summary,
        before,
        after,
        metadata: {
          ...metadata,
          changedFields: summarizeChanges(before, after),
          recordedAt: new Date(),
        },
      },
    ],
    session ? { session } : undefined
  );

  return log[0];
};
