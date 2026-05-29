import api from "./api";
import { createCrudService } from "./crudService";

const crud = createCrudService("/additional-charges");

export const additionalChargeService = {
  ...crud,
  end: (id, payload) => api.patch(`/additional-charges/${id}/end`, payload),
};

