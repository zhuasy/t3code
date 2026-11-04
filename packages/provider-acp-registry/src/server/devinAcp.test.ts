import { describe, expect, it } from "@effect/vitest";
import type * as AcpSchema from "effect-acp/compat";
import {
  devinCloudModels,
  normalizeDevinSessionUpdate,
  devinRuntimeOptions,
  isDevinAcp,
  normalizeDevinConfigOptions,
} from "./devinAcp.ts";
import { buildRuntimeInstructions } from "@t3tools/provider-core/server/runtimeInstructions";
import { normalizeAcpRegistryLiveConfiguration } from "./probe.ts";

describe("native Devin configuration", () => {
  it("keeps injected prompt instructions out of Devin user-message echoes", () => {
    const prompt =
      "<t3_code_instructions>\nInternal guidance\n</t3_code_instructions>\n\n<user_request>\nTesting\n</user_request>\n\n<runtime_info>Internal runtime</runtime_info>";
    const notification: AcpSchema.SessionNotification = {
      sessionId: "session",
      update: {
        sessionUpdate: "user_message",
        messageId: "echo",
        content: [{ type: "text", text: prompt }],
      },
    };
    expect(normalizeDevinSessionUpdate(notification)).toEqual({
      ...notification,
      update: { ...notification.update, content: [{ type: "text", text: "Testing" }] },
    });
    for (const pullRequestLinking of [true, false]) {
      const runtime = buildRuntimeInstructions({
        harness: "acpRegistry",
        model: "devin-ultra",
        pullRequestLinking,
      });
      const echo: AcpSchema.SessionNotification = {
        ...notification,
        update: {
          sessionUpdate: "user_message",
          messageId: "runtime-echo",
          content: [{ type: "text", text: `Test\n\n${runtime}` }],
        },
      };
      expect(normalizeDevinSessionUpdate(echo)).toEqual({
        ...echo,
        update: { ...echo.update, content: [{ type: "text", text: "Test" }] },
      });
    }
    const ordinary: AcpSchema.SessionNotification = {
      ...notification,
      update: {
        sessionUpdate: "user_message",
        messageId: "ordinary",
        content: [{ type: "text", text: "Explain <user_request> tags" }],
      },
    };
    expect(normalizeDevinSessionUpdate(ordinary)).toEqual(ordinary);
  });

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
        options: [
          { value: "devin-swe-2-lightning-high", name: "SWE-2 High (Lightning)" },
          { value: "devin_lite", name: "Lite" },
          { value: "devin-fast-opus", name: "Fast" },
          { value: "devin-auto", name: "Fusion" },
          { value: "devin-2-5", name: "Normal" },
          { value: "devin-ultra", name: "Ultra" },
        ],
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
    expect(devinCloudModels(configuration.models).map((m) => ({ id: m.id, name: m.name }))).toEqual(
      [
        { id: "devin-auto", name: "Fusion" },
        { id: "devin-ultra", name: "Ultra" },
        { id: "devin-2-5", name: "Normal" },
        { id: "devin_lite", name: "Lite" },
      ],
    );
    expect(configuration.currentModelId).toBe("devin-auto");
    expect(configuration.models).toHaveLength(6);
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
    const localModel: AcpSchema.SessionConfigOption = {
      id: "model",
      name: "Model",
      category: "model",
      type: "select",
      currentValue: "gpt-6-sol-medium",
      options: [{ value: "gpt-6-sol-medium", name: "GPT-6 Sol" }],
    };
    expect(normalizeDevinConfigOptions([localModel, reasoning])).toEqual([localModel, reasoning]);
  });

  it("recognizes registry and explicitly configured local Devin instances", () => {
    expect(
      devinRuntimeOptions({ source: "registry", agentId: "devin" }).normalizeConfigOptions,
    ).toBe(normalizeDevinConfigOptions);
    for (const source of ["registry", "local"]) {
      expect(devinRuntimeOptions({ source, agentId: "devin" })).toMatchObject({
        cancelBehavior: "wait-for-prompt",
      });
    }
    expect(devinRuntimeOptions({ source: "registry", agentId: "other" })).toEqual({});
    expect(devinRuntimeOptions({ source: "local", agentId: "devin" }).normalizeConfigOptions).toBe(
      normalizeDevinConfigOptions,
    );
    expect(isDevinAcp({ source: "local", agentId: "", commandPath: "/usr/local/bin/devin" })).toBe(
      true,
    );
    expect(isDevinAcp({ source: "local", agentId: "", commandPath: "C:\\tools\\devin.exe" })).toBe(
      true,
    );
    expect(isDevinAcp({ source: "local", agentId: "", commandPath: "other" })).toBe(false);
  });
});
