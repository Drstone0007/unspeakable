export class SpeedProxy {
  private port: number
  private targetUrl: string
  private trimRatio: number
  private active: boolean = false
  private server: any = null

  constructor(config: {
    port?: number
    targetUrl?: string
    trimRatio?: number
  } = {}) {
    this.port = config.port ?? 11435
    this.targetUrl = config.targetUrl ?? "http://localhost:11434"
    this.trimRatio = config.trimRatio ?? 0.9
  }

  async start(): Promise<void> {
    const http = await import("node:http")
    const httpProxy = await import("node:http")

    this.server = http.createServer(async (req: any, res: any) => {
      if (req.method === "POST" && req.url === "/api/chat") {
        let body = ""
        for await (const chunk of req) body += chunk
        const trimmed = this.trimPrompt(body)
        const response = await this.forwardToOllama(trimmed)
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(JSON.stringify(response))
      } else {
        const response = await this.forwardRaw(req.method ?? "GET", req.url ?? "/")
        res.writeHead(response.status, response.headers)
        res.end(response.body)
      }
    })

    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        this.active = true
        resolve()
      })
    })
  }

  async stop(): Promise<void> {
    if (this.server) {
      this.server.close()
      this.active = false
    }
  }

  private trimPrompt(body: string): string {
    try {
      const parsed = JSON.parse(body)
      if (parsed.messages && Array.isArray(parsed.messages)) {
        const systemMsg = parsed.messages.find((m: any) => m.role === "system")
        if (systemMsg && typeof systemMsg.content === "string") {
          const originalLength = systemMsg.content.length
          const keepLength = Math.floor(
            Math.max(originalLength * (1 - this.trimRatio), 300)
          )
          systemMsg.content = `[trimmed] ${systemMsg.content.slice(0, keepLength)}`
        }
      }
      return JSON.stringify(parsed)
    } catch {
      return body
    }
  }

  private async forwardToOllama(body: string): Promise<any> {
    try {
      const response = await fetch(`${this.targetUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      })
      return response.json()
    } catch {
      return { error: "Failed to reach Ollama backend" }
    }
  }

  private async forwardRaw(method: string, url: string): Promise<{
    status: number
    headers: Record<string, string>
    body: string
  }> {
    try {
      const response = await fetch(`${this.targetUrl}${url}`, { method })
      return {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: await response.text(),
      }
    } catch {
      return { status: 502, headers: {}, body: "Bad Gateway" }
    }
  }

  getPort(): number {
    return this.port
  }

  isActive(): boolean {
    return this.active
  }
}
