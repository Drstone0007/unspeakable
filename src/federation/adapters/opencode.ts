import type { PlatformAdapter } from "./base"
import type { FederationMessage } from "../../core/types"
import { MessageType } from "../../core/types"

export class OpenCodeAdapter implements PlatformAdapter {
  platformName = "opencode"
  platformVersion = "1.x"
  capabilities = ["coding", "file_system", "shell", "tasks", "plugins"]

  async handle(message: FederationMessage): Promise<unknown> {
    switch (message.type) {
      case MessageType.TaskRequest:
        return this.delegateCoding(message.payload)
      case MessageType.ToolInvoke:
        return this.invokeTool(message.payload)
      case MessageType.StateSync:
        return { status: "synced", platform: this.platformName }
      case MessageType.Heartbeat:
        return { alive: true, platform: this.platformName }
      default:
        return null
    }
  }

  private async delegateCoding(payload: unknown): Promise<unknown> {
    return { platform: this.platformName, action: "coding", payload }
  }

  private async invokeTool(payload: unknown): Promise<unknown> {
    return { platform: this.platformName, action: "tool", payload }
  }

  async ping(): Promise<boolean> {
    return true
  }

  transform(message: FederationMessage): FederationMessage {
    return message
  }
}
