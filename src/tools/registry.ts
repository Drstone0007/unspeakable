import type { ToolDefinition, FederationMessage } from "../core/types"
import { Capability } from "../core/types"

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map()
  private mcpServers: Map<string, MCPServerHandle> = new Map()

  async discover(): Promise<void> {
    this.registerBuiltinTools()
  }

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool)
  }

  registerMCPServer(name: string, handle: MCPServerHandle): void {
    this.mcpServers.set(name, handle)
  }

  async invoke(toolName: string, params: Record<string, unknown>): Promise<unknown> {
    const tool = this.tools.get(toolName)
    if (!tool) throw new Error(`Unknown tool: ${toolName}`)

    if (tool.mcpEndpoint) {
      const server = this.mcpServers.get(tool.mcpEndpoint)
      if (server) return server(toolName, params)
    }

    return this.executeBuiltin(tool, params)
  }

  findToolsForCapability(capability: Capability): ToolDefinition[] {
    return Array.from(this.tools.values()).filter((t) =>
      t.requiredCapabilities.includes(capability)
    )
  }

  findCheapestTool(goal: string): ToolDefinition | null {
    const sorted = Array.from(this.tools.values())
      .filter((t) => goal.toLowerCase().includes(t.name.toLowerCase()))
      .sort((a, b) => {
        const costOrder = { free: 0, low: 1, medium: 2, high: 3 }
        return costOrder[a.cost] - costOrder[b.cost]
      })
    return sorted[0] ?? null
  }

  private registerBuiltinTools(): void {
    const builtins: ToolDefinition[] = [
      {
        name: "read_file",
        description: "Read a file from the workspace",
        parameters: [{ name: "path", type: "string", required: true, description: "File path" }],
        requiredCapabilities: [Capability.FileSystem],
        provider: "builtin",
        cost: "free",
      },
      {
        name: "write_file",
        description: "Write content to a file",
        parameters: [
          { name: "path", type: "string", required: true, description: "File path" },
          { name: "content", type: "string", required: true, description: "File content" },
        ],
        requiredCapabilities: [Capability.FileSystem],
        provider: "builtin",
        cost: "free",
      },
      {
        name: "web_search",
        description: "Search the web for information",
        parameters: [{ name: "query", type: "string", required: true, description: "Search query" }],
        requiredCapabilities: [Capability.WebSearch],
        provider: "builtin",
        cost: "low",
      },
      {
        name: "execute_command",
        description: "Execute a shell command",
        parameters: [{ name: "command", type: "string", required: true, description: "Command to run" }],
        requiredCapabilities: [Capability.Coding],
        provider: "builtin",
        cost: "free",
      },
      {
        name: "memory_query",
        description: "Query the memory mesh",
        parameters: [{ name: "query", type: "string", required: true, description: "Memory query" }],
        requiredCapabilities: [Capability.Memory],
        provider: "builtin",
        cost: "free",
      },
      {
        name: "scrape_url",
        description: "Scrape a web page for content",
        parameters: [{ name: "url", type: "string", required: true, description: "URL to scrape" }],
        requiredCapabilities: [Capability.WebScraping],
        provider: "builtin",
        cost: "low",
      },
    ]

    for (const tool of builtins) {
      this.tools.set(tool.name, tool)
    }
  }

  private async executeBuiltin(tool: ToolDefinition, params: Record<string, unknown>): Promise<unknown> {
    const fs = await import("node:fs/promises")
    switch (tool.name) {
      case "read_file":
        return fs.readFile(params.path as string, "utf-8")
      case "write_file":
        await fs.writeFile(params.path as string, params.content as string)
        return { written: true, path: params.path }
      case "execute_command": {
        const { execSync } = await import("node:child_process")
        return execSync(params.command as string, { encoding: "utf-8" })
      }
      case "memory_query":
        return { query: params.query, result: "delegated to memory mesh" }
      default:
        return { tool: tool.name, status: "unimplemented" }
    }
  }

  listTools(): ToolDefinition[] {
    return Array.from(this.tools.values())
  }
}

type MCPServerHandle = (tool: string, params: Record<string, unknown>) => Promise<unknown>
