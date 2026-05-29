import api from "./api";

export const reportService = {
  dashboard: (params) => api.get("/reports/dashboard", { params }),
  incumbency: (params) => api.get("/reports/incumbency", { params }),
  vacantSeats: (params) => api.get("/reports/vacant-seats", { params }),
  additionalCharge: (params) => api.get("/reports/additional-charge", { params }),
  transfers: (params) => api.get("/reports/transfers", { params }),
  leaves: (params) => api.get("/reports/leaves", { params }),
  retirementsDue: (params) => api.get("/reports/retirements-due", { params }),
  summary: (dimension, params) => api.get(`/reports/summary/${dimension}`, { params }),
};

