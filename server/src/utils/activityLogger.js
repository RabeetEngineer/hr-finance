import ActivityLog from "../models/ActivityLog.js";

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
        metadata,
      },
    ],
    session ? { session } : undefined
  );

  return log[0];
};

