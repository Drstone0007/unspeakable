import type { AgentContext, Task } from "./types"

interface Thought {
  step: number
  type: "observe" | "think" | "act" | "reflect"
  content: string
}

export class Pipeline {
  private context: AgentContext
  private thoughts: Thought[] = []
  private maxSteps = 10

  constructor(context: AgentContext) {
    this.context = context
  }

  async run(goal: string, execute: (thought: Thought) => Promise<string>): Promise<Thought[]> {
    this.thoughts = []
    let step = 0

    this.thoughts.push({ step: step++, type: "observe", content: `Goal: ${goal}` })

    while (step < this.maxSteps) {
      const thought = this.generateThought(step, execute)
      this.thoughts.push(thought)

      const result = await execute(thought)
      const reflection: Thought = {
        step: step++,
        type: "reflect",
        content: result,
      }
      this.thoughts.push(reflection)

      if (this.isGoalAchieved(reflection)) break
      if (this.isStuck()) break
    }

    return this.thoughts
  }

  private generateThought(step: number, execute: (thought: Thought) => Promise<string>): Thought {
    const type = step === 1 ? "think" : "act"
    return { step, type, content: `Step ${step}: reasoning about next action` }
  }

  private isGoalAchieved(reflection: Thought): boolean {
    return reflection.content.includes("DONE") || reflection.content.includes("COMPLETE")
  }

  private isStuck(): boolean {
    if (this.thoughts.length < 6) return false
    const lastThree = this.thoughts.slice(-3)
    return lastThree.every((t) => t.type === "reflect" && t.content.length < 10)
  }

  getThoughts(): Thought[] {
    return this.thoughts
  }
}
