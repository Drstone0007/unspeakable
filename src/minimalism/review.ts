import type { AuditIssue } from "../core/types"

export class DiffReviewer {
  async review(diff: string): Promise<ReviewResult> {
    const lines = diff.split("\n")
    const added = lines.filter((l) => l.startsWith("+") && !l.startsWith("+++"))
    const removed = lines.filter((l) => l.startsWith("-") && !l.startsWith("---"))
    const issues: AuditIssue[] = []

    if (added.length > 50) {
      issues.push({
        severity: "warning",
        message: `Large diff: ${added.length} lines added`,
        suggestion: `Can this be done in fewer than ${Math.ceil(added.length / 2)} lines?`,
        locImpact: added.length,
      })
    }

    const newLibraries = diff.match(/import\s+.*from\s+['"][^'"]+['"]/g) ?? []
    const extLibs = newLibraries.filter((imp) => !imp.includes("./") && !imp.includes("../"))

    if (extLibs.length > 0) {
      issues.push({
        severity: "warning",
        message: `New external dependencies: ${extLibs.length}`,
        suggestion: "Could stdlib or existing deps cover this?",
        locImpact: extLibs.length,
      })
    }

    const newConfigFiles = diff.match(/\+[^]*?\.(json|yaml|toml|env)/g) ?? []
    if (newConfigFiles.length > 0) {
      issues.push({
        severity: "info",
        message: `New config files: ${newConfigFiles.length}`,
        suggestion: "Consider environment variables or conventions over config files",
        locImpact: newConfigFiles.length,
      })
    }

    const docComments = added.filter(
      (l) => l.trim().startsWith("+//") || l.trim().startsWith("+#") || l.trim().startsWith("+/*")
    ).length
    if (docComments > added.length * 0.3) {
      issues.push({
        severity: "info",
        message: `High documentation ratio in diff: ${((docComments / added.length) * 100).toFixed(0)}%`,
        suggestion: "Let the code speak for itself; remove obvious documentation",
        locImpact: docComments,
      })
    }

    const score = Math.max(0, 100 - issues.reduce((acc, i) => {
      switch (i.severity) {
        case "critical": return acc + 25
        case "warning": return acc + 10
        case "info": return acc + 3
        default: return acc
      }
    }, 0))

    const suggestion = issues.length > 0
      ? this.generateSuggestion(issues)
      : "This diff is appropriately minimal."

    return {
      addedLines: added.length,
      removedLines: removed.length,
      netLines: added.length - removed.length,
      score,
      issues,
      suggestion,
    }
  }

  private generateSuggestion(issues: AuditIssue[]): string {
    const critical = issues.filter((i) => i.severity === "critical")
    const warnings = issues.filter((i) => i.severity === "warning")

    if (critical.length > 0) {
      return `Must fix: ${critical.map((i) => i.message).join("; ")}`
    }
    if (warnings.length > 0) {
      return `Consider: ${warnings.map((i) => i.suggestion).join("; ")}`
    }
    return issues.map((i) => i.suggestion).join("; ")
  }
}

export interface ReviewResult {
  addedLines: number
  removedLines: number
  netLines: number
  score: number
  issues: AuditIssue[]
  suggestion: string
}
