#!/usr/bin/env bun
import { MetaAgent } from "./src/core/agent"
import { FederationOrchestrator } from "./src/federation/orchestrator"
import { MemoryMesh } from "./src/memory/mesh"
import { TokenCompressor } from "./src/memory/compress"
import { ToolRegistry } from "./src/tools/registry"
import { ToolRouter } from "./src/tools/router"
import { Ladder } from "./src/minimalism/ladder"
import { DiffReviewer } from "./src/minimalism/review"
import { PortableRuntime } from "./src/portable/runtime"
import { SpeedProxy } from "./src/portable/proxy"
import type { AgentConfig, Task } from "./src/core/types"
import { TaskType, Capability } from "./src/core/types"

const BANNER = `
╔══════════════════════════════════════════════════════╗
║              U N S P E A K A B L E                   ║
║     Meta-Infrastructure for Autonomous Agents        ║
║                                                      ║
║  VoidClaw  ·  Ponytail  ·  Odysseus                  ║
║  OpenHuman  ·  OpenClaude Portable                   ║
╚══════════════════════════════════════════════════════╝
`

async function main() {
  console.log(BANNER)
  const runtime = new PortableRuntime("./unspeakable-data")
  await runtime.initialize()

  const envReport = await runtime.environmentCheck()
  console.log(`  Platform   : ${envReport.platform}`)
  console.log(`  Node       : ${envReport.nodeVersion}`)
  console.log(`  Bun        : ${envReport.bunAvailable ? "✓" : "✗"}`)
  console.log(`  Git        : ${envReport.gitAvailable ? "✓" : "✗"}`)
  console.log(`  Ollama     : ${envReport.ollamaAvailable ? "✓" : "✗"}`)
  console.log(`  Docker     : ${envReport.dockerAvailable ? "✓" : "✗"}`)
  console.log(`  Python     : ${envReport.pythonAvailable ? "✓" : "✗"}`)
  console.log()

  const config: AgentConfig = runtime.createAgentConfig({
    name: "unspeakable",
    minimalismLevel: "full",
    autoFetch: true,
    autoFetchIntervalMs: 1200000,
    sandboxPath: "./unspeakable-data/workspace",
  })

  const agent = new MetaAgent(config)
  const orchestrator = new FederationOrchestrator()
  const memory = new MemoryMesh(config.memoryDir, config.memoryBackend)
  const compressor = new TokenCompressor(3000, "hybrid")
  const tools = new ToolRegistry()
  const router = new ToolRouter({ costBudget: "low" })
  const ladder = new Ladder(config.minimalismLevel)
  const reviewer = new DiffReviewer()
  const proxy = new SpeedProxy({ port: 11435 })

  await agent.start()
  await memory.initialize()
  await tools.discover()

  const peers = await orchestrator.discoverPeers()
  console.log(`  Discovered peers: ${peers.length > 0 ? peers.join(", ") : "none (standalone mode)"}`)
  console.log()

  agent.registerSubAgent("minimalism-engine", async (input) => {
    if (typeof input === "string") return ladder.evaluate(input)
    return { status: "ok" }
  })

  agent.registerSubAgent("memory-mesh", async (input) => {
    if (typeof input === "string") return memory.query(input)
    return memory.getStats()
  })

  agent.registerSubAgent("diff-reviewer", async (input) => {
    if (typeof input === "string") return reviewer.review(input)
    return { status: "ok" }
  })

  const memoryStats = memory.getStats()
  console.log(`  Memory entries : ${memoryStats.totalEntries}`)
  for (const [type, count] of Object.entries(memoryStats.byType)) {
    console.log(`    ${type.padEnd(15)} : ${count}`)
  }
  console.log()
  console.log("  Unspeakable is ready. Capabilities:")
  console.log("    • Federation — multi-agent orchestration")
  console.log("    • Memory Mesh — persistent, local-first knowledge")
  console.log("    • Tool Orchestration — MCP-native routing")
  console.log("    • Minimalism Engine — YAGNI-by-default code gen")
  console.log("    • Portable Runtime — zero-footprint execution")
  console.log()

  const demoTask: Task = {
    id: crypto.randomUUID(),
    description: "implement a date picker using native HTML input",
    priority: 1,
    type: TaskType.Code,
  }

  console.log(`  Demo task: "${demoTask.description}"`)
  const decision = await ladder.evaluate(demoTask.description)
  console.log(`  Minimalism decision: rung ${decision.rung} - ${decision.label}`)
  console.log(`  Passed: ${decision.passed ? "✓" : "✗"} — ${decision.reason}`)
  console.log()

  const demoReview = await reviewer.review(`
+import flatpickr from "flatpickr"
+import "flatpickr/dist/flatpickr.min.css"
+import { DatePicker } from "./components/DatePicker"
+import { formatDate } from "./utils/date"
+
+function DateRangePicker() {
+  const [start, setStart] = useState(null)
+  const [end, setEnd] = useState(null)
+  const pickerRef = useRef(null)
+
+  useEffect(() => {
+    flatpickr(pickerRef.current, {
+      mode: "range",
+      onChange: ([s, e]) => { setStart(s); setEnd(e) }
+    })
+  }, [])
+  // ... component continues
+  return <input ref={pickerRef} type="text" />
+}
  `.trim())

  console.log("  Diff review for bloated date picker:")
  console.log(`    Score: ${demoReview.score}/100`)
  console.log(`    Added: ${demoReview.addedLines} lines`)
  console.log(`    Issues: ${demoReview.issues.length}`)
  for (const issue of demoReview.issues) {
    console.log(`    [${issue.severity}] ${issue.message}`)
    console.log(`      ↳ ${issue.suggestion}`)
  }
  console.log(`    Suggestion: ${demoReview.suggestion}`)
  console.log()
  console.log("  ✓ Unspeakable is operational.")
}

main().catch(console.error)
