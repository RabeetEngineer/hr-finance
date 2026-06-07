export const incumbencyStatuses = {
  active: "Active",
  vacant: "Vacant",
  transferred: "Transferred",
  retired: "Retired",
  deceased: "Deceased",
};

export const statusLabel = (status) => incumbencyStatuses[status] || String(status || "-").replaceAll("_", " ");

export const designationSummary = (rows = []) => {
  const sections = new Set();
  rows.forEach((row) => {
    const sectionId = row.currentOfficeSection?.id || row.currentOfficeSection?._id || row.currentOfficeSection;
    if (sectionId) sections.add(String(sectionId));
  });

  return {
    totalStrength: rows.length,
    active: rows.filter((row) => row.employmentStatus === "active").length,
    vacant: rows.filter((row) => row.employmentStatus === "vacant").length,
    transferred: rows.filter((row) => row.employmentStatus === "transferred").length,
    retired: rows.filter((row) => row.employmentStatus === "retired").length,
    deceased: rows.filter((row) => row.employmentStatus === "deceased").length,
    sectionsCovered: sections.size,
  };
};
