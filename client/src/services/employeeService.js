import api from "./api";
import { createCrudService } from "./crudService";

const crud = createCrudService("/employees");

export const employeeService = {
  list: crud.list,
  get: crud.get,
  create: crud.create,
  update: crud.update,
  remove: crud.remove,
  updateStatus: (id, payload) => api.patch(`/employees/${id}/status`, payload),
};

