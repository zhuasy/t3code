import { describe, expect, it } from "@effect/vitest";
import type * as AcpSchema from "effect-acp/compat";
import { devinRuntimeOptions, normalizeDevinConfigOptions } from "./devinAcp.ts";
import { normalizeAcpRegistryLiveConfiguration } from "./probe.ts";

describe("native Devin configuration", () => {
  it("uses one version selector and preserves native session settings", () => {
    const options: ReadonlyArray<AcpSchema.SessionConfigOption> = [
      {
        id: "org_id",
        name: "Organization",
        type: "select",
        currentValue: "",
        options: [{ value: "", name: "Default" }],
      },
      {
        id: "devin_version",
        name: "Version",
        type: "select",
        currentValue: "devin-auto",
        options: [{ value: "devin-auto", name: "Fusion" }],
      },
      {
        id: "repos",
        name: "Repositories",
        type: "select",
        currentValue: "repo",
        options: [{ value: "repo", name: "Repository" }],
      },
      {
        id: "persona_slug",
        name: "Persona",
        type: "select",
        currentValue: "",
        options: [{ value: "", name: "Default" }],
      },
      {
        id: "platform",
        name: "Platform",
        type: "select",
        currentValue: "linux",
        options: [{ value: "linux", name: "Linux" }],
      },
    ];
    const normalized = normalizeDevinConfigOptions(options);
    const configuration = normalizeAcpRegistryLiveConfiguration(normalized);
    expect(configuration.models.map((m) => m.id)).toEqual(["devin-auto"]);
    expect(configuration.configOptions.map((o) => o.id)).toEqual([
      "org_id",
      "repos",
      "persona_slug",
      "platform",
    ]);
    expect(
      configuration.configOptions.some((o) => o.type === "select" && o.role === "reasoning"),
    ).toBe(false);
    expect(normalized.filter((o) => o.category === "model")).toHaveLength(1);
    expect(normalized[0]).toBe(options[0]);
    expect(options[1]?.category).toBeUndefined();
    const reasoning: AcpSchema.SessionConfigOption = {
      id: "reasoning",
      name: "Reasoning",
      category: "thought_level",
      type: "select",
      currentValue: "high",
      options: [{ value: "high", name: "High" }],
    };
    expect(normalizeDevinConfigOptions([reasoning])).toEqual([reasoning]);
  });

  it("limits native configuration handling to the Devin registry adapter", () => {
    expect(
      devinRuntimeOptions({ source: "registry", agentId: "devin" }).normalizeConfigOptions,
    ).toBe(normalizeDevinConfigOptions);
    expect(devinRuntimeOptions({ source: "registry", agentId: "other" })).toEqual({});
    expect(devinRuntimeOptions({ source: "local", agentId: "devin" })).toEqual({});
  });
});
