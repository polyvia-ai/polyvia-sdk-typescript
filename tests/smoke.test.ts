import { describe, expect, it } from "vitest";
import {
  APIError,
  AuthenticationError,
  ForbiddenError,
  IngestionError,
  IngestionTimeout,
  MCPConfig,
  NotFoundError,
  Polyvia,
  PolyviaError,
  RateLimitError,
  VERSION,
} from "../src/index.js";

describe("exports", () => {
  it("exposes VERSION string", () => {
    expect(typeof VERSION).toBe("string");
    expect(VERSION.length).toBeGreaterThan(0);
  });

  it("exports all public classes", () => {
    expect(Polyvia).toBeDefined();
    expect(MCPConfig).toBeDefined();
  });
});

describe("Polyvia constructor", () => {
  it("throws when no api key is available", () => {
    const original = process.env["POLYVIA_API_KEY"];
    delete process.env["POLYVIA_API_KEY"];
    expect(() => new Polyvia()).toThrow(/api_key/);
    if (original !== undefined) process.env["POLYVIA_API_KEY"] = original;
  });

  it("accepts an explicit api key", () => {
    const client = new Polyvia({ apiKey: "poly_test" });
    expect(client).toBeDefined();
    expect(client.ingest).toBeDefined();
    expect(client.documents).toBeDefined();
    expect(client.groups).toBeDefined();
    expect(client.tools).toBeDefined();
  });

  it("reads api key from env var", () => {
    process.env["POLYVIA_API_KEY"] = "poly_env_test";
    const client = new Polyvia();
    expect(client).toBeDefined();
    delete process.env["POLYVIA_API_KEY"];
  });
});

describe("MCPConfig", () => {
  let mcp: MCPConfig;

  beforeEach(() => {
    const client = new Polyvia({ apiKey: "poly_test" });
    mcp = client.mcp;
  });

  it("toAnthropicMcpServer returns correct shape", () => {
    const cfg = mcp.toAnthropicMcpServer();
    expect(cfg.type).toBe("url");
    expect(cfg.url).toContain("polyvia.ai/mcp");
    expect(cfg.headers["Authorization"]).toContain("poly_test");
    expect(cfg.name).toBe("polyvia");
  });

  it("toOpenAIResponsesTool returns correct shape", () => {
    const cfg = mcp.toOpenAIResponsesTool();
    expect(cfg.type).toBe("mcp");
    expect(cfg.server_url).toContain("polyvia.ai/mcp");
    expect(cfg.require_approval).toBe("never");
  });

  it("toOpenAIMcpServer returns url and headers", () => {
    const cfg = mcp.toOpenAIMcpServer();
    expect(cfg.url).toContain("polyvia.ai/mcp");
    expect(cfg.headers).toBeDefined();
  });

  it("toClaudeDesktopConfig returns correct shape", () => {
    const cfg = mcp.toClaudeDesktopConfig();
    expect(cfg.type).toBe("http");
    expect(cfg.url).toContain("polyvia.ai/mcp");
  });
});

describe("error hierarchy", () => {
  it("all errors extend PolyviaError", () => {
    expect(new AuthenticationError(401, "x")).toBeInstanceOf(PolyviaError);
    expect(new NotFoundError(404, "x")).toBeInstanceOf(PolyviaError);
    expect(new RateLimitError(429, "x")).toBeInstanceOf(PolyviaError);
    expect(new ForbiddenError(403, "x")).toBeInstanceOf(PolyviaError);
    expect(new IngestionError("t1", "fail")).toBeInstanceOf(PolyviaError);
    expect(new IngestionTimeout("t1")).toBeInstanceOf(PolyviaError);
  });

  it("APIError subclasses carry status", () => {
    const err = new AuthenticationError(401, "bad key");
    expect(err.status).toBe(401);
    expect(err).toBeInstanceOf(APIError);
  });
});

describe("tools", () => {
  it("openai() returns tools array and executor", () => {
    const client = new Polyvia({ apiKey: "poly_test" });
    const [tools, call] = client.tools.openai();
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);
    expect(tools[0]!.type).toBe("function");
    expect(typeof call).toBe("function");
  });

  it("anthropic() returns tools array and executor", () => {
    const client = new Polyvia({ apiKey: "poly_test" });
    const [tools, call] = client.tools.anthropic();
    expect(tools[0]!.input_schema).toBeDefined();
    expect(typeof call).toBe("function");
  });
});

// needed for beforeEach
import { beforeEach } from "vitest";
