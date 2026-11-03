import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as AcpSessionRuntime from "@t3tools/provider-acp/server/AcpSessionRuntime";

const peer = `
const readline = require('node:readline');
let value = 'normal';
const options = () => [{id:'version',name:'Version',type:'select',currentValue:value,options:[{value:'normal',name:'Normal'},{value:'fast',name:'Fast'}]}];
readline.createInterface({input:process.stdin}).on('line', line => {
 const request=JSON.parse(line);
 const result = request.method==='initialize' ? {protocolVersion:1,agentInfo:{name:'fixture',version:'1'},agentCapabilities:{loadSession:true}} :
 request.method==='session/new' ? {sessionId:'fixture',configOptions:options()} :
 request.method==='session/load' ? {configOptions:options()} :
 request.method==='session/set_config_option' ? (value=request.params.value,{configOptions:options()}) : {};
 console.log(JSON.stringify({jsonrpc:'2.0',id:request.id,result}));
});
`;

it.live("keeps native model configuration through setup, selection, and session loading", () =>
  Effect.gen(function* () {
    const runtime = yield* AcpSessionRuntime.AcpSessionRuntime;
    const started = yield* runtime.start();
    expect(started.modelConfigId).toBe("version");
    expect(started.sessionSetupResult.configOptions?.[0]?.category).toBe("model");
    yield* runtime.setConfigOption("version", "fast");
    expect((yield* runtime.getConfigOptions)[0]).toMatchObject({
      category: "model",
      currentValue: "fast",
    });
    const loaded = yield* runtime.loadSession("fixture");
    expect(loaded.modelConfigId).toBe("version");
    expect(loaded.sessionSetupResult.configOptions?.[0]).toMatchObject({
      category: "model",
      currentValue: "fast",
    });
  }).pipe(
    Effect.scoped,
    Effect.provide(
      AcpSessionRuntime.layer({
        spawn: {
          command: process.execPath,
          args: ["-e", peer],
          cwd: process.cwd(),
          env: process.env,
          shell: false,
        },
        cwd: process.cwd(),
        clientInfo: { name: "test", version: "1" },
        normalizeConfigOptions: (options) =>
          options.map((option) => ({ ...option, category: "model" })),
      }).pipe(Layer.provide(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer))),
    ),
  ),
);
