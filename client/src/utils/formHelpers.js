export const getEntityId = (value) => value?.id || value?._id || value || "";

export const toDateInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

export const toBooleanString = (value) => (value ? "true" : "false");
