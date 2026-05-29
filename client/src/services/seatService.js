import api from "./api";
import { createCrudService } from "./crudService";

const crud = createCrudService("/seats");

export const seatService = {
  ...crud,
  vacant: (params) => api.get("/seats/vacant", { params }),
  assign: (id, payload) => api.patch(`/seats/${id}/assign`, payload),
  vacate: (id, payload = {}) => api.patch(`/seats/${id}/vacate`, payload),
  additionalCharge: (id, payload) => api.patch(`/seats/${id}/additional-charge`, payload),
};

