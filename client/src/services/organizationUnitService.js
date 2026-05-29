import api from "./api";
import { createCrudService } from "./crudService";

const crud = createCrudService("/organization-units");

export const organizationUnitService = {
  ...crud,
  tree: (params) => api.get("/organization-units/tree", { params }),
  move: (id, payload) => api.patch(`/organization-units/${id}/move`, payload),
};
