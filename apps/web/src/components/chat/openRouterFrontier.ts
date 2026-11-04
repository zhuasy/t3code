const allowedOpenRouterModels = new Set([
  "google/gemini-3.8-flash",
  "x-ai/grok-4.7",
  "deepseek/deepseek-v4.1-flash-1017",
  "moonshotai/kimi-k3.1-pro",
  "z-ai/glm-5.3-prime",
  "qwen/qwen3.8-max-prime",
  "minimax/minimax-m3.1-flash",
  "meta/muse-wonder",
  "meta/muse-spark-open",
  "xiaomi/mimo-v2.6-pro",
  "stepfun/step-5-preview",
  "mistralai/mistral-large-4-0",
]);

export function isPiPickerModel(slug: string): boolean {
  if (slug === "morph/morph-dsv41flash-abliterated") return true;
  // Direct Gemini API key models, not OpenRouter.
  if (slug === "google/gemini-4-argon") return true;
  if (!slug.startsWith("openrouter/")) return false;
  return allowedOpenRouterModels.has(slug.slice("openrouter/".length).replace(/^~/, ""));
}
