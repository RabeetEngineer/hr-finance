import api from "./api";

export const importService = {
  previewIncumbency: (rawText) => api.post("/import/incumbency/preview", { rawText }),
  createMissingDesignations: (rawText) => api.post("/import/incumbency/create-missing-designations", { rawText }),
  commitIncumbency: (payload) => api.post("/import/incumbency/commit", payload),
};
