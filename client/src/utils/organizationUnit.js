export const getUnitId = (value) => value?.id || value?._id || value || null;

export const buildUnitLabel = (unit, { includeType = true } = {}) => {
  const path = unit?.path || unit?.name || "Unit";
  const code = unit?.code ? ` (${unit.code})` : "";
  const type = includeType && unit?.type ? ` - ${String(unit.type).replaceAll("_", " ")}` : "";
  return `${path}${code}${type}`;
};

export const flattenUnitTree = (nodes = [], depth = 0, result = []) => {
  nodes.forEach((node) => {
    result.push({
      ...node,
      depth,
    });
    if (Array.isArray(node.children) && node.children.length) {
      flattenUnitTree(node.children, depth + 1, result);
    }
  });
  return result;
};

export const filterTreeBySearch = (nodes = [], search = "", typeFilter = "") => {
  const text = search.trim().toLowerCase();

  const visit = (node) => {
    const selfMatches =
      !text ||
      [node.name, node.code, node.type, node.path, node.headDesignation]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(text));
    const typeMatches = !typeFilter || node.type === typeFilter;
    const childMatches = (node.children || []).map(visit).filter(Boolean);

    if (!selfMatches && !childMatches.length) return null;
    if (typeFilter && !typeMatches && !childMatches.length) return null;

    return {
      ...node,
      children: childMatches,
      expandedBySearch: Boolean(text),
      selfMatches,
      typeMatches,
    };
  };

  return nodes.map(visit).filter(Boolean);
};
