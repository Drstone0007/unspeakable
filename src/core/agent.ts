import type { AgentContext, AgentConfig, Task, FederationMessage } from "./types"
import { Capability, TaskType, MessageType } from "./types"
import { Pipeline } from "./pipeline"
import { MemoryMesh } from "../memory/mesh"
import { ToolRegistry } from "../tools/registry"
import { Ladder } from "../minimalism/ladder"

export class MetaAgent {
  private context: AgentContext
  private pipeline: Pipeline
  private memory: MemoryMesh
  private tools: ToolRegistry
  private ladder: Ladder
  private subAgents: Map<string, SubAgentHandle> = new Map()
  private taskQueue: Task[] = []
  private activeTasks: Set<string> = new Set()

  constructor(config: AgentConfig) {
    this.context = this.buildContext(config)
    this.pipeline = new Pipeline(this.context)
    this.memory = new MemoryMesh(config.memoryDir, config.memoryBackend)
    this.tools = new ToolRegistry()
    this.ladder = new Ladder(config.minimalismLevel)
  }

  private buildContext(config: AgentConfig): AgentContext {
    return {
      id: crypto.randomUUID(),
      sessionId: crypto.randomUUID(),
      workspace: config.sandboxPath,
      memoryDir: config.memoryDir,
      config,
      capabilities: new Set([Capability.Coding, Capability.Reasoning]),
    }
  }

  async start(): Promise<void> {
    await this.memory.initialize()
    await this.tools.discover()
    this.startAutoFetchLoop()
    this.startHeartbeat()
  }

  async submitTask(task: Task): Promise<void> {
    this.taskQueue.push(task)
    this.taskQueue.sort((a, b) => b.priority - a.priority)
    if (this.activeTasks.size < 3) {
      await this.processNextTask()
    }
  }

  private async processNextTask(): Promise<void> {
    const task = this.taskQueue.shift()
    if (!task) return

    this.activeTasks.add(task.id)
    try {
      const result = await this.executeTask(task)
      await this.memory.store({
        id: crypto.randomUUID(),
        type: this.taskToMemoryType(task.type),
        content: JSON.stringify(result),
        tags: [task.type, "execution"],
        source: `task:${task.id}`,
        timestamp: new Date(),
        ttl: 86400,
        childrenIds: [],
        metadata: { taskId: task.id },
      })
    } finally {
      this.activeTasks.delete(task.id)
    }

    if (this.taskQueue.length > 0) {
      await this.processNextTask()
    }
  }

  private async executeTask(task: Task): Promise<unknown> {
    switch (task.type) {
      case TaskType.Code: {
        const audit = await this.ladder.evaluate(task.description)
        if (!audit.passed) {
          return { status: "rejected", reason: audit.reason }
        }
        return this.delegateCode(task)
      }
      case TaskType.Research:
        return this.delegateResearch(task)
      case TaskType.Memory:
        return this.memory.query(task.description)
      case TaskType.Tool:
        return this.tools.invoke(task.description, task.context ?? {})
      case TaskType.Orchestration:
        return this.federate(task)
      case TaskType.Minimalism:
        return this.ladder.audit(task.description)
    }
  }

  private async delegateCode(task: Task): Promise<unknown> {
    const msg: FederationMessage = {
      from: this.context.id,
      to: ["coder-agent"],
      type: MessageType.TaskRequest,
      payload: task,
      timestamp: new Date(),
      ttl: 300,
      traceId: crypto.randomUUID(),
    }
    return this.broadcast(msg)
  }

  private async delegateResearch(task: Task): Promise<unknown> {
    const msg: FederationMessage = {
      from: this.context.id,
      to: ["research-agent", "web-agent"],
      type: MessageType.TaskRequest,
      payload: task,
      timestamp: new Date(),
      ttl: 600,
      traceId: crypto.randomUUID(),
    }
    return this.broadcast(msg)
  }

  registerSubAgent(name: string, handle: SubAgentHandle): void {
    this.subAgents.set(name, handle)
  }

  private async federate(task: Task): Promise<unknown> {
    const results: Record<string, unknown> = {}
    for (const [name, handle] of this.subAgents) {
      results[name] = await handle(task.description)
    }
    return results
  }

  private async broadcast(msg: FederationMessage): Promise<unknown> {
    const results: unknown[] = []
    for (const name of msg.to) {
      const handle = this.subAgents.get(name)
      if (handle) {
        results.push(await handle(msg))
      }
    }
    return results
  }

  private taskToMemoryType(type: TaskType): import("./types").MemoryType {
    const { MemoryType } = require("./types")
    const map: Record<TaskType, import("./types").MemoryType> = {
      [TaskType.Code]: MemoryType.Codebase,
      [TaskType.Research]: MemoryType.Fact,
      [TaskType.Memory]: MemoryType.Reflection,
      [TaskType.Tool]: MemoryType.Workflow,
      [TaskType.Orchestration]: MemoryType.Workflow,
      [TaskType.Minimalism]: MemoryType.Reflection,
    }
    return map[type]
  }

  private startAutoFetchLoop(): void {
    if (!this.context.config.autoFetch) return
    setInterval(async () => {
      for (const handle of this.subAgents.values()) {
        await handle({ type: "auto_fetch", payload: null })
      }
    }, this.context.config.autoFetchIntervalMs)
  }

  private startHeartbeat(): void {
    setInterval(async () => {
      const msg: FederationMessage = {
        from: this.context.id,
        to: ["*"],
        type: MessageType.Heartbeat,
        payload: { alive: true, load: this.activeTasks.size },
        timestamp: new Date(),
        ttl: 10,
        traceId: crypto.randomUUID(),
      }
      await this.broadcast(msg)
    }, 30000)
  }

  getContext(): AgentContext {
    return this.context
  }
}

export type SubAgentHandle = (input: unknown) => Promise<unknown>
