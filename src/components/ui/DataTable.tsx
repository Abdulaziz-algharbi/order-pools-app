import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Spinner";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  /** Hide this column in the mobile card view (e.g. redundant with the card title). */
  hideOnMobileCard?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: T) => void;
  /** Heading shown at the top of each mobile card. Defaults to the first column's value. */
  renderMobileTitle?: (row: T) => ReactNode;
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  isLoading,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  onRowClick,
  renderMobileTitle,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <>
      {/* Desktop / tablet table */}
      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white sm:block">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/60">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="whitespace-nowrap px-4 py-3 font-medium text-slate-500">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={() => onRowClick?.(row)}
                className={cn(onRowClick && "cursor-pointer hover:bg-slate-50")}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn("px-4 py-3 align-middle", col.className)}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="space-y-3 sm:hidden">
        {data.map((row) => (
          <div
            key={rowKey(row)}
            onClick={() => onRowClick?.(row)}
            className={cn(
              "rounded-xl border border-slate-200 bg-white p-4",
              onRowClick && "cursor-pointer active:bg-slate-50",
            )}
          >
            <div className="mb-2 font-medium text-primary">
              {renderMobileTitle ? renderMobileTitle(row) : columns[0]?.render(row)}
            </div>
            {columns
              .filter((col) => !col.hideOnMobileCard && !(!renderMobileTitle && col === columns[0]))
              .map((col) => (
                <div key={col.key} className="flex items-center justify-between gap-3 py-1 text-sm">
                  <span className="text-slate-500">{col.header}</span>
                  <span className="text-right text-primary">{col.render(row)}</span>
                </div>
              ))}
          </div>
        ))}
      </div>
    </>
  );
}
