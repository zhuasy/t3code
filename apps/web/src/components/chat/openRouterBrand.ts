import aws from "./openRouterLogos/aws.svg";
import bytedance from "./openRouterLogos/bytedance.svg";
import claude from "./openRouterLogos/claude.svg";
import cohere from "./openRouterLogos/cohere.svg";
import deepseek from "./openRouterLogos/deepseek.svg";
import fireworks from "./openRouterLogos/fireworks.svg";
import gemini from "./openRouterLogos/gemini.svg";
import grok from "./openRouterLogos/grok.svg";
import ibm from "./openRouterLogos/ibm.svg";
import inception from "./openRouterLogos/inception.svg";
import liquid from "./openRouterLogos/liquid.svg";
import meta from "./openRouterLogos/meta.svg";
import minimax from "./openRouterLogos/minimax.svg";
import mistral from "./openRouterLogos/mistral.svg";
import moonshot from "./openRouterLogos/moonshot.svg";
import nvidia from "./openRouterLogos/nvidia.svg";
import openai from "./openRouterLogos/openai.svg";
import openrouter from "./openRouterLogos/openrouter.svg";
import perceptron from "./openRouterLogos/perceptron.svg";
import qwen from "./openRouterLogos/qwen.svg";
import reflection from "./openRouterLogos/reflection.svg";
import reka from "./openRouterLogos/reka.svg";
import relace from "./openRouterLogos/relace.svg";
import stepfun from "./openRouterLogos/stepfun.svg";
import tencent from "./openRouterLogos/tencent.svg";
import typesafeai from "./openRouterLogos/typesafeai.svg";
import upstage from "./openRouterLogos/upstage.svg";
import xiaomimimo from "./openRouterLogos/xiaomimimo.svg";
import zai from "./openRouterLogos/zai.svg";

const logos: Record<string, string> = {
  anthropic: claude,
  openai: openai,
  google: gemini,
  deepseek: deepseek,
  moonshotai: moonshot,
  qwen: qwen,
  "z-ai": zai,
  mistralai: mistral,
  "x-ai": grok,
  minimax: minimax,
  "bytedance-seed": bytedance,
  amazon: aws,
  "meta-llama": meta,
  meta: meta,
  nvidia: nvidia,
  openrouter: openrouter,
  xiaomi: xiaomimimo,
  inception: inception,
  stepfun: stepfun,
  tencent: tencent,
  upstage: upstage,
  cohere: cohere,
  fireworks: fireworks,
  "ibm-granite": ibm,
  liquid: liquid,
  perceptron: perceptron,
  reflection: reflection,
  rekaai: reka,
  relace: relace,
  typesafe: typesafeai,
};

export function openRouterBrand(slug: string) {
  if (!slug.startsWith("openrouter/")) return undefined;
  const company = slug.split("/")[1]?.replace(/^~/, "");
  if (!company) return undefined;
  return { company, logo: logos[company], initials: company.slice(0, 2).toUpperCase() };
}
