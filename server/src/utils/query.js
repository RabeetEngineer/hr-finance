export const escapeRegex = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const regexSearch = (value) => ({
  $regex: escapeRegex(value),
  $options: "i",
});

export const parsePagination = (query = {}) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 200);
  return { page, limit, skip: (page - 1) * limit };
};

export const applyDateRange = (query, field, from, to) => {
  if (!from && !to) return;
  query[field] = {};
  if (from) query[field].$gte = new Date(from);
  if (to) query[field].$lte = new Date(to);
};

export const parseSort = (sort, fallback = "-createdAt") => sort || fallback;

export const parseActiveFilter = (value) => {
  if (value === undefined || value === null || value === "" || value === "all") {
    return undefined;
  }

  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;

  return undefined;
};
