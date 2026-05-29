import api from "./api";
import { createCrudService } from "./crudService";

export const userService = createCrudService("/users");

userService.updateStatus = (id, payload) => api.patch(`/users/${id}/status`, payload);
userService.updateRole = (id, payload) => api.patch(`/users/${id}/role`, payload);
