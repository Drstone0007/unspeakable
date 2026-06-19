import type { ToolDefinition } from "../core/types"

export class ToolRouter {
  private costBudget: "free" | "low" | "medium" | "high"
  private latencyBudget: number
  private preferredProviders: string[]

  constructor(config?: {
    costBudget?: "free" | "low" | "medium" | "high"
    latencyBudget?: number
    preferredProviders?: string[]
  }) {
    this.costBudget = config?.costBudget ?? "medium"
    this.latencyBudget = config?.latencyBudget ?? 5000
    this.preferredProviders = config?.preferredProviders ?? []
  }

  route(goal: string, available: ToolDefinition[]): ToolDefinition {
    const costOrder: Record<string, number> = { free: 0, low: 1, medium: 2, high: 3 }
    const maxCost = costOrder[this.costBudget] ?? 2

    const candidates = available.filter((t) => {
      if (costOrder[t.cost] == null) return false
      return costOrder[t.cost]! <= maxCost
    })

    if (this.preferredProviders.length > 0) {
      const preferred = candidates.find((t) =>
        this.preferredProviders.includes(t.provider)
      )
      if (preferred) return preferred
    }

    return candidates.sort((a, b) => {
      const ac = costOrder[a.cost]!
      const bc = costOrder[b.cost]!
      if (ac !== bc) return ac - bc
      return a.name.localeCompare(b.name)
    })[0] ?? available[0]!
  }
}
