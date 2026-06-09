import OrganizationUnit from "../models/OrganizationUnit.js";
import Employee from "../models/Employee.js";
import Seat from "../models/Seat.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { apiResponse } from "../utils/apiResponse.js";
import AppError from "../utils/AppError.js";
import { parsePagination, regexSearch, parseSort, parseActiveFilter } from "../utils/query.js";
import { logActivity } from "../utils/activityLogger.js";
import {
  buildUnitPath,
  getUnitId,
  getUnitParentId,
  getUnitSortOrder,
  getUnitType,
  normalizeUnitShape,
  sortUnitsForTree,
  stripUnitPayload,
} from "../utils/organizationUnit.js";

const unitScopeQuery = (query = {}) => {
  const scoped = {};

  if (query.q) {
    scoped.$or = [
      { name: regexSearch(query.q) },
      { code: regexSearch(query.q) },
      { path: regexSearch(query.q) },
      { headDesignation: regexSearch(query.q) },
    ];
  }

  if (query.type) scoped.type = query.type;
  if (query.parent) scoped.parent = query.parent;
  if (query.parentOfficeSection) scoped.parent = query.parentOfficeSection;
  if (query.wing) scoped.wing = query.wing;

  const isActive = query.isActive === undefined ? true : parseActiveFilter(query.isActive);
  if (isActive !== undefined) scoped.isActive = isActive;

  return scoped;
};

const buildFlatTree = (units, directEmployeeCounts = new Map(), directSeatCounts = new Map()) => {
  const map = new Map();
  const roots = [];

  units.forEach((unit) => {
    const id = String(unit._id);
    map.set(id, {
      ...normalizeUnitShape(unit),
      directEmployeeCount: directEmployeeCounts.get(id) || 0,
      directSeatCount: directSeatCounts.get(id) || 0,
      employeeCount: directEmployeeCounts.get(id) || 0,
      seatCount: directSeatCounts.get(id) || 0,
      children: [],
    });
  });

  units.forEach((unit) => {
    const id = String(unit._id);
    const node = map.get(id);
    const parentId = getUnitParentId(unit);
    if (parentId && map.has(String(parentId))) {
      map.get(String(parentId)).children.push(node);
    } else {
      roots.push(node);
    }
  });

  const attachTotals = (node) => {
    node.children = sortUnitsForTree(node.children).map(attachTotals);
    node.employeeCount = node.directEmployeeCount + node.children.reduce((sum, child) => sum + child.employeeCount, 0);
    node.seatCount = node.directSeatCount + node.children.reduce((sum, child) => sum + child.seatCount, 0);
    return node;
  };

  return sortUnitsForTree(roots).map(attachTotals);
};

const getDirectCounts = async () => {
  const [employeeCounts, seatCounts] = await Promise.all([
    Employee.aggregate([
      { $match: { isArchived: { $ne: true } } },
      { $group: { _id: "$currentOfficeSection", count: { $sum: 1 } } },
    ]),
    Seat.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$officeSection", count: { $sum: 1 } } },
    ]),
  ]);

  const employeeMap = new Map(
    employeeCounts.filter((item) => item._id).map((item) => [String(item._id), Number(item.count || 0)])
  );
  const seatMap = new Map(seatCounts.filter((item) => item._id).map((item) => [String(item._id), Number(item.count || 0)]));

  return { employeeMap, seatMap };
};

const findUnitById = async (id, session = null) => {
  const query = OrganizationUnit.findById(id);
  if (session) query.session(session);
  return query;
};

const getSiblingMaxSortOrder = async (parentId, excludeId = null, session = null) => {
  const query = {
    $or: [{ parent: parentId }, { parentOfficeSection: parentId }],
  };
  if (!parentId) {
    query.$or = [{ parent: null }, { parentOfficeSection: null }];
  }
  if (excludeId) query._id = { $ne: excludeId };

  const sibling = OrganizationUnit.find(query).sort({ sortOrder: -1, displayOrder: -1, name: 1 }).limit(1).lean();
  if (session) sibling.session(session);
  const result = await sibling;
  return result[0] ? getUnitSortOrder(result[0]) : -1;
};

const syncBranchHierarchy = async (unitDoc, session = null) => {
  const parentId = getUnitParentId(unitDoc);
  const parentDoc = parentId ? await findUnitById(parentId, session) : null;
  const parentAncestors = parentDoc?.ancestors || [];
  unitDoc.parent = parentId;
  unitDoc.parentOfficeSection = parentId;
  unitDoc.ancestors = parentDoc ? [...parentAncestors, parentDoc._id] : [];
  unitDoc.level = parentDoc ? Number(parentDoc.level || 0) + 1 : 0;
  unitDoc.path = buildUnitPath(parentDoc?.path || parentDoc?.name || "", unitDoc.name);
  if (!unitDoc.type) {
    unitDoc.type = parentDoc ? "section" : "office";
  }
  unitDoc.sortOrder = Number(unitDoc.sortOrder ?? unitDoc.displayOrder ?? 0);
  unitDoc.displayOrder = unitDoc.sortOrder;
  if (session) {
    await unitDoc.save({ session });
  } else {
    await unitDoc.save();
  }

  const children = await OrganizationUnit.find({
    $or: [{ parent: unitDoc._id }, { parentOfficeSection: unitDoc._id }],
  }).sort({ sortOrder: 1, displayOrder: 1, name: 1 });
  if (session) {
    children.forEach((child) => child.$session(session));
  }

  for (const child of children) {
    await syncBranchHierarchy(child, session);
  }

  return unitDoc;
};

const collectDescendantIds = async (rootId, session = null) => {
  const query = OrganizationUnit.find({}, "_id parent parentOfficeSection").lean();
  if (session) query.session(session);
  const units = await query;
  const byParent = new Map();

  units.forEach((unit) => {
    const parentId = getUnitParentId(unit);
    const key = parentId ? String(parentId) : "";
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(unit);
  });

  const descendants = new Set();
  const visit = (parentId) => {
    const children = byParent.get(String(parentId)) || [];
    children.forEach((child) => {
      const childId = String(child._id);
      if (descendants.has(childId)) return;
      descendants.add(childId);
      visit(childId);
    });
  };

  visit(rootId);
  return descendants;
};

const validateParentChoice = async (unitId, parentId, session = null) => {
  if (!parentId) return null;

  if (String(parentId) === String(unitId)) {
    throw new AppError("A unit cannot be its own parent", 400);
  }

  const descendants = await collectDescendantIds(unitId, session);
  if (descendants.has(String(parentId))) {
    throw new AppError("A unit cannot be moved under one of its descendants", 400);
  }

  const parent = await findUnitById(parentId, session);
  if (!parent) throw new AppError("Parent unit not found", 404);
  if (!parent.isActive) throw new AppError("Parent unit is inactive", 400);
  return parent;
};

const shapeUnit = (unit) => normalizeUnitShape(unit);
const unitListSelect =
  "name code type parent parentOfficeSection ancestors level path sortOrder displayOrder headDesignation description wing isActive createdAt updatedAt";

export const listOrganizationUnits = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const query = unitScopeQuery(req.query);

  const [units, total] = await Promise.all([
    OrganizationUnit.find(query)
      .select(unitListSelect)
      .sort(parseSort(req.query.sort, "sortOrder name"))
      .skip(skip)
      .limit(limit)
      .lean(),
    OrganizationUnit.countDocuments(query),
  ]);

  return apiResponse(res, 200, "Organization units fetched", units.map(shapeUnit), {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit) || 1,
  });
});

export const listOrganizationUnitTree = asyncHandler(async (req, res) => {
  const query = unitScopeQuery(req.query);
  delete query.$or;
  const units = await OrganizationUnit.find(query)
    .select(unitListSelect)
    .sort(parseSort(req.query.sort, "sortOrder name"))
    .lean();
  const { employeeMap, seatMap } = await getDirectCounts();
  const tree = buildFlatTree(units, employeeMap, seatMap);

  return apiResponse(res, 200, "Organization unit tree fetched", tree);
});

export const getOrganizationUnitById = asyncHandler(async (req, res) => {
  const unit = await OrganizationUnit.findById(req.params.id)
    .populate("parent", "name code type path")
    .populate("parentOfficeSection", "name code type path")
    .lean();

  if (!unit) throw new AppError("Organization unit not found", 404);
  return apiResponse(res, 200, "Organization unit fetched", shapeUnit(unit));
});

export const createOrganizationUnit = asyncHandler(async (req, res) => {
  const payload = stripUnitPayload(req.body);
  if (!payload.name) throw new AppError("Unit name is required", 400);

  const parentId = getUnitId(payload.parent);
  let parent = null;
  if (parentId) {
    parent = await findUnitById(parentId);
    if (!parent) throw new AppError("Parent unit not found", 404);
    if (!parent.isActive) throw new AppError("Parent unit is inactive", 400);
  }
  const sortOrder =
    req.body.sortOrder !== undefined && req.body.sortOrder !== null && req.body.sortOrder !== ""
      ? Number(req.body.sortOrder)
      : req.body.displayOrder !== undefined && req.body.displayOrder !== null && req.body.displayOrder !== ""
      ? Number(req.body.displayOrder)
      : (await getSiblingMaxSortOrder(parentId)) + 1;
  const ancestors = parent ? [...(parent.ancestors || []), parent._id] : [];

  const unit = await OrganizationUnit.create({
    ...payload,
    parent: parentId,
    parentOfficeSection: parentId,
    ancestors,
    level: parent ? Number(parent.level || 0) + 1 : 0,
    path: buildUnitPath(parent?.path || parent?.name || "", payload.name),
    sortOrder,
    displayOrder: sortOrder,
    type: payload.type || (parent ? "section" : "office"),
    createdBy: req.user?._id,
    updatedBy: req.user?._id,
  });

  await logActivity({
    actorUser: req.user?._id,
    action: "create",
    entityType: "OrganizationUnit",
    entityId: unit._id,
    summary: `Created organization unit ${unit.name}`,
    after: shapeUnit(unit),
  });

  return apiResponse(res, 201, "Organization unit created", shapeUnit(unit));
});

export const updateOrganizationUnit = asyncHandler(async (req, res) => {
  const unit = await OrganizationUnit.findById(req.params.id);
  if (!unit) throw new AppError("Organization unit not found", 404);

  const before = shapeUnit(unit);
  const parentIdRaw =
    req.body.parent !== undefined
      ? req.body.parent
      : req.body.parentOfficeSection !== undefined
      ? req.body.parentOfficeSection
      : getUnitParentId(unit);
  const parentId = getUnitId(parentIdRaw);
  const parent = parentId ? await validateParentChoice(unit._id, parentId) : null;

  if (req.body.name !== undefined) unit.name = String(req.body.name).trim();
  if (req.body.code !== undefined) unit.code = String(req.body.code || "").trim();
  if (req.body.type !== undefined) unit.type = req.body.type || "other";
  if (req.body.headDesignation !== undefined) unit.headDesignation = String(req.body.headDesignation || "").trim();
  if (req.body.description !== undefined) unit.description = String(req.body.description || "").trim();
  if (req.body.wing !== undefined) unit.wing = getUnitId(req.body.wing);
  if (req.body.isActive !== undefined) {
    unit.isActive = req.body.isActive === true || req.body.isActive === "true";
  }
  unit.parent = parentId;
  unit.parentOfficeSection = parentId;
  unit.updatedBy = req.user?._id;
  unit.ancestors = parent ? [...(parent.ancestors || []), parent._id] : [];
  unit.level = parent ? Number(parent.level || 0) + 1 : 0;
  unit.path = buildUnitPath(parent?.path || parent?.name || "", unit.name);

  if (req.body.sortOrder !== undefined || req.body.displayOrder !== undefined) {
    const nextSortOrder =
      req.body.sortOrder !== undefined && req.body.sortOrder !== null && req.body.sortOrder !== ""
        ? Number(req.body.sortOrder)
        : Number(req.body.displayOrder || 0);
    unit.sortOrder = nextSortOrder;
    unit.displayOrder = nextSortOrder;
  }

  await unit.save();
  await syncBranchHierarchy(unit);

  await logActivity({
    actorUser: req.user?._id,
    action: "update",
    entityType: "OrganizationUnit",
    entityId: unit._id,
    summary: `Updated organization unit ${unit.name}`,
    before,
    after: shapeUnit(unit),
  });

  return apiResponse(res, 200, "Organization unit updated", shapeUnit(unit));
});

export const deleteOrganizationUnit = asyncHandler(async (req, res) => {
  const unit = await OrganizationUnit.findById(req.params.id);
  if (!unit) throw new AppError("Organization unit not found", 404);

  const childCount = await OrganizationUnit.countDocuments({
    $or: [{ parent: unit._id }, { parentOfficeSection: unit._id }],
  });
  const [employeeCount, seatCount] = await Promise.all([
    Employee.countDocuments({ currentOfficeSection: unit._id, isArchived: { $ne: true } }),
    Seat.countDocuments({ officeSection: unit._id, isActive: true }),
  ]);

  if (childCount || employeeCount || seatCount) {
    throw new AppError(
      "Organization unit cannot be deleted because child units, employees, or seats are still linked to it",
      409
    );
  }

  const before = shapeUnit(unit);
  await OrganizationUnit.deleteOne({ _id: unit._id });

  await logActivity({
    actorUser: req.user?._id,
    action: "delete",
    entityType: "OrganizationUnit",
    entityId: unit._id,
    summary: `Deleted organization unit ${unit.name}`,
    before,
  });

  return apiResponse(res, 200, "Organization unit deleted", before);
});

export const moveOrganizationUnit = asyncHandler(async (req, res) => {
  const unit = await OrganizationUnit.findById(req.params.id);
  if (!unit) throw new AppError("Organization unit not found", 404);

  const before = shapeUnit(unit);
  unit.updatedBy = req.user?._id;
  const direction = req.body.direction || "";
  const nextParentRaw =
    req.body.parent !== undefined
      ? req.body.parent
      : req.body.parentOfficeSection !== undefined
      ? req.body.parentOfficeSection
      : getUnitParentId(unit);
  const nextParentId = getUnitId(nextParentRaw);

  if (direction) {
    const siblings = await OrganizationUnit.find({
      $or: [{ parent: nextParentId || null }, { parentOfficeSection: nextParentId || null }],
    }).sort({ sortOrder: 1, displayOrder: 1, name: 1 });
    const currentIndex = siblings.findIndex((item) => String(item._id) === String(unit._id));
    if (direction === "up" && currentIndex > 0) {
      const previous = siblings[currentIndex - 1];
      const currentSort = getUnitSortOrder(unit);
      const previousSort = getUnitSortOrder(previous);
      unit.sortOrder = previousSort;
      unit.displayOrder = previousSort;
      previous.sortOrder = currentSort;
      previous.displayOrder = currentSort;
      await previous.save();
    }
    if (direction === "down" && currentIndex >= 0 && currentIndex < siblings.length - 1) {
      const nextSibling = siblings[currentIndex + 1];
      const currentSort = getUnitSortOrder(unit);
      const nextSort = getUnitSortOrder(nextSibling);
      unit.sortOrder = nextSort;
      unit.displayOrder = nextSort;
      nextSibling.sortOrder = currentSort;
      nextSibling.displayOrder = currentSort;
      await nextSibling.save();
    }
  } else {
    const parent = nextParentId ? await validateParentChoice(unit._id, nextParentId) : null;
    unit.parent = nextParentId;
    unit.parentOfficeSection = nextParentId;
    unit.ancestors = parent ? [...(parent.ancestors || []), parent._id] : [];
    unit.level = parent ? Number(parent.level || 0) + 1 : 0;
    unit.path = buildUnitPath(parent?.path || parent?.name || "", unit.name);
    unit.updatedBy = req.user?._id;

    if (req.body.sortOrder !== undefined || req.body.displayOrder !== undefined) {
      const nextSortOrder =
        req.body.sortOrder !== undefined && req.body.sortOrder !== null && req.body.sortOrder !== ""
          ? Number(req.body.sortOrder)
          : Number(req.body.displayOrder || 0);
      unit.sortOrder = nextSortOrder;
      unit.displayOrder = nextSortOrder;
    } else {
      const siblingMax = await getSiblingMaxSortOrder(nextParentId, unit._id);
      if (!unit.sortOrder && unit.sortOrder !== 0) {
        unit.sortOrder = siblingMax + 1;
        unit.displayOrder = siblingMax + 1;
      }
    }

    await unit.save();
  }

  await syncBranchHierarchy(unit);

  await logActivity({
    actorUser: req.user?._id,
    action: "move",
    entityType: "OrganizationUnit",
    entityId: unit._id,
    summary: `Moved organization unit ${unit.name}`,
    before,
    after: shapeUnit(unit),
    metadata: {
      direction: direction || null,
      nextParentId: nextParentId || null,
    },
  });

  return apiResponse(res, 200, "Organization unit moved", shapeUnit(unit));
});

// Compatibility exports for the legacy /offices route.
export const listOffices = listOrganizationUnits;
export const listOfficeTree = listOrganizationUnitTree;
export const createOffice = createOrganizationUnit;
export const getOfficeById = getOrganizationUnitById;
export const updateOffice = updateOrganizationUnit;
export const deleteOffice = deleteOrganizationUnit;
