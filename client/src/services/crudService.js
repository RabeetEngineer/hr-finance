import api from "./api";

export const createCrudService = (resourcePath) => ({
  list: (params) => api.get(resourcePath, { params }),
  get: (id) => api.get(`${resourcePath}/${id}`),
  create: (payload) => api.post(resourcePath, payload),
  update: (id, payload) => api.put(`${resourcePath}/${id}`, payload),
  remove: (id) => api.delete(`${resourcePath}/${id}`),
});

