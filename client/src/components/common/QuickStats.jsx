import { useMemo } from "react";

const QuickStats = ({ rows = [], title = "Quick Stats" }) => {
  const stats = useMemo(() => {
    const byDesignation = new Map();
    rows.forEach((employee) => {
      const name = employee?.designation?.name || "Unassigned";
      if (!byDesignation.has(name)) byDesignation.set(name, 0);
      byDesignation.set(name, byDesignation.get(name) + 1);
    });
    return [...byDesignation.entries()].map(([designation, count]) => ({ designation, count }));
  }, [rows]);

  if (!rows.length) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="rounded-md bg-white/15 px-2 py-1 text-[11px] font-black">{title}: {rows.length}</span>
      {stats.map((item) => (
        <span key={item.designation} className="rounded-md bg-white/12 px-2 py-1 text-[11px] font-bold">
          {item.designation} {item.count}
        </span>
      ))}
    </div>
  );
};

export default QuickStats;
