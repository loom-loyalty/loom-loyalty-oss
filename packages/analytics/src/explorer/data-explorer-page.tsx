/**
 * Spindle — SQL Workbench
 *
 * IDE-style layout with an AI assistant above the editor:
 *   ┌──────────┬────────────────────────┐
 *   │ Schema   │ Ask AI (NL → SQL)      │
 *   │ Browser  ├────────────────────────┤
 *   │          │ SQL Editor             │
 *   │          ├────────────────────────┤
 *   │          │ Results Table          │
 *   └──────────┴────────────────────────┘
 *
 * The AI proposes SQL into the editor; the human reviews and clicks Run. The
 * AI never executes — execution stays on the browser → TinyBird read-only path.
 */
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  PageHeader,
  Skeleton,
} from "@loom-loyalty/ui";
import { AiLimitNotice } from "@loom-loyalty/ui/ai";
import {
  AskAiAssistant,
  ResultVisualization,
  SampleDataBanner,
  SavedQueriesPanel,
  SchemaBrowser,
  SqlEditor,
} from "@loom-loyalty/ui/analytics";
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  ChevronDown,
  Database,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Telescope,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { resolveDrilldown, toDrilldownSearch, type DrilldownTarget } from "../drilldown";
import { useSavedQueries, useSpindleTranslate, useSqlQuery } from "../hooks";
import { useTinybird } from "../provider";
import { QUERY_TEMPLATES } from "../query-templates";
import type { DatasourceSchema, SpindleTurn, TinybirdResponse } from "../types";

// ─── Sample Mode Data ────────────────────────────────────

const SAMPLE_DATASOURCES: DatasourceSchema[] = [
  {
    name: "mv_events",
    description:
      "Consolidated event records. Dedupe via argMax(col, modified_datetime) + GROUP BY (organization_environment_id, event_record_id) in a subquery, then apply cancelled = 0 in the outer WHERE. Do not use FINAL — it throws ILLEGAL_FINAL.",
    columns: [
      { name: "event_record_id", type: "String" },
      { name: "source_event_datetime", type: "DateTime64" },
      { name: "entity_type", type: "String" },
      { name: "entity_id", type: "String" },
      { name: "status", type: "String" },
      { name: "description", type: "String" },
      { name: "event_type_code", type: "String" },
      { name: "cancelled", type: "UInt8" },
    ],
  },
  {
    name: "mv_customers",
    description:
      "Consolidated customer records. Dedupe via argMax(col, modified_datetime) + GROUP BY (organization_environment_id, customer_id) in a subquery, then apply deleted = 0 in the outer WHERE. Do not use FINAL — it throws ILLEGAL_FINAL.",
    columns: [
      { name: "customer_id", type: "String" },
      { name: "external_id", type: "String" },
      { name: "first_name", type: "String" },
      { name: "last_name", type: "String" },
      { name: "status_code", type: "String" },
      { name: "enrollment_datetime", type: "DateTime64" },
      { name: "deleted", type: "UInt8" },
    ],
  },
  {
    name: "mv_currency_issued_summary",
    description: "Currency issued event summaries with DEBIT/CREDIT totals",
    columns: [
      { name: "event_datetime", type: "DateTime64" },
      { name: "customer_entity_id", type: "String" },
      { name: "total_debit", type: "Float64" },
      { name: "total_credit", type: "Float64" },
      { name: "event_description", type: "String" },
    ],
  },
  {
    name: "coupon_issued",
    description: "Coupon issuance events with offer and discount details",
    columns: [
      { name: "event_datetime", type: "DateTime64" },
      { name: "customer_entity_id", type: "String" },
      { name: "offer_code", type: "String" },
      { name: "offer_name", type: "String" },
      { name: "discount_type", type: "String" },
      { name: "discount_value", type: "Float64" },
      { name: "cancelled", type: "UInt8" },
    ],
  },
  {
    name: "customer_tier_issued",
    description: "Tier assignment events",
    columns: [
      { name: "event_datetime", type: "DateTime64" },
      { name: "customer_entity_id", type: "String" },
      { name: "tier_code", type: "String" },
      { name: "tier_name", type: "String" },
      { name: "tier_rank", type: "Int32" },
      { name: "cancelled", type: "UInt8" },
    ],
  },
];

const SAMPLE_RESULT: TinybirdResponse<Record<string, unknown>> = {
  data: [
    {
      customer_name: "Sarah Chen",
      tier: "Gold",
      total_earned: 12450,
      total_redeemed: 3200,
      net_balance: 9250,
    },
    {
      customer_name: "Marcus Webb",
      tier: "Gold",
      total_earned: 9821,
      total_redeemed: 1500,
      net_balance: 8321,
    },
    {
      customer_name: "Priya Patel",
      tier: "Silver",
      total_earned: 7650,
      total_redeemed: 4100,
      net_balance: 3550,
    },
    {
      customer_name: "James Liu",
      tier: "Gold",
      total_earned: 6300,
      total_redeemed: 800,
      net_balance: 5500,
    },
    {
      customer_name: "Ana Rodriguez",
      tier: "Silver",
      total_earned: 5420,
      total_redeemed: 2700,
      net_balance: 2720,
    },
    {
      customer_name: "David Kim",
      tier: "Bronze",
      total_earned: 4890,
      total_redeemed: 1200,
      net_balance: 3690,
    },
    {
      customer_name: "Emma Thompson",
      tier: "Gold",
      total_earned: 4200,
      total_redeemed: 3800,
      net_balance: 400,
    },
    {
      customer_name: "Raj Kapoor",
      tier: "Silver",
      total_earned: 3950,
      total_redeemed: 950,
      net_balance: 3000,
    },
    {
      customer_name: "Lisa Park",
      tier: "Bronze",
      total_earned: 3100,
      total_redeemed: 500,
      net_balance: 2600,
    },
    {
      customer_name: "Tom Baker",
      tier: "Silver",
      total_earned: 2840,
      total_redeemed: 1400,
      net_balance: 1440,
    },
  ],
  rows: 10,
  rows_before_limit_at_least: 2847,
  meta: [
    { name: "customer_name", type: "String" },
    { name: "tier", type: "String" },
    { name: "total_earned", type: "Float64" },
    { name: "total_redeemed", type: "Float64" },
    { name: "net_balance", type: "Float64" },
  ],
  statistics: { elapsed: 0.042, rows_read: 12847, bytes_read: 1048576 },
};

function buildSchemaMap(datasources: DatasourceSchema[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const ds of datasources) {
    map[ds.name] = ds.columns.map((c) => c.name);
  }
  return map;
}

/**
 * Starter prompts for the Ask-AI cold start, grounded in which datasources are
 * actually present (sample or real). Solves the blank-textbox problem for
 * non-technical users without asking them to know table names.
 */
function buildStarters(datasources: DatasourceSchema[]): string[] {
  const names = new Set(datasources.map((d) => d.name));
  const candidates: Array<{ needs?: string; text: string }> = [
    { needs: "mv_currency_issued_summary", text: "Top 10 customers by points earned this quarter" },
    { needs: "mv_customers", text: "How many customers joined in the last 30 days?" },
    { needs: "mv_events", text: "Show event volume by type this month" },
    { needs: "coupon_issued", text: "What is the coupon redemption rate by offer?" },
    { needs: "customer_tier_issued", text: "How many customers are in each tier?" },
  ];
  const grounded = candidates.filter((c) => !c.needs || names.has(c.needs)).map((c) => c.text);
  return grounded.length > 0 ? grounded.slice(0, 4) : ["Show me the 100 most recent events"];
}

/**
 * Single "Examples" dropdown that offers both natural-language prompts ("Ask",
 * routed to the AI assistant) and SQL templates ("SQL", loaded straight into the
 * editor), each tagged so the user knows which is which. NL examples only appear
 * when the AI assistant is enabled (nlExamples is empty otherwise).
 */
function ExamplesDropdown({
  nlExamples,
  onAsk,
  onSelectSql,
}: {
  nlExamples: string[];
  onAsk: (prompt: string) => void;
  onSelectSql: (sql: string) => void;
}): ReactNode {
  const showNl = nlExamples.length > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Example queries"
          className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors"
        >
          Examples
          <ChevronDown className="h-3 w-3" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      {/* Radix handles arrow-key nav, Home/End, typeahead, Esc/Tab close, focus
          management, and aria wiring — the WAI-ARIA menu keyboard contract a
          hand-rolled popover would have to reimplement. */}
      <DropdownMenuContent align="end" className="max-h-72 w-80 overflow-y-auto">
        {nlExamples.map((q, i) => (
          <DropdownMenuItem
            key={`nl-${String(i)}`}
            onSelect={() => onAsk(q)}
            className="items-center gap-2"
          >
            <span className="bg-accent/15 text-accent-dark shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold">
              Ask
            </span>
            <span className="text-foreground text-xs">{q}</span>
          </DropdownMenuItem>
        ))}
        {showNl && <DropdownMenuSeparator />}
        {QUERY_TEMPLATES.map((t, i) => (
          <DropdownMenuItem
            key={`sql-${String(i)}`}
            onSelect={() => onSelectSql(t.sql)}
            className="items-start gap-2"
          >
            <span className="bg-primary/10 text-primary-dark mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold">
              SQL
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-foreground text-xs font-medium">{t.name}</span>
              <span className="text-muted-foreground text-[10px]">{t.description}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The Ask-AI proposal shown in the bar — set and cleared as one unit. */
interface AiProposal {
  explanation: string | null;
  assumptions: string[];
  clarifyingQuestion: string | null;
}

export interface DataExplorerPageProps {
  /**
   * A drill-down handed over from the Analytics charts. Resolved against the
   * live datasource schema: SQL when the schema supports it (run immediately,
   * since the user already chose this result by clicking it), otherwise a
   * question seeded into the AI assistant for them to review and send.
   */
  drilldown?: DrilldownTarget | null;
  /**
   * Supplies a WorkOS access token for the AI assistant's requests. Omit in an
   * app whose `/api/ai/*` proxy is cookie-authed and mints the bearer itself;
   * see `useSpindleTranslate`.
   */
  getAccessToken?: () => Promise<string>;
  /**
   * Scopes saved queries to one organization environment. Saved queries live in
   * localStorage, so without a key they would leak across environments on a
   * shared browser; omitting it disables saving rather than risking that.
   */
  organizationEnvironmentId?: string | null;
  /** Where the drill-down banner's back link points. */
  analyticsHref?: string;
  /**
   * Called when a query against real data returns at least one row. Sample
   * mode and empty results never call it. Hub uses it for the onboarding
   * "Run a query" step.
   */
  onQuerySuccess?: () => void;
}

export function DataExplorerPage({
  drilldown = null,
  getAccessToken,
  organizationEnvironmentId,
  analyticsHref = "/analytics",
  onQuerySuccess,
}: DataExplorerPageProps): ReactNode {
  const { datasources, sqlEnabled, isLoading, error, retry } = useTinybird();
  const {
    data,
    isLoading: queryLoading,
    isExporting,
    error: queryError,
    executedSql,
    runQuery,
    exportCsv,
  } = useSqlQuery();
  const savedQueriesKey = organizationEnvironmentId
    ? `spindle:saved-queries:${organizationEnvironmentId}`
    : undefined;
  const { queries, save, remove, toggleFavorite } = useSavedQueries(savedQueriesKey);
  const {
    translate: aiTranslate,
    explainResults: aiExplainResults,
    isLoading: aiLoading,
    error: aiError,
    limit: aiLimit,
    explainLoading: aiExplainLoading,
    explainError: aiExplainError,
    explainLimit: aiExplainLimit,
    reset: aiReset,
  } = useSpindleTranslate(getAccessToken);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [insertText, setInsertText] = useState<string | null>(null);
  const [externalSql, setExternalSql] = useState<string | null>(null);
  const [sampleMode, setSampleMode] = useState(false);
  const [sampleResult, setSampleResult] = useState<TinybirdResponse<
    Record<string, unknown>
  > | null>(null);
  // Track the last SQL that was run (for LIMIT detection and save)
  const [lastRunSql, setLastRunSql] = useState<string | null>(null);
  const [currentSql, setCurrentSql] = useState("");
  const [turns, setTurns] = useState<SpindleTurn[]>([]);

  // Ask-AI assistant state. The proposal (explanation/assumptions/clarifying) is
  // one object so every handler sets or clears it atomically — no partial stale
  // state. aiAnnouncement stays separate (a transient aria-live signal that must
  // re-fire even on an identical outcome).
  const [aiProposal, setAiProposal] = useState<AiProposal | null>(null);
  const [aiAnnouncement, setAiAnnouncement] = useState<string | null>(null);
  const [resultsSummary, setResultsSummary] = useState<string | null>(null);
  // Guards auto-fix to one attempt per distinct execution error.
  const [fixAttemptedFor, setFixAttemptedFor] = useState<string | null>(null);
  // What the current drill-down produced, shown as a banner so the user can see
  // which chart they came from and get back to it.
  const [drilldownNotice, setDrilldownNotice] = useState<{
    title: string;
    mode: "sql" | "ask";
  } | null>(null);
  const [askPrefill, setAskPrefill] = useState<string | null>(null);
  // Bumped on every run; in-flight AI handlers capture it and drop their result
  // if a run superseded them — a slow Ask must not clobber freshly-run SQL, and
  // a stale summary must not land under new results.
  const runSeqRef = useRef(0);
  // Bumped when the current conversation is intentionally reset, so a pending
  // generation cannot reintroduce turns or SQL from the prior grounding.
  const conversationSeqRef = useRef(0);
  // Snapshot of currentSql taken at the last reset. While the editor still
  // holds exactly this value, it's leftover from the abandoned conversation —
  // grounding a fresh ask on it would silently treat "Start new question" as
  // a continued refinement. Cleared once a turn re-establishes grounding, or
  // never set if the editor content changed (a reload or hand-edit signals
  // the user wants that new content grounded, same as before any reset).
  const staleSqlAtResetRef = useRef<string | null>(null);

  const clearConversation = useCallback(() => {
    conversationSeqRef.current += 1;
    setTurns([]);
    // Clear the last turn's proposal/announcement too — otherwise the prior
    // explanation, assumptions, or clarifying question keeps rendering under
    // a conversation that was just reset, even though nothing in AskAiAssistant
    // gates those panels on the conversation state itself.
    setAiProposal(null);
    setAiAnnouncement(null);
    staleSqlAtResetRef.current = currentSql;
  }, [currentSql]);

  // In sample mode, use mock datasources; otherwise use real ones
  const activeDatasources = sampleMode ? SAMPLE_DATASOURCES : datasources;
  const schemaMap = useMemo(() => buildSchemaMap(activeDatasources), [activeDatasources]);
  const starters = useMemo(() => buildStarters(activeDatasources), [activeDatasources]);
  const sampleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup sample mode timer on unmount
  useEffect(() => {
    return () => {
      if (sampleTimerRef.current) clearTimeout(sampleTimerRef.current);
    };
  }, []);

  const handleRun = useCallback(
    (sqlFromEditor: string) => {
      setCurrentSql(sqlFromEditor);
      setLastRunSql(sqlFromEditor);
      // A new run supersedes any in-flight or prior AI work: invalidate pending
      // AI responses (runSeq), drop the proposal + results summary, clear stale
      // AI errors, and re-enable auto-fix for whatever error this run produces.
      runSeqRef.current += 1;
      setAiProposal(null);
      setAiAnnouncement(null);
      setResultsSummary(null);
      setFixAttemptedFor(null);
      aiReset();
      if (sampleMode) {
        setSampleResult(null);
        if (sampleTimerRef.current) clearTimeout(sampleTimerRef.current);
        sampleTimerRef.current = setTimeout(() => setSampleResult(SAMPLE_RESULT), 400);
        return;
      }
      void runQuery(sqlFromEditor);
    },
    [runQuery, sampleMode, aiReset]
  );

  // Identity of the incoming drill-down. Serializing the target rather than
  // depending on the object keeps the effect from re-firing on every render,
  // and re-fires it when the user drills in again from a different chart.
  const drilldownKey = drilldown ? JSON.stringify(toDrilldownSearch(drilldown)) : null;
  // Applying a drill-down runs a query, so the guard is a ref rather than state:
  // it must be set synchronously, before the run schedules a re-render.
  const appliedDrilldownRef = useRef<string | null>(null);

  // Applying an incoming drill-down is a real side effect — it executes a
  // query — so the state set here (the banner, the editor contents) describes
  // what that side effect did and cannot be derived during render.
  useEffect(() => {
    if (!drilldown || drilldownKey === null) return;
    if (appliedDrilldownRef.current === drilldownKey) return;
    // The schema arrives with the token. Resolving before it lands would judge
    // every spec unsupported and fall back to a question that was never needed.
    if (isLoading || error) return;

    const handoff = resolveDrilldown(drilldown, activeDatasources);
    if (!handoff) return;
    appliedDrilldownRef.current = drilldownKey;

    if (handoff.sql) {
      setDrilldownNotice({ title: handoff.title, mode: "sql" });
      setExternalSql(handoff.sql);
      // Run it. The "AI never executes" rule guards model-authored SQL; this
      // query is app-authored and the user already asked for it by clicking the
      // result, so making them click Run again would just add a step.
      handleRun(handoff.sql);
    } else if (handoff.ask) {
      setDrilldownNotice({ title: handoff.title, mode: "ask" });
      setAskPrefill(handoff.ask);
    }
  }, [drilldown, drilldownKey, isLoading, error, activeDatasources, handleRun]);

  const handleExportCsv = useCallback(() => {
    if (executedSql) {
      void exportCsv(executedSql);
    }
  }, [exportCsv, executedSql]);

  const handleInsert = useCallback((text: string) => {
    setInsertText(text);
  }, []);

  const handleInsertConsumed = useCallback(() => {
    setInsertText(null);
  }, []);

  const handleExternalValueConsumed = useCallback(() => {
    setExternalSql(null);
  }, []);

  const limitApplied =
    executedSql !== null &&
    lastRunSql !== null &&
    !lastRunSql.toUpperCase().includes("LIMIT") &&
    executedSql.toUpperCase().includes("LIMIT");

  // Which result to show: sample or real. Computed before the early returns so
  // the AI handlers (hooks) can close over it.
  const onQuerySuccessRef = useRef(onQuerySuccess);
  useEffect(() => {
    onQuerySuccessRef.current = onQuerySuccess;
  });
  // Each real result is a new object, so this fires once per successful run.
  useEffect(() => {
    if (sampleMode || !sqlEnabled || !data || data.data.length === 0) return;
    onQuerySuccessRef.current?.();
  }, [data, sampleMode, sqlEnabled]);

  const activeData = sampleMode ? sampleResult : data;
  const activeLoading = sampleMode ? sampleResult === null && lastRunSql !== null : queryLoading;
  const activeError = sampleMode ? null : queryError;
  // SQL whose results are on screen. Real mode uses executedSql (the query
  // TinyBird actually ran); sample mode uses lastRunSql. Keyed on sampleMode so
  // a stale real-mode executedSql can't get paired with sample rows.
  const explainResultsSql = sampleMode ? (lastRunSql ?? "") : (executedSql ?? lastRunSql ?? "");

  // NL → SQL. On success the SQL drops into the editor (SqlEditor.externalValue
  // replaces content AND focuses it); on abstention only the clarifying question
  // shows — no SQL is injected. The result is dropped if the user ran a query
  // while it was in flight (runSeq guard).
  const handleAiGenerate = useCallback(
    async (prompt: string) => {
      if (activeDatasources.length === 0) {
        setAiProposal({
          explanation: null,
          assumptions: [],
          clarifyingQuestion: "No datasources are available to query yet, so I can't write SQL.",
        });
        return;
      }
      const seq = runSeqRef.current;
      const conversationSeq = conversationSeqRef.current;
      setAiProposal(null);
      // Reset the announcement first so an identical consecutive outcome still
      // re-fires the aria-live region for screen-reader users.
      setAiAnnouncement("");
      const outgoingTurns = turns.slice(-10);
      const sqlIsStaleFromReset =
        staleSqlAtResetRef.current !== null && currentSql === staleSqlAtResetRef.current;
      const res = await aiTranslate({
        mode: "nl_to_sql",
        prompt,
        sql: sqlIsStaleFromReset ? undefined : currentSql || undefined,
        turns: outgoingTurns.length ? outgoingTurns : undefined,
        schema: activeDatasources,
      });
      if (!res || seq !== runSeqRef.current || conversationSeq !== conversationSeqRef.current)
        return;
      staleSqlAtResetRef.current = null;
      setTurns((previous) => [...previous, { prompt, sql: res.sql }]);
      setAiProposal({
        explanation: res.explanation,
        assumptions: res.assumptions,
        clarifyingQuestion: res.clarifyingQuestion,
      });
      if (res.sql) {
        setExternalSql(res.sql);
        setAiAnnouncement("Query generated — review and run");
      } else {
        setAiAnnouncement("The assistant needs a bit more detail");
      }
    },
    [aiTranslate, activeDatasources, currentSql, turns]
  );

  // SQL → plain English for whatever is currently in the editor. A query run
  // doesn't change the editor, so no runSeq guard is needed here.
  const handleAiExplainSql = useCallback(async () => {
    const sql = currentSql.trim();
    if (!sql) return;
    setAiProposal(null);
    setAiAnnouncement("");
    const res = await aiTranslate({ mode: "sql_to_nl", sql, schema: activeDatasources });
    if (!res) return;
    setAiProposal({
      explanation: res.explanation,
      assumptions: res.assumptions,
      clarifyingQuestion: null,
    });
    setAiAnnouncement("Explanation ready");
  }, [aiTranslate, currentSql, activeDatasources]);

  // Auto-fix a failed query, guarded to one attempt per distinct error.
  const handleAiFix = useCallback(async () => {
    if (!queryError || !lastRunSql) return;
    const seq = runSeqRef.current;
    setAiProposal(null);
    setAiAnnouncement("");
    setFixAttemptedFor(queryError);
    const res = await aiTranslate({
      mode: "fix",
      sql: lastRunSql,
      previousError: queryError,
      schema: activeDatasources,
    });
    // Transport failure or superseded by a new run: release the one-attempt
    // guard so the user can retry.
    if (!res || seq !== runSeqRef.current) {
      setFixAttemptedFor(null);
      return;
    }
    setAiProposal({
      explanation: res.explanation,
      assumptions: res.assumptions,
      clarifyingQuestion: res.clarifyingQuestion,
    });
    if (res.sql) {
      setExternalSql(res.sql);
      setAiAnnouncement("Fixed query ready — review and run");
    } else {
      // Abstained (no SQL): keep the fix button so the user can retry rather
      // than leaving it hidden with feedback only in the bar above.
      setFixAttemptedFor(null);
      setAiAnnouncement("The assistant needs more detail to fix this");
    }
  }, [aiTranslate, queryError, lastRunSql, activeDatasources]);

  // Explain the on-screen results — the hook caps the row sample to 50 and the
  // server re-caps; rows are never logged. Dropped if a new run superseded them.
  const handleExplainResults = useCallback(async () => {
    if (!activeData) return;
    const seq = runSeqRef.current;
    setResultsSummary(null);
    const res = await aiExplainResults({
      sql: explainResultsSql,
      columns: activeData.meta,
      rows: activeData.data,
    });
    if (res && seq === runSeqRef.current) setResultsSummary(res.summary);
  }, [aiExplainResults, activeData, explainResultsSql]);

  // Loading state
  if (isLoading) {
    return (
      <main className="space-y-6" aria-busy="true">
        <PageHeader title="Spindle" description="SQL Workbench" />
        <div className="space-y-4">
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
      </main>
    );
  }

  // Token error (network blip, auth issue) — show retry, not upgrade CTA
  if (error && !sampleMode) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <div className="flex max-w-md flex-col items-center gap-4 text-center" role="alert">
          <div className="bg-muted rounded-full p-4">
            <AlertCircle className="text-muted-foreground h-8 w-8" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h1 className="text-foreground text-xl font-semibold">Unable to Load SQL Workbench</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">{error.message}</p>
          </div>
          <div className="mt-2 flex gap-3">
            <Button onClick={() => void retry()}>Try Again</Button>
            <Button
              variant="outline"
              onClick={() => {
                clearConversation();
                setSampleMode(true);
              }}
            >
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
              View Sample Data
            </Button>
          </div>
        </div>
      </main>
    );
  }

  // Tier gating (with sample mode bypass)
  if (!sqlEnabled && !sampleMode) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <div className="flex max-w-md flex-col items-center gap-4 text-center" role="alert">
          <div className="bg-muted rounded-full p-4">
            <Lock className="text-muted-foreground h-8 w-8" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h1 className="text-foreground text-xl font-semibold">SQL Workbench Unavailable</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              The SQL Workbench is available on Analytics plans. Upgrade your plan to query your
              loyalty data with SQL.
            </p>
          </div>
          <div className="mt-2 flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                clearConversation();
                setSampleMode(true);
              }}
            >
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
              View Sample Data
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-expanded={sidebarOpen}
            aria-label={sidebarOpen ? "Hide schema browser" : "Show schema browser"}
            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md p-1.5 transition-colors"
          >
            {sidebarOpen ? (
              <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          <div>
            <h1 className="text-foreground font-serif text-2xl font-bold">Spindle</h1>
            <p className="text-muted-foreground text-sm">SQL Workbench</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ExamplesDropdown
            nlExamples={starters}
            onAsk={(q) => void handleAiGenerate(q)}
            onSelectSql={(sql) => {
              clearConversation();
              setExternalSql(sql);
            }}
          />
          <SavedQueriesPanel
            queries={queries}
            onLoad={(q) => {
              clearConversation();
              setExternalSql(q.sql);
            }}
            onSave={save}
            onDelete={remove}
            onToggleFavorite={toggleFavorite}
            currentSql={currentSql}
          />
        </div>
      </header>

      <SampleDataBanner hasRealData={!sampleMode} />

      {drilldownNotice && (
        <div
          className="border-border bg-muted/40 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
          role="status"
        >
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Telescope className="text-primary h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {drilldownNotice.mode === "sql" ? "Drilled in from " : "No saved query for "}
              <span className="text-foreground font-medium">{drilldownNotice.title}</span>
              {drilldownNotice.mode === "ask" && " — review the question and ask"}
            </span>
          </p>
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
            <a href={analyticsHref}>
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Back to Analytics
            </a>
          </Button>
        </div>
      )}

      {/* Main 3-panel layout */}
      <div className="flex min-h-0 flex-1 gap-4">
        {/* Schema sidebar — hidden on mobile, collapsible */}
        {sidebarOpen && (
          <aside className="border-border bg-card w-60 shrink-0 overflow-y-auto rounded-lg border">
            <SchemaBrowser
              tables={activeDatasources.map((ds) => ({
                name: ds.name,
                description: ds.description,
                columns: ds.columns,
              }))}
              onInsert={handleInsert}
            />
          </aside>
        )}

        {/* Editor + Results */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {/* Ask AI + SQL Editor. Two distinct landmark regions — the
              assistant labels itself, and the editor keeps its own "SQL editor"
              label (the wrapper is a plain div so neither label is misleading). */}
          <div className="flex flex-col gap-3">
            <AskAiAssistant
              onGenerate={handleAiGenerate}
              onExplain={handleAiExplainSql}
              canExplain={currentSql.trim().length > 0}
              isLoading={aiLoading}
              error={aiError}
              limit={aiLimit}
              assumptions={aiProposal?.assumptions ?? []}
              explanation={aiProposal?.explanation ?? null}
              clarifyingQuestion={aiProposal?.clarifyingQuestion ?? null}
              generatedAnnouncement={aiAnnouncement}
              // Retrospective, not forward-looking: names what the SQL currently
              // on screen continued from, i.e. the ask BEFORE the one that's still
              // sitting in the input. On the first ask there's no earlier question
              // yet, so this stays null until a second ask has actually happened.
              previousQuestion={turns.length > 1 ? turns[turns.length - 2]!.prompt : null}
              onNewConversation={clearConversation}
              prefillPrompt={askPrefill}
              onPrefillConsumed={() => setAskPrefill(null)}
            />
            <section aria-label="SQL editor">
              <SqlEditor
                onRun={handleRun}
                onChange={setCurrentSql}
                isRunning={activeLoading}
                schema={schemaMap}
                externalValue={externalSql}
                onExternalValueConsumed={handleExternalValueConsumed}
                insertAtCursor={insertText}
                onInsertConsumed={handleInsertConsumed}
              />
            </section>
          </div>

          {/* Results */}
          <section aria-label="Query results" className="min-h-0 flex-1 overflow-auto">
            {activeError ? (
              <div
                className="border-border flex flex-col items-center justify-center gap-3 rounded-lg border py-12 text-center"
                role="alert"
                aria-live="assertive"
              >
                <Database className="text-destructive h-8 w-8" aria-hidden="true" />
                <p className="text-destructive max-w-lg px-4 font-mono text-sm">{activeError}</p>
                {!sampleMode && lastRunSql && fixAttemptedFor !== activeError && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleAiFix()}
                    disabled={aiLoading}
                    aria-busy={aiLoading}
                    className="border-accent/40 text-accent-dark hover:bg-accent/10"
                  >
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    {aiLoading ? "Fixing…" : "Try to fix with AI"}
                  </Button>
                )}
              </div>
            ) : activeData ? (
              <div className="flex flex-col gap-3">
                {!sampleMode && (
                  <div className="flex flex-col items-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleExplainResults()}
                      disabled={aiExplainLoading}
                      aria-busy={aiExplainLoading}
                      className="border-accent/40 text-accent-dark hover:bg-accent/10"
                    >
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      {aiExplainLoading ? "Summarizing…" : "Explain results"}
                    </Button>
                    {aiExplainLimit && <AiLimitNotice limit={aiExplainLimit} />}
                    {aiExplainError && !aiExplainLimit && (
                      <p role="alert" className="text-destructive text-xs">
                        {aiExplainError}
                      </p>
                    )}
                  </div>
                )}
                <ResultVisualization
                  key={executedSql ?? "sample"}
                  resultKey={executedSql ?? "sample"}
                  columns={activeData.meta}
                  rows={activeData.data}
                  totalRows={activeData.rows_before_limit_at_least}
                  limitApplied={limitApplied}
                  statistics={activeData.statistics}
                  onExportCsv={sampleMode ? undefined : handleExportCsv}
                  isExporting={isExporting}
                />
                {resultsSummary && (
                  <div
                    role="note"
                    aria-label="Results summary"
                    className="border-accent/30 bg-accent/5 text-foreground rounded-lg border px-3 py-2 text-sm leading-relaxed"
                  >
                    <p className="text-accent-dark mb-1 flex items-center gap-1.5 text-xs font-semibold">
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Summary
                    </p>
                    {resultsSummary}
                  </div>
                )}
              </div>
            ) : activeLoading ? (
              <div className="border-border space-y-2 rounded-lg border p-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-3/4" />
              </div>
            ) : (
              <div className="border-border flex flex-col items-center justify-center gap-3 rounded-lg border py-16 text-center">
                <Database className="text-muted-foreground/30 h-12 w-12" aria-hidden="true" />
                <p className="text-muted-foreground text-sm">Run a query to see results</p>
                <p className="text-muted-foreground/70 text-xs">
                  Try an example from the dropdown above, or write your own SQL
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
