import api from "./api";

export const loginRequest = (payload) => api.post("/auth/login", payload);
export const meRequest = () => api.get("/auth/me");
export const requestActivationCode = (payload) => api.post("/auth/activation/request", payload);
export const confirmActivationCode = (payload) => api.post("/auth/activation/confirm", payload);
export const forgotPasswordRequest = (payload) => api.post("/auth/forgot-password", payload);
export const resetPasswordRequest = (payload) => api.post("/auth/reset-password", payload);
