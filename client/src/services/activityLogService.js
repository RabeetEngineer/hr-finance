import { createCrudService } from "./crudService";
import api from "./api";

export const activityLogService = createCrudService("/activity-logs");
activityLogService.recent = (params) => api.get("/activity-logs/recent", { params });
