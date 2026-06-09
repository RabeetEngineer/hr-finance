const sanitizeValue = (value) => {
  if (!value || typeof value !== "object") return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(sanitizeValue);

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !key.startsWith("$"))
      .map(([key, child]) => [key.replaceAll(".", ""), sanitizeValue(child)])
  );
};

export const sanitizeRequest = (req, _res, next) => {
  req.body = sanitizeValue(req.body);
  req.query = sanitizeValue(req.query);
  req.params = sanitizeValue(req.params);
  next();
};
