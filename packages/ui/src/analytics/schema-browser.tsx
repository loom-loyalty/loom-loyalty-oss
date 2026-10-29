import { ChevronDown, ChevronRight, Database, Table2 } from "lucide-react";
import { useState, type ReactNode } from "react";

export interface SchemaBrowserColumn {
  name: string;
  type: string;
}

export interface SchemaBrowserTable {
  name: string;
  description: string;
  columns: SchemaBrowserColumn[];
}

export interface SchemaBrowserProps {
  /** Available datasources/tables */
  tables: SchemaBrowserTable[];
  /** Called when user clicks a table or column name to insert it */
  onInsert?: (text: string) => void;
}

function TableNode({
  table,
  onInsert,
}: {
  table: SchemaBrowserTable;
  onInsert?: (text: string) => void;
}): ReactNode {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-label={`${table.name} table`}
        className="text-foreground hover:bg-muted flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors"
      >
        {expanded ? (
          <ChevronDown className="text-muted-foreground h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        ) : (
          <ChevronRight className="text-muted-foreground h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        )}
        <Table2 className="text-primary h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate font-mono text-xs">{table.name}</span>
      </button>

      {expanded && (
        <div className="border-border/50 ml-3 border-l pl-2">
          {table.description && (
            <p className="text-muted-foreground px-2 py-1 text-xs">{table.description}</p>
          )}
          {table.columns.map((col) => (
            <button
              key={col.name}
              type="button"
              onClick={() => onInsert?.(col.name)}
              aria-label={`Insert ${col.name} column (${col.type})`}
              className="hover:bg-muted flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left transition-colors"
            >
              <span className="text-foreground truncate font-mono text-xs">{col.name}</span>
              <span className="text-muted-foreground/70 shrink-0 font-mono text-[10px]">
                {col.type}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Schema browser sidebar showing available tables and their columns.
 * Click a table name to insert it at cursor in the SQL editor.
 */
export function SchemaBrowser({ tables, onInsert }: SchemaBrowserProps): ReactNode {
  if (tables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <Database className="text-muted-foreground/50 h-6 w-6" aria-hidden="true" />
        <p className="text-muted-foreground text-xs">No datasources available</p>
      </div>
    );
  }

  return (
    <nav aria-label="Database schema" className="space-y-1 p-2">
      <h3 className="text-muted-foreground px-2 pb-1 text-xs font-semibold tracking-wider uppercase">
        Tables
      </h3>
      {tables.map((table) => (
        <TableNode key={table.name} table={table} onInsert={onInsert} />
      ))}
    </nav>
  );
}
