import api from "./api";

export const loginRequest = (payload) => api.post("/auth/login", payload);
export const meRequest = () => api.get("/auth/me");

