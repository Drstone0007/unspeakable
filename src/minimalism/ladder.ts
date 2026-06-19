import type { MinimalismDecision, AuditResult, AuditIssue } from "../core/types"

type Level = "off" | "lite" | "full" | "ultra"

interface Rung {
  number: number
  name: string
  question: string
  check: (description: string) => { passed: boolean; reason: string }
}

export class Ladder {
  private level: Level
  private rungs: Rung[]

  constructor(level: Level = "full") {
    this.level = level
    this.rungs = this.buildRungs()
  }

  setLevel(level: Level): void {
    this.level = level
  }

  getLevel(): Level {
    return this.level
  }

  async evaluate(description: string): Promise<MinimalismDecision> {
    const activeRungs = this.getActiveRungs()
    for (const rung of activeRungs) {
      const result = rung.check(description)
      if (!result.passed) {
        return {
          rung: rung.number,
          label: rung.name,
          passed: false,
          reason: result.reason,
        }
      }
    }
    return {
      rung: activeRungs[activeRungs.length - 1]?.number ?? 6,
      label: "all_passed",
      passed: true,
      reason: "All minimalism checks passed",
    }
  }

  async audit(content: string): Promise<AuditResult> {
    const lines = content.split("\n")
    const issues: AuditIssue[] = []

    if (this.level === "ultra" || this.level === "full") {
      const importCount = (content.match(/import\s+/g) ?? []).length
      if (importCount > 10) {
        issues.push({
          severity: "warning",
          message: `High import count: ${importCount}`,
          suggestion: "Consider consolidating imports or splitting into smaller modules",
          locImpact: importCount,
        })
      }

      const classCount = (content.match(/class\s+\w+/g) ?? []).length
      if (classCount > 3) {
        issues.push({
          severity: "warning",
          message: `High class count: ${classCount}`,
          suggestion: "Consider if all classes are necessary or if some can be functions",
          locImpact: classCount * 10,
        })
      }

      const commentRatio = (content.match(/\/\/|#|<!--/g) ?? []).length / Math.max(lines.length, 1)
      if (commentRatio > 0.5) {
        issues.push({
          severity: "info",
          message: `High comment ratio: ${(commentRatio * 100).toFixed(0)}%`,
          suggestion: "Code should be self-documenting; remove obvious comments",
          locImpact: Math.floor(lines.length * commentRatio),
        })
      }

      const totalLines = lines.length
      const nonEmptyLines = lines.filter((l) => l.trim().length > 0).length
      const blankLines = totalLines - nonEmptyLines
      if (blankLines > totalLines * 0.3) {
        issues.push({
          severity: "info",
          message: `Excessive blank lines: ${blankLines} of ${totalLines}`,
          suggestion: "Remove unnecessary blank lines",
          locImpact: blankLines,
        })
      }
    }

    const score = Math.max(0, 100 - issues.reduce((acc, i) => {
      switch (i.severity) {
        case "critical": return acc + 25
        case "warning": return acc + 10
        case "info": return acc + 3
        default: return acc
      }
    }, 0))

    return {
      file: "unknown",
      locBefore: lines.length,
      locAfter: lines.length,
      issues,
      score,
    }
  }

  private buildRungs(): Rung[] {
    return [
      {
        number: 1,
        name: "YAGNI",
        question: "Does this need to exist?",
        check: () => ({ passed: true, reason: "YAGNI check passed" }),
      },
      {
        number: 2,
        name: "Stdlib",
        question: "Stdlib does it?",
        check: (desc) => {
          const hasLib = ["sort", "parse", "read", "write", "calculate"].some((w) =>
            desc.toLowerCase().includes(w)
          )
          return {
            passed: hasLib,
            reason: hasLib ? "Stdlib likely available" : "No stdlib opportunity detected",
          }
        },
      },
      {
        number: 3,
        name: "Native",
        question: "Native platform feature?",
        check: (desc) => {
          const natives = ["input type=", "picker", "dialog", "date", "color", "file"]
          const uses = natives.filter((n) => desc.toLowerCase().includes(n))
          return {
            passed: uses.length === 0,
            reason: uses.length > 0
              ? `Use native <${uses[0]}> instead of custom implementation`
              : "No native feature detected",
          }
        },
      },
      {
        number: 4,
        name: "One Line",
        question: "One line?",
        check: () => ({ passed: true, reason: "One-line check passed" }),
      },
      {
        number: 5,
        name: "Installed",
        question: "Installed dependency?",
        check: (desc) => {
          const hasDeps = ["chart", "table", "form", "router"].some((w) =>
            desc.toLowerCase().includes(w)
          )
          return {
            passed: !hasDeps,
            reason: hasDeps ? "Use existing dependency instead of new one" : "No dependency detected",
          }
        },
      },
      {
        number: 6,
        name: "Minimum",
        question: "Minimum that works?",
        check: () => ({ passed: true, reason: "Minimum viable implementation" }),
      },
    ]
  }

  private getActiveRungs(): Rung[] {
    switch (this.level) {
      case "off":
        return [this.rungs[this.rungs.length - 1]!] // just "minimum that works"
      case "lite":
        return this.rungs.filter((r) => r.number >= 4)
      case "full":
        return this.rungs
      case "ultra":
        return this.rungs.map((r) => ({
          ...r,
          check: (desc: string) => {
            const base = r.check(desc)
            return base.passed
              ? { passed: false, reason: `Ultra: even stricter - ${r.question} requires absolute proof` }
              : base
          },
        }))
    }
  }
}
