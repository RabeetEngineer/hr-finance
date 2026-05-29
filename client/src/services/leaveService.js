import api from "./api";
import { createCrudService } from "./crudService";

const crud = createCrudService("/leaves");

export const leaveService = {
  ...crud,
  approve: (id, payload) => api.patch(`/leaves/${id}/approve`, payload),
};

