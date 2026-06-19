import type { AgentConfig } from "../core/types"

export class PortableRuntime {
  private basePath: string
  private config: PortableConfig
  private active: boolean = false

  constructor(basePath: string, config?: Partial<PortableConfig>) {
    this.basePath = basePath
    this.config = {
      redirectConfig: true,
      redirectData: true,
      redirectCache: true,
      bundledNode: false,
      proxyEnabled: true,
      sandboxEnabled: true,
      ...config,
    }
  }

  async initialize(): Promise<void> {
    const fs = await import("node:fs/promises")
    const dirs = ["data", "data/memory", "data/cache", "data/config", "workspace", "engine", "tools"]
    for (const dir of dirs) {
      await fs.mkdir(`${this.basePath}/${dir}`, { recursive: true })
    }
    this.active = true
  }

  createAgentConfig(overrides?: Partial<AgentConfig>): AgentConfig {
    return {
      name: overrides?.name ?? "unspeakable-agent",
      providers: overrides?.providers ?? [
        { name: "ollama", type: "ollama", baseUrl: "http://localhost:11434", models: ["gemma3:1b", "qwen2.5:1.5b"], priority: 0 },
      ],
      defaultProvider: overrides?.defaultProvider ?? "ollama",
      memoryDir: overrides?.memoryDir ?? `${this.basePath}/data`,
      memoryBackend: overrides?.memoryBackend ?? "filesystem",
      minimalismLevel: overrides?.minimalismLevel ?? "full",
      sandboxPath: overrides?.sandboxPath ?? `${this.basePath}/workspace`,
      autoFetch: overrides?.autoFetch ?? false,
      autoFetchIntervalMs: overrides?.autoFetchIntervalMs ?? 1200000,
    }
  }

  async environmentCheck(): Promise<EnvironmentReport> {
    const report: EnvironmentReport = {
      platform: process.platform,
      nodeVersion: process.version,
      bunAvailable: false,
      gitAvailable: false,
      ollamaAvailable: false,
      dockerAvailable: false,
      diskFreeBytes: 0,
      memoryFreeBytes: 0,
      pythonAvailable: false,
    }

    try {
      const bunResult = await this.checkBinary("bun")
      report.bunAvailable = bunResult
    } catch { /* not available */ }

    try {
      const gitResult = await this.checkBinary("git")
      report.gitAvailable = gitResult
    } catch { /* not available */ }

    try {
      const { execSync } = await import("node:child_process")
      try {
        execSync("ollama --version", { stdio: "ignore", timeout: 3000 })
        report.ollamaAvailable = true
      } catch { /* not available */ }

      try {
        execSync("docker --version", { stdio: "ignore", timeout: 3000 })
        report.dockerAvailable = true
      } catch { /* not available */ }

      try {
        execSync("python3 --version", { stdio: "ignore", timeout: 3000 })
        report.pythonAvailable = true
      } catch { /* not available */ }
    } catch { /* failed */ }

    return report
  }

  private async checkBinary(name: string): Promise<boolean> {
    const { execSync } = await import("node:child_process")
    try {
      execSync(`${name} --version`, { stdio: "ignore", timeout: 3000 })
      return true
    } catch {
      return false
    }
  }

  getConfig(): PortableConfig {
    return this.config
  }

  isActive(): boolean {
    return this.active
  }
}

export interface PortableConfig {
  redirectConfig: boolean
  redirectData: boolean
  redirectCache: boolean
  bundledNode: boolean
  proxyEnabled: boolean
  sandboxEnabled: boolean
}

export interface EnvironmentReport {
  platform: string
  nodeVersion: string
  bunAvailable: boolean
  gitAvailable: boolean
  ollamaAvailable: boolean
  dockerAvailable: boolean
  diskFreeBytes: number
  memoryFreeBytes: number
  pythonAvailable: boolean
}
