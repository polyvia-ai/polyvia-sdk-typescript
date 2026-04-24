const MCP_URL = "https://app.polyvia.ai/mcp";

export class MCPConfig {
  constructor(
    public readonly url: string = MCP_URL,
    public readonly headers: Record<string, string> = {},
  ) {}

  /** Entry for `mcp_servers` in `client.beta.messages.create()` (Anthropic beta MCP). */
  toAnthropicMcpServer(options: { name?: string } = {}) {
    return {
      type: "url" as const,
      url: this.url,
      name: options.name ?? "polyvia",
      headers: this.headers,
    };
  }

  /** Tool entry for the OpenAI Responses API remote MCP support. */
  toOpenAIResponsesTool(
    options: { serverLabel?: string; requireApproval?: "never" | "always" } = {},
  ) {
    return {
      type: "mcp" as const,
      server_label: options.serverLabel ?? "polyvia",
      server_url: this.url,
      headers: this.headers,
      require_approval: options.requireApproval ?? "never",
    };
  }

  /** kwargs for OpenAI Agents SDK `MCPServerStreamableHTTP`. */
  toOpenAIMcpServer() {
    return { url: this.url, headers: this.headers };
  }

  /** Entry for `mcpServers` in `~/.claude/claude_desktop_config.json`. */
  toClaudeDesktopConfig() {
    return {
      type: "http" as const,
      url: this.url,
      headers: this.headers,
    };
  }

  /** Print a copy-pasteable snippet for Claude Desktop. */
  printClaudeDesktopSnippet() {
    const snippet = { mcpServers: { polyvia: this.toClaudeDesktopConfig() } };
    console.log(JSON.stringify(snippet, null, 2));
  }
}
