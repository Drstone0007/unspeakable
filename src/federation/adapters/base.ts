import type { FederationMessage } from "../../core/types"

export interface PlatformAdapter {
  platformName: string
  platformVersion: string
  capabilities: string[]
  handle(message: FederationMessage): Promise<unknown>
  ping(): Promise<boolean>
  transform(message: FederationMessage): FederationMessage
}
