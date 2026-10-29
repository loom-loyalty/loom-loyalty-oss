import { BookmarkPlus, Star, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";

export interface SavedQueryItem {
  id: string;
  name: string;
  sql: string;
  createdAt: string;
  updatedAt: string;
  favorite: boolean;
}

export interface SavedQueriesPanelProps {
  /** List of saved queries */
  queries: SavedQueryItem[];
  /** Called when user selects a saved query to load */
  onLoad: (query: SavedQueryItem) => void;
  /** Called when user saves a new query */
  onSave: (name: string, sql: string) => void;
  /** Called when user deletes a saved query */
  onDelete: (id: string) => void;
  /** Called when user toggles favorite status */
  onToggleFavorite: (id: string) => void;
  /** Current SQL in the editor (for saving) */
  currentSql: string;
}

/**
 * Dropdown panel for managing saved queries.
 * Shows favorites first, then recent queries.
 */
export function SavedQueriesPanel({
  queries,
  onLoad,
  onSave,
  onDelete,
  onToggleFavorite,
  currentSql,
}: SavedQueriesPanelProps): ReactNode {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newName, setNewName] = useState("");

  const sorted = [...queries].sort((a, b) => {
    if (a.favorite && !b.favorite) return -1;
    if (!a.favorite && b.favorite) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const handleSave = () => {
    const name = newName.trim();
    if (!name || !currentSql.trim()) return;
    onSave(name, currentSql);
    setNewName("");
    setIsSaving(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label="Saved queries"
        className="border-border text-foreground hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
      >
        <Star className="h-3.5 w-3.5" aria-hidden="true" />
        Saved
        {queries.length > 0 && (
          <span className="bg-muted text-muted-foreground rounded-full px-1.5 text-[10px]">
            {queries.length}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            role="presentation"
            onClick={() => setIsOpen(false)}
            onKeyDown={(e) => e.key === "Escape" && setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="border-border bg-card absolute top-full right-0 z-50 mt-1 w-80 rounded-lg border shadow-lg">
            {/* Save new */}
            <div className="border-border border-b p-3">
              {isSaving ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSave()}
                    placeholder="Query name…"
                    className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-primary flex-1 rounded-md border px-2.5 py-1.5 text-xs focus:ring-1 focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!newName.trim() || !currentSql.trim()}
                    className="bg-primary text-primary-foreground rounded-md px-2.5 py-1.5 text-xs font-medium disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSaving(false);
                      setNewName("");
                    }}
                    className="text-muted-foreground hover:text-foreground rounded-md px-2 py-1.5 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsSaving(true)}
                  disabled={!currentSql.trim()}
                  className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors disabled:opacity-50"
                >
                  <BookmarkPlus className="h-3.5 w-3.5" aria-hidden="true" />
                  Save current query
                </button>
              )}
            </div>

            {/* Query list */}
            <div className="max-h-64 overflow-y-auto">
              {sorted.length === 0 ? (
                <p className="text-muted-foreground px-3 py-6 text-center text-xs">
                  No saved queries yet
                </p>
              ) : (
                sorted.map((q) => (
                  <div
                    key={q.id}
                    className="group border-border/50 flex items-center gap-2 border-b px-3 py-2 last:border-0"
                  >
                    <button
                      type="button"
                      onClick={() => onToggleFavorite(q.id)}
                      className="shrink-0"
                      aria-label={q.favorite ? "Remove from favorites" : "Add to favorites"}
                      title={q.favorite ? "Remove from favorites" : "Add to favorites"}
                    >
                      <Star
                        className={`h-3.5 w-3.5 transition-colors ${
                          q.favorite
                            ? "fill-accent text-accent"
                            : "text-muted-foreground/40 hover:text-accent"
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        onLoad(q);
                        setIsOpen(false);
                      }}
                      className="text-foreground hover:text-primary flex-1 truncate text-left text-xs font-medium"
                      title={q.sql}
                    >
                      {q.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(q.id)}
                      aria-label={`Delete query: ${q.name}`}
                      className="text-muted-foreground/40 hover:text-destructive shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
