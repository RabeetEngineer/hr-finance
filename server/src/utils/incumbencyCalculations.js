const currentStatuses = new Set(["active", "vacant"]);
const oldStatuses = new Set(["transferred", "retired", "deceased"]);

const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const designationName = (employee) => employee?.designation?.name || "";
const sectionId = (employee) => String(employee?.currentOfficeSection?._id || employee?.currentOfficeSection?.id || employee?.currentOfficeSection || "unassigned");
const sectionName = (unit) => unit?.name || unit?.code || unit?.path || "Unassigned";

const countByStatus = (rows, status) => rows.filter((employee) => employee.employmentStatus === status).length;

const byDesignation = (employees) => {
  const groups = new Map();

  employees.forEach((employee) => {
    const designation = employee.designation;
    const id = String(designation?._id || designation?.id || employee.designation || "unassigned");
    const name = designation?.name || "Unspecified";
    if (!groups.has(id)) {
      groups.set(id, {
        designationId: id,
        designation: name,
        totalStrength: 0,
        active: 0,
        vacant: 0,
        transferred: 0,
        retired: 0,
        deceased: 0,
        sectionsCovered: new Set(),
      });
    }

    const row = groups.get(id);
    row.totalStrength += 1;
    if (employee.employmentStatus === "active") row.active += 1;
    if (employee.employmentStatus === "vacant") row.vacant += 1;
    if (employee.employmentStatus === "transferred") row.transferred += 1;
    if (employee.employmentStatus === "retired") row.retired += 1;
    if (employee.employmentStatus === "deceased") row.deceased += 1;
    if (employee.currentOfficeSection) row.sectionsCovered.add(sectionId(employee));
  });

  return [...groups.values()]
    .map((row) => ({ ...row, sectionsCovered: row.sectionsCovered.size }))
    .sort((a, b) => b.totalStrength - a.totalStrength || a.designation.localeCompare(b.designation));
};

const bySection = (employees, unitsById) => {
  const groups = new Map();

  employees
    .filter((employee) => currentStatuses.has(employee.employmentStatus))
    .forEach((employee) => {
      const id = sectionId(employee);
      const unit = unitsById.get(id) || employee.currentOfficeSection;
      if (!groups.has(id)) {
        groups.set(id, {
          sectionId: id,
          section: sectionName(unit),
          code: unit?.code || "",
          path: unit?.path || "",
          totalStaff: 0,
          active: 0,
          vacant: 0,
        });
      }

      const row = groups.get(id);
      row.totalStaff += 1;
      if (employee.employmentStatus === "active") row.active += 1;
      if (employee.employmentStatus === "vacant") row.vacant += 1;
    });

  return [...groups.values()].sort((a, b) => a.section.localeCompare(b.section));
};

const countMatches = (designations, matchers) =>
  designations.filter((name) => {
    const normalized = normalize(name);
    return matchers.some((matcher) => (typeof matcher === "string" ? normalized === matcher : matcher.test(normalized)));
  }).length;

const badge = (status, detail = "") => ({ status, detail });

const evaluateSinglePost = (count) => {
  if (count === 0) return badge("Missing", "1");
  if (count === 1) return badge("OK");
  return badge("Excess", String(count - 1));
};

const evaluateAssistant = (designations) => {
  const superintendents = countMatches(designations, ["superintendent"]);
  const assistants = countMatches(designations, ["assistant"]);
  const total = superintendents + assistants;
  if (superintendents && assistants) return badge("Both Present");
  return evaluateSinglePost(total);
};

const evaluateClerical = (designations) => {
  const seniorClerks = countMatches(designations, ["senior clerk"]);
  const juniorClerks = countMatches(designations, ["junior clerk"]);
  const total = seniorClerks + juniorClerks;
  if (seniorClerks && juniorClerks) return badge("Both Present", String(total));
  return evaluateSinglePost(total);
};

const evaluateComposition = (employees, units) => {
  const unitsById = new Map(units.map((unit) => [String(unit._id || unit.id), unit]));
  const groups = new Map();
  const childrenByParent = new Map();

  units.forEach((unit) => {
    const parentId = String(unit.parent || unit.parentOfficeSection || "");
    if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
    childrenByParent.get(parentId).push(unit);
  });

  const sortUnits = (items = []) =>
    [...items].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || sectionName(a).localeCompare(sectionName(b)));

  const orderedUnitIds = [];
  const visited = new Set();
  const visit = (items = []) => {
    sortUnits(items).forEach((unit) => {
      const id = String(unit._id || unit.id);
      if (!id || visited.has(id)) return;
      visited.add(id);
      orderedUnitIds.push(id);
      visit(childrenByParent.get(id));
    });
  };

  visit(childrenByParent.get(""));
  visit(units.filter((unit) => !visited.has(String(unit._id || unit.id))));

  employees
    .filter((employee) => currentStatuses.has(employee.employmentStatus))
    .forEach((employee) => {
      const id = sectionId(employee);
      const unit = unitsById.get(id) || employee.currentOfficeSection;
      if (!groups.has(id)) {
        groups.set(id, {
          sectionId: id,
          section: sectionName(unit),
          code: unit?.code || "",
          type: unit?.type || "",
          level: unit?.level || 0,
          path: unit?.path || "",
          sortOrder: unit?.sortOrder || 0,
          rows: [],
        });
      }
      groups.get(id).rows.push(employee);
    });

  units.forEach((unit) => {
    const id = String(unit._id || unit.id);
    if (!groups.has(id)) {
      groups.set(id, {
        sectionId: id,
        section: sectionName(unit),
        code: unit.code || "",
        type: unit.type || "",
        level: unit.level || 0,
        path: unit.path || "",
        sortOrder: unit.sortOrder || 0,
        rows: [],
      });
    }
  });

  const rankById = new Map(orderedUnitIds.map((id, index) => [id, index]));

  return [...groups.values()]
    .sort((a, b) => Number(rankById.get(a.sectionId) ?? 999999) - Number(rankById.get(b.sectionId) ?? 999999) || a.section.localeCompare(b.section))
    .map((group) => {
      const sectionText = normalize(`${group.section} ${group.code} ${group.path}`);
      const isOfficerOffice = sectionText.startsWith("o o ") || sectionText.includes("finance secretary") || sectionText.includes("additional finance secretary") || sectionText.includes("deputy secretary") || group.type === "office";
      const designationCounts = new Map();
      group.rows.forEach((employee) => {
        const name = designationName(employee) || "Unspecified";
        designationCounts.set(name, Number(designationCounts.get(name) || 0) + 1);
      });
      const designationBreakdown = [...designationCounts.entries()]
        .map(([designation, count]) => ({ designation, count }))
        .sort((a, b) => b.count - a.count || a.designation.localeCompare(b.designation));

      if (isOfficerOffice) {
        return {
          sectionId: group.sectionId,
          section: group.section,
          totalStaff: group.rows.length,
          skipped: true,
          designationBreakdown,
          rules: [{ cadre: "Officer Office", ...badge("Skipped") }],
        };
      }

      const designations = group.rows.map(designationName);
      const stenoCount = countMatches(designations, [
        "private secretary",
        "personal assistant",
        "senior scale stenographer",
        "stenographer",
      ]);
      const naibQasidCount = countMatches(designations, ["naib qasid", "naib qasid d w", "permanent workman"]);
      const itCount = countMatches(designations, [/computer operator/, /data entry operator/, /\bit\b/, /network/, /system/, /software/, /hardware/, /database/]);

      return {
        sectionId: group.sectionId,
        section: group.section,
        totalStaff: group.rows.length,
        skipped: false,
        designationBreakdown,
        rules: [
          { cadre: "Assistant Cadre", ...evaluateAssistant(designations) },
          { cadre: "Steno Cadre", ...evaluateSinglePost(stenoCount) },
          { cadre: "Clerical Cadre", ...evaluateClerical(designations) },
          { cadre: "Naib Qasid Cadre", ...evaluateSinglePost(naibQasidCount) },
          { cadre: "IT Cadre", ...(itCount > 1 ? badge("Excess", String(itCount - 1)) : badge("OK")) },
        ],
      };
    });
};

export const buildIncumbencyCalculations = ({ employees = [], units = [] }) => {
  const unitsById = new Map(units.map((unit) => [String(unit._id || unit.id), unit]));
  const currentEmployees = employees.filter((employee) => currentStatuses.has(employee.employmentStatus));

  return {
    counts: {
      totalCurrentStaff: currentEmployees.length,
      totalVacantSeats: countByStatus(employees, "vacant"),
      totalActiveInFinance: countByStatus(employees, "active"),
      totalOfficers: currentEmployees.filter((employee) => employee.employeeType === "officer" || employee.designation?.category === "officer").length,
      totalOfficials: currentEmployees.filter((employee) => employee.employeeType === "official" || employee.designation?.category === "official").length,
      transferredEmployees: countByStatus(employees, "transferred"),
      retiredEmployees: countByStatus(employees, "retired"),
      deceasedEmployees: countByStatus(employees, "deceased"),
      totalSectionsOffices: units.length,
      oldEmployees: employees.filter((employee) => oldStatuses.has(employee.employmentStatus)).length,
    },
    designationWise: byDesignation(employees),
    sectionWise: bySection(employees, unitsById),
    compositionRules: evaluateComposition(employees, units),
  };
};
