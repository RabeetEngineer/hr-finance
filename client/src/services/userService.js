import api from "./api";
import { createCrudService } from "./crudService";

export const userService = createCrudService("/users");

userService.updateStatus = (id, payload) => api.patch(`/users/${id}/status`, payload);
userService.updateRole = (id, payload) => api.patch(`/users/${id}/role`, payload);
userService.activate = (id) => api.patch(`/users/${id}/activate`);
userService.resetPassword = (id, payload) => api.post(`/users/${id}/reset-password`, payload);
userService.resendActivation = (id) => api.post(`/users/${id}/resend-activation`);
