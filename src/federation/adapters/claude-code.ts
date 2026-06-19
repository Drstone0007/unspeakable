import type { PlatformAdapter } from "./base"
import type { FederationMessage } from "../../core/types"
import { MessageType } from "../../core/types"

export class ClaudeCodeAdapter implements PlatformAdapter {
  platformName = "claude-code"
  platformVersion = "4.x"
  capabilities = ["coding", "file_system", "shell", "agent_skills"]

  async handle(message: FederationMessage): Promise<unknown> {
    switch (message.type) {
      case MessageType.TaskRequest:
        return this.executeTask(message.payload)
      case MessageType.MemoryQuery:
        return this.queryMemory(message.payload)
      case MessageType.StateSync:
        return { status: "synced", platform: this.platformName }
      case MessageType.Heartbeat:
        return { alive: true, platform: this.platformName }
      default:
        return null
    }
  }

  private async executeTask(payload: unknown): Promise<unknown> {
    return { platform: this.platformName, result: "delegated to claude-code", payload }
  }

  private async queryMemory(payload: unknown): Promise<unknown> {
    return { platform: this.platformName, memory: payload }
  }

  async ping(): Promise<boolean> {
    return true
  }

  transform(message: FederationMessage): FederationMessage {
    return message
  }
}
