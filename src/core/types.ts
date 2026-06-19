export interface AgentContext {
  id: string
  sessionId: string
  workspace: string
  memoryDir: string
  config: AgentConfig
  capabilities: Set<Capability>
}

export interface AgentConfig {
  name: string
  providers: ModelProvider[]
  defaultProvider: string
  memoryDir: string
  memoryBackend: "sqlite" | "filesystem" | "vector"
  minimalismLevel: "off" | "lite" | "full" | "ultra"
  sandboxPath: string
  autoFetch: boolean
  autoFetchIntervalMs: number
}

export interface ModelProvider {
  name: string
  type: "openai" | "anthropic" | "google" | "ollama" | "nim" | "openrouter"
  baseUrl: string
  apiKey?: string
  models: string[]
  priority: number
}

export enum Capability {
  Coding = "coding",
  Research = "research",
  Memory = "memory",
  WebSearch = "web_search",
  FileSystem = "filesystem",
  Email = "email",
  Calendar = "calendar",
  Voice = "voice",
  AndroidControl = "android_control",
  ImageGeneration = "image_generation",
  WebScraping = "web_scraping",
  Reasoning = "reasoning",
}

export interface Task {
  id: string
  description: string
  priority: number
  type: TaskType
  context?: Record<string, unknown>
  deadline?: Date
  dependencies?: string[]
}

export enum TaskType {
  Code = "code",
  Research = "research",
  Memory = "memory",
  Tool = "tool",
  Orchestration = "orchestration",
  Minimalism = "minimalism",
}

export interface FederationMessage {
  from: string
  to: string[]
  type: MessageType
  payload: unknown
  timestamp: Date
  ttl: number
  traceId: string
}

export enum MessageType {
  TaskRequest = "task_request",
  TaskResponse = "task_response",
  MemoryQuery = "memory_query",
  MemoryResponse = "memory_response",
  ToolInvoke = "tool_invoke",
  ToolResult = "tool_result",
  StateSync = "state_sync",
  Heartbeat = "heartbeat",
}

export interface MemoryEntry {
  id: string
  type: MemoryType
  content: string
  embedding?: number[]
  tags: string[]
  source: string
  timestamp: Date
  ttl: number
  parentId?: string
  childrenIds: string[]
  metadata: Record<string, unknown>
}

export enum MemoryType {
  Fact = "fact",
  Preference = "preference",
  Workflow = "workflow",
  Conversation = "conversation",
  Codebase = "codebase",
  Integration = "integration",
  Reflection = "reflection",
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: ToolParameter[]
  requiredCapabilities: Capability[]
  provider: string
  cost: "free" | "low" | "medium" | "high"
  mcpEndpoint?: string
}

export interface ToolParameter {
  name: string
  type: "string" | "number" | "boolean" | "object" | "array"
  required: boolean
  description: string
  default?: unknown
}

export interface MinimalismDecision {
  rung: number
  label: string
  passed: boolean
  reason: string
}

export interface AuditResult {
  file: string
  locBefore: number
  locAfter: number
  issues: AuditIssue[]
  score: number
}

export interface AuditIssue {
  severity: "critical" | "warning" | "info"
  message: string
  suggestion: string
  locImpact: number
}
