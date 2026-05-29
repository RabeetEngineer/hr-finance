export const getUnitId = (value) => value?._id || value?.id || value || null;

export const getUnitParentId = (unit) =>
  getUnitId(unit?.parent || unit?.parentOfficeSection);

export const getUnitSortOrder = (unit) =>
  Number(unit?.sortOrder ?? unit?.displayOrder ?? 0);

export const getUnitType = (unit) => unit?.type || "other";

export const buildUnitPath = (parentPath, unitName) => {
  const base = String(parentPath || "").trim();
  const name = String(unitName || "").trim();
  if (!base) return name;
  if (!name) return base;
  return `${base} / ${name}`;
};

export const buildUnitLabel = (unit) => {
  const name = unit?.name || "Unit";
  const code = unit?.code ? ` (${unit.code})` : "";
  const type = unit?.type ? ` - ${unit.type.replaceAll("_", " ")}` : "";
  const path = unit?.path ? ` - ${unit.path}` : "";
  return `${name}${code}${type}${path}`;
};

export const normalizeUnitShape = (unit) => ({
  id: unit?._id || unit?.id,
  name: unit?.name || "",
  code: unit?.code || "",
  type: getUnitType(unit),
  parent: getUnitParentId(unit),
  parentOfficeSection: getUnitParentId(unit),
  ancestors: Array.isArray(unit?.ancestors) ? unit.ancestors : [],
  level: Number(unit?.level || 0),
  path: unit?.path || "",
  sortOrder: getUnitSortOrder(unit),
  displayOrder: getUnitSortOrder(unit),
  headDesignation: unit?.headDesignation || "",
  description: unit?.description || "",
  wing: getUnitId(unit?.wing),
  isActive: Boolean(unit?.isActive),
  employeeCount: Number(unit?.employeeCount || 0),
  seatCount: Number(unit?.seatCount || 0),
  directEmployeeCount: Number(unit?.directEmployeeCount || 0),
  directSeatCount: Number(unit?.directSeatCount || 0),
  children: Array.isArray(unit?.children) ? unit.children : [],
  createdAt: unit?.createdAt,
  updatedAt: unit?.updatedAt,
});

export const sortUnitsForTree = (units = []) =>
  [...units].sort((a, b) => {
    const sortDelta = getUnitSortOrder(a) - getUnitSortOrder(b);
    if (sortDelta !== 0) return sortDelta;
    return String(a?.name || "").localeCompare(String(b?.name || ""));
  });

export const stripUnitPayload = (payload = {}) => {
  const parent = getUnitId(payload.parent ?? payload.parentOfficeSection);
  const sortOrder =
    payload.sortOrder !== undefined &&
    payload.sortOrder !== null &&
    payload.sortOrder !== ""
      ? Number(payload.sortOrder)
      : payload.displayOrder !== undefined &&
          payload.displayOrder !== null &&
          payload.displayOrder !== ""
        ? Number(payload.displayOrder)
        : undefined;

  return {
    name: payload.name?.trim?.() || "",
    code: payload.code?.trim?.() || "",
    type: payload.type || "other",
    parent,
    parentOfficeSection: parent,
    ancestors: Array.isArray(payload.ancestors) ? payload.ancestors : [],
    level: Number(payload.level || 0),
    path: payload.path || "",
    sortOrder,
    displayOrder: sortOrder,
    headDesignation: payload.headDesignation || "",
    description: payload.description || "",
    wing: getUnitId(payload.wing),
    isActive:
      payload.isActive === undefined
        ? true
        : payload.isActive === true || payload.isActive === "true",
  };
};
