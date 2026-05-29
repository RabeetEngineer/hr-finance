export const toSelectOptions = (items = [], labelResolver, valueKey = "id") =>
  items
    .map((item) => {
      const value = item?.[valueKey] || item?._id || item?.id;
      const label =
        typeof labelResolver === "function"
          ? labelResolver(item)
          : item?.[labelResolver || "name"] || item?.fullName || item?.title || value;
      if (!value) return null;
      return { value: String(value), label: String(label) };
    })
    .filter(Boolean);

