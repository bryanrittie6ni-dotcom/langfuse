import {
  BatchExportFileFormat,
  BatchTableNames,
  type BatchExportTableName,
  type FilterState,
  type OrderByState,
  type TracingSearchType,
  tracesTableCols,
  observationsTableCols,
} from "@langfuse/shared";
import {
  queryClickhouse,
  createFilterFromFilterState,
  FilterList,
  StringFilter,
  clickhouseSearchCondition,
  tracesTableUiColumnDefinitions,
  observationsTableUiColumnDefinitions,
  scoresTableUiColumnDefinitions,
  stringifyForCsv,
} from "@langfuse/shared/src/server";

const ROW_LIMIT = 50000;

function buildClickedHouseConfigs() {
  return {
    request_timeout: 180_000,
    clickhouse_settings: {
      join_algorithm: "partial_merge" as const,
      http_send_timeout: 300,
      http_receive_timeout: 300,
    },
  };
}

async function buildFilterForTable(
  tableName: BatchExportTableName,
  projectId: string,
  filter: FilterState,
  searchQuery?: string,
  searchType?: TracingSearchType[],
  cutoffCreatedAt?: Date,
) {
  let columnDefs;
  let tableCols;
  let tableAlias: string;

  switch (tableName) {
    case BatchTableNames.Traces:
    case "traces":
      columnDefs = tracesTableUiColumnDefinitions;
      tableCols = tracesTableCols;
      tableAlias = "t";
      break;
    case BatchTableNames.Observations:
    case "observations":
      columnDefs = observationsTableUiColumnDefinitions;
      tableCols = observationsTableCols;
      tableAlias = "o";
      break;
    case BatchTableNames.Scores:
    case "scores":
      columnDefs = scoresTableUiColumnDefinitions;
      tableCols = observationsTableCols;
      tableAlias = "s";
      break;
    case BatchTableNames.Sessions:
    case "sessions":
      columnDefs = tracesTableUiColumnDefinitions;
      tableCols = tracesTableCols;
      tableAlias = "s";
      break;
    default:
      columnDefs = tracesTableUiColumnDefinitions;
      tableCols = tracesTableCols;
      tableAlias = "t";
  }

  // Filter out columns that don't belong to this table
  const validFilters = (filter ?? []).filter((f) => {
    const col = columnDefs.find(
      (c) => c.uiTableName === f.column || c.uiTableId === f.column,
    );
    return col != null;
  });

  const filterConditions = [...validFilters];
  if (cutoffCreatedAt) {
    const tsCol =
      tableName === BatchTableNames.Sessions ? "createdAt" : "timestamp";
    filterConditions.push({
      column: tsCol,
      operator: "<" as const,
      value: cutoffCreatedAt,
      type: "datetime" as const,
    });
  }

  const tableFilter = new FilterList([]);
  tableFilter.push(
    ...createFilterFromFilterState(filterConditions, columnDefs, tableCols),
  );

  const search = clickhouseSearchCondition({
    query: searchQuery,
    searchType,
    tablePrefix: tableAlias,
  });

  return {
    appliedFilter: tableFilter.apply(),
    search,
    rowLimit: ROW_LIMIT,
    projectIdParam: { projectId },
  };
}

function buildTracesQuery(params: Awaited<ReturnType<typeof buildFilterForTable>>) {
  const { appliedFilter, search, rowLimit, projectIdParam } = params;
  const query = `
    SELECT
      t.id, t.project_id, t.timestamp, t.name, t.user_id, t.session_id,
      t.release, t.version, t.tags, t.bookmarked, t.public,
      t.input, t.output, t.metadata, t.created_at, t.updated_at
    FROM traces t
    WHERE t.project_id = {projectId: String}
      ${appliedFilter.query ? `AND ${appliedFilter.query}` : ""}
      ${search.query}
    LIMIT 1 BY id, project_id
    LIMIT {rowLimit: Int64}
  `;
  return { query, queryParams: { ...projectIdParam, rowLimit, ...appliedFilter.params, ...search.params } };
}

function buildObservationsQuery(params: Awaited<ReturnType<typeof buildFilterForTable>>) {
  const { appliedFilter, search, rowLimit, projectIdParam } = params;
  const query = `
    SELECT
      o.id, o.project_id, o.trace_id, o.start_time, o.end_time,
      o.name, o.type, o.level, o.input, o.output,
      o.metadata, o.model, o.model_parameters, o.prompt_id,
      o.prompt_name, o.prompt_version, o.usage_details, o.cost_details,
      o.total_cost, o.completion_tokens, o.prompt_tokens, o.total_tokens,
      o.created_at, o.updated_at
    FROM observations o
    WHERE o.project_id = {projectId: String}
      ${appliedFilter.query ? `AND ${appliedFilter.query}` : ""}
      ${search.query}
    ORDER BY o.start_time DESC
    LIMIT {rowLimit: Int64}
  `;
  return { query, queryParams: { ...projectIdParam, rowLimit, ...appliedFilter.params, ...search.params } };
}

function buildScoresQuery(params: Awaited<ReturnType<typeof buildFilterForTable>>) {
  const { appliedFilter, search, rowLimit, projectIdParam } = params;
  const query = `
    SELECT
      s.id, s.project_id, s.trace_id, s.observation_id,
      s.name, s.value, s.string_value, s.data_type, s.source,
      s.timestamp, s.created_at, s.updated_at
    FROM scores s
    WHERE s.project_id = {projectId: String}
      ${appliedFilter.query ? `AND ${appliedFilter.query}` : ""}
      ${search.query}
    ORDER BY s.timestamp DESC
    LIMIT {rowLimit: Int64}
  `;
  return { query, queryParams: { ...projectIdParam, rowLimit, ...appliedFilter.params, ...search.params } };
}

function buildSessionsQuery(params: Awaited<ReturnType<typeof buildFilterForTable>>) {
  const { appliedFilter, search, rowLimit, projectIdParam } = params;
  const query = `
    SELECT
      s.id, s.project_id, s.created_at, s.session_id, s.user_id
    FROM sessions s
    WHERE s.project_id = {projectId: String}
      ${appliedFilter.query ? `AND ${appliedFilter.query}` : ""}
      ${search.query}
    ORDER BY s.created_at DESC
    LIMIT {rowLimit: Int64}
  `;
  return { query, queryParams: { ...projectIdParam, rowLimit, ...appliedFilter.params, ...search.params } };
}

/** Escape a CSV field so it handles commas, quotes, and newlines safely. */
function escapeCsvField(value: unknown): string {
  const raw = stringifyForCsv(value);
  if (
    raw.includes(",") ||
    raw.includes('"') ||
    raw.includes("\n") ||
    raw.includes("\r")
  ) {
    return '"' + raw.replace(/"/g, '""') + '"';
  }
  return raw;
}

function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsvField(row[h])).join(","));
  }
  return lines.join("\n");
}

function rowsToJson(rows: Record<string, unknown>[]): string {
  return JSON.stringify(rows, null, 2);
}

function rowsToJsonl(rows: Record<string, unknown>[]): string {
  return rows.map((r) => JSON.stringify(r)).join("\n");
}

export async function exportData(opts: {
  projectId: string;
  tableName: BatchExportTableName;
  filter: FilterState;
  searchQuery?: string;
  searchType?: TracingSearchType[];
  orderBy?: OrderByState;
  format: BatchExportFileFormat;
}): Promise<{ data: string; fileName: string }> {
  const { projectId, tableName, filter, searchQuery, searchType, format } = opts;

  const filterParams = await buildFilterForTable(
    tableName, projectId, filter, searchQuery, searchType, new Date(),
  );

  let queryResult: { query: string; queryParams: Record<string, unknown> };
  switch (tableName) {
    case BatchTableNames.Traces: case "traces":
      queryResult = buildTracesQuery(filterParams); break;
    case BatchTableNames.Observations: case "observations":
      queryResult = buildObservationsQuery(filterParams); break;
    case BatchTableNames.Scores: case "scores":
      queryResult = buildScoresQuery(filterParams); break;
    case BatchTableNames.Sessions: case "sessions":
      queryResult = buildSessionsQuery(filterParams); break;
    default:
      queryResult = buildTracesQuery(filterParams);
  }

  const rows = await queryClickhouse<Record<string, unknown>>({
    query: queryResult.query,
    params: queryResult.queryParams,
    clickhouseConfigs: buildClickedHouseConfigs(),
    tags: { feature: "batch-export-download", type: tableName, kind: "export", projectId },
  });

  let data: string;
  switch (format) {
    case "CSV":
      data = rowsToCsv(rows); break;
    case "JSON":
      data = rowsToJson(rows); break;
    case "JSONL":
      data = rowsToJsonl(rows); break;
    default:
      data = rowsToCsv(rows);
  }

  const ext = format === "CSV" ? "csv" : format === "JSON" ? "json" : "jsonl";
  const fileName = `${tableName}-export-${new Date().toISOString().slice(0, 10)}.${ext}`;

  return { data, fileName };
}
