import type {
  OrchestrationV2TurnItemStatus,
  OrchestrationV2WebSearchResult,
} from "@t3tools/contracts";
import { WebSearch as RareWebSearch } from "./rare-web-search";

export function WebSearch({
  patterns = [],
  results = [],
  status,
}: {
  patterns?: readonly string[] | undefined;
  results?: readonly OrchestrationV2WebSearchResult[] | undefined;
  status: OrchestrationV2TurnItemStatus;
}) {
  const sources = [
    ...new Map(results.map((result) => [JSON.stringify(result), result])).entries(),
  ].map(([id, result]) => ({
    id,
    title: result.title?.trim() || result.url || "Search result",
    url: result.url || "",
    ...(result.snippet ? { snippet: result.snippet } : {}),
  }));
  const searching = status === "running" || status === "pending";
  const label = searching
    ? undefined
    : status === "failed"
      ? "Search failed"
      : status === "cancelled" || status === "interrupted"
        ? "Search stopped"
        : status === "waiting" || status === "idle"
          ? "Search waiting"
          : sources.length > 0
            ? `Searched ${sources.length} ${sources.length === 1 ? "source" : "sources"}`
            : "Searched the web";
  return (
    <RareWebSearch
      data-status={status}
      sources={sources}
      status={searching ? "searching" : "done"}
      query={patterns.join(" · ")}
      {...(label ? { label } : {})}
      defaultOpen={false}
    />
  );
}
