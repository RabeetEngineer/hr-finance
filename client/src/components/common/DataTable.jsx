import { Fragment } from "react";
import { cn } from "@/utils/cn";

const DataTable = ({
  columns = [],
  data = [],
  loading = false,
  emptyState = "No records found.",
  rowKey = (row, index) => row.id || index,
  onRowClick,
  actions,
}) => {
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-surface shadow-soft">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-surface-2/80">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn("px-5 py-4 text-left text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground", column.headerClassName)}
                >
                  {column.header}
                </th>
              ))}
              {actions ? <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Actions</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <tr key={index} className="animate-pulse">
                  {columns.map((column) => (
                    <td key={column.key} className="px-5 py-4">
                      <div className="h-4 rounded-full bg-muted" />
                    </td>
                  ))}
                  {actions ? (
                    <td className="px-5 py-4">
                      <div className="ml-auto h-4 w-24 rounded-full bg-muted" />
                    </td>
                  ) : null}
                </tr>
              ))
            ) : data.length ? (
              data.map((row, rowIndex) => (
                <tr
                  key={rowKey(row, rowIndex)}
                  className={cn("transition hover:bg-muted/50", onRowClick && "cursor-pointer")}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((column) => (
                    <td key={column.key} className="px-5 py-4 align-top text-sm text-foreground">
                      {column.render ? column.render(row, rowIndex) : row[column.key] ?? "-"}
                    </td>
                  ))}
                  {actions ? <td className="px-5 py-4 align-top">{actions(row)}</td> : null}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)} className="px-5 py-14 text-center">
                  <div className="mx-auto max-w-md">
                    <p className="text-base font-semibold text-foreground">{emptyState}</p>
                    <p className="mt-2 text-sm text-muted-foreground">Use the filters or create a new record to get started.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataTable;

