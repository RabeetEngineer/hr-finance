import api from "./api";

export const importService = {
  previewIncumbency: (rawText, columnMapping) => api.post("/import/incumbency/preview", { rawText, columnMapping }),
  createMissingDesignations: (rawText, columnMapping) => api.post("/import/incumbency/create-missing-designations", { rawText, columnMapping }),
  commitIncumbency: (payload) => api.post("/import/incumbency/commit", payload),
};
