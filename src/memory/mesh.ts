import type { MemoryEntry } from "../core/types"
import { MemoryType } from "../core/types"

export class MemoryMesh {
  private backend: "sqlite" | "filesystem" | "vector"
  private basePath: string
  private entries: Map<string, MemoryEntry> = new Map()
  private index: Map<string, Set<string>> = new Map()

  constructor(basePath: string, backend: "sqlite" | "filesystem" | "vector" = "filesystem") {
    this.basePath = basePath
    this.backend = backend
  }

  async initialize(): Promise<void> {
    await this.loadFromDisk()
  }

  async store(entry: MemoryEntry): Promise<void> {
    this.entries.set(entry.id, entry)
    this.indexEntry(entry)
    await this.persist(entry)
  }

  async batchStore(entries: MemoryEntry[]): Promise<void> {
    for (const entry of entries) {
      this.entries.set(entry.id, entry)
      this.indexEntry(entry)
    }
    await this.persistAll(entries)
  }

  async query(query: string, limit = 10): Promise<MemoryEntry[]> {
    const terms = query.toLowerCase().split(/\s+/)
    const scored = new Map<string, number>()

    for (const [id, entry] of this.entries) {
      let score = 0
      for (const term of terms) {
        if (entry.content.toLowerCase().includes(term)) score += 1
        if (entry.tags.some((t) => t.toLowerCase().includes(term))) score += 3
        if (entry.source.toLowerCase().includes(term)) score += 2
      }
      if (score > 0) scored.set(id, score)
    }

    return Array.from(scored.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => this.entries.get(id)!)
  }

  queryByType(type: MemoryType, limit = 20): MemoryEntry[] {
    return Array.from(this.entries.values())
      .filter((e) => e.type === type)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit)
  }

  queryByTag(tag: string, limit = 20): MemoryEntry[] {
    const ids = this.index.get(tag)
    if (!ids) return []
    return Array.from(ids)
      .map((id) => this.entries.get(id)!)
      .filter(Boolean)
      .slice(0, limit)
  }

  get(id: string): MemoryEntry | undefined {
    return this.entries.get(id)
  }

  getChildren(parentId: string): MemoryEntry[] {
    const parent = this.entries.get(parentId)
    if (!parent) return []
    return parent.childrenIds
      .map((id) => this.entries.get(id)!)
      .filter(Boolean)
  }

  async prune(olderThan: Date): Promise<number> {
    let count = 0
    for (const [id, entry] of this.entries) {
      if (entry.timestamp < olderThan) {
        this.entries.delete(id)
        this.deindexEntry(entry)
        count++
      }
    }
    return count
  }

  private indexEntry(entry: MemoryEntry): void {
    for (const tag of entry.tags) {
      const existing = this.index.get(tag) ?? new Set()
      existing.add(entry.id)
      this.index.set(tag, existing)
    }
  }

  private deindexEntry(entry: MemoryEntry): void {
    for (const tag of entry.tags) {
      const existing = this.index.get(tag)
      if (existing) {
        existing.delete(entry.id)
        if (existing.size === 0) this.index.delete(tag)
      }
    }
  }

  private async persist(entry: MemoryEntry): Promise<void> {
    const fs = await import("node:fs/promises")
    const path = `${this.basePath}/memory/${entry.id}.json`
    await fs.mkdir(`${this.basePath}/memory`, { recursive: true })
    await fs.writeFile(path, JSON.stringify(entry, null, 2))
  }

  private async persistAll(entries: MemoryEntry[]): Promise<void> {
    await Promise.all(entries.map((e) => this.persist(e)))
  }

  private async loadFromDisk(): Promise<void> {
    try {
      const fs = await import("node:fs/promises")
      const path = `${this.basePath}/memory`
      const files = await fs.readdir(path).catch(() => [])
      const entries = await Promise.all(
        files
          .filter((f) => f.endsWith(".json"))
          .map((f) => fs.readFile(`${path}/${f}`, "utf-8").then((c) => JSON.parse(c) as MemoryEntry))
      )
      for (const entry of entries) {
        this.entries.set(entry.id, entry)
        this.indexEntry(entry)
      }
    } catch {
      // cold start - no memory yet
    }
  }

  getStats(): { totalEntries: number; byType: Record<string, number> } {
    const byType: Record<string, number> = {}
    for (const entry of this.entries.values()) {
      byType[entry.type] = (byType[entry.type] ?? 0) + 1
    }
    return { totalEntries: this.entries.size, byType }
  }
}

export class MemoryTree {
  private mesh: MemoryMesh
  private rootEntries: string[] = []

  constructor(mesh: MemoryMesh) {
    this.mesh = mesh
  }

  addRootEntry(id: string): void {
    if (!this.rootEntries.includes(id)) {
      this.rootEntries.push(id)
    }
  }

  getTree(): MemoryTreeNode[] {
    return this.rootEntries
      .map((id) => this.buildSubTree(id))
      .filter(Boolean) as MemoryTreeNode[]
  }

  private buildSubTree(id: string): MemoryTreeNode | null {
    const entry = this.mesh.get(id)
    if (!entry) return null
    return {
      entry,
      children: entry.childrenIds
        .map((cid) => this.buildSubTree(cid))
        .filter(Boolean) as MemoryTreeNode[],
    }
  }
}

export interface MemoryTreeNode {
  entry: MemoryEntry
  children: MemoryTreeNode[]
}
