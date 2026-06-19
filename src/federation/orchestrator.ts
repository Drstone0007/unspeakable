import type { FederationMessage } from "../core/types"
import { MessageType } from "../core/types"
import type { PlatformAdapter } from "./adapters/base"
import { ClaudeCodeAdapter } from "./adapters/claude-code"
import { OpenCodeAdapter } from "./adapters/opencode"
import { OdysseusAdapter } from "./adapters/odysseus"
import { OpenHumanAdapter } from "./adapters/openhuman"

export class FederationOrchestrator {
  private adapters: Map<string, PlatformAdapter> = new Map()
  private messageBus: FederationMessage[] = []
  private activePeers: Set<string> = new Set()

  constructor() {
    this.registerAdapter(new ClaudeCodeAdapter())
    this.registerAdapter(new OpenCodeAdapter())
    this.registerAdapter(new OdysseusAdapter())
    this.registerAdapter(new OpenHumanAdapter())
  }

  registerAdapter(adapter: PlatformAdapter): void {
    this.adapters.set(adapter.platformName, adapter)
  }

  async route(message: FederationMessage): Promise<unknown[]> {
    this.messageBus.push(message)
    this.pruneExpiredMessages()

    const targets = message.to.includes("*")
      ? Array.from(this.adapters.keys())
      : message.to.filter((t) => this.adapters.has(t))

    return Promise.all(
      targets.map((name) => {
        const adapter = this.adapters.get(name)
        if (!adapter) return Promise.resolve(null)
        return adapter.handle(message)
      })
    )
  }

  async discoverPeers(): Promise<string[]> {
    const peers: string[] = []
    for (const [name, adapter] of this.adapters) {
      try {
        const alive = await adapter.ping()
        if (alive) {
          peers.push(name)
          this.activePeers.add(name)
        }
      } catch {
        this.activePeers.delete(name)
      }
    }
    return peers
  }

  getStateSyncMessage(): FederationMessage {
    return {
      from: "orchestrator",
      to: ["*"],
      type: MessageType.StateSync,
      payload: {
        peers: Array.from(this.activePeers),
        messageCount: this.messageBus.length,
      },
      timestamp: new Date(),
      ttl: 30,
      traceId: crypto.randomUUID(),
    }
  }

  private pruneExpiredMessages(): void {
    const now = Date.now()
    this.messageBus = this.messageBus.filter((m) => {
      const age = (now - m.timestamp.getTime()) / 1000
      return age < m.ttl
    })
  }

  getActivePeers(): string[] {
    return Array.from(this.activePeers)
  }
}
