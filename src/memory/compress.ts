export class TokenCompressor {
  private maxTokens: number
  private strategy: "truncate" | "summarize" | "dedupe" | "hybrid"

  constructor(maxTokens = 3000, strategy: "truncate" | "summarize" | "dedupe" | "hybrid" = "hybrid") {
    this.maxTokens = maxTokens
    this.strategy = strategy
  }

  compress(content: string, options?: CompressOptions): string {
    switch (this.strategy) {
      case "truncate":
        return this.truncate(content)
      case "summarize":
        return this.summarize(content)
      case "dedupe":
        return this.dedupe(content)
      case "hybrid":
        return this.hybrid(content, options)
    }
  }

  private truncate(content: string): string {
    const tokens = this.estimateTokens(content)
    if (tokens <= this.maxTokens) return content
    const ratio = this.maxTokens / tokens
    const chars = Math.floor(content.length * ratio)
    return content.slice(0, chars) + "\n... (truncated)"
  }

  private summarize(content: string): string {
    const lines = content.split("\n")
    if (lines.length <= 10) return content
    const kept = new Set<number>()

    // keep first 2 lines (headers)
    kept.add(0)
    if (lines[1]) kept.add(1)

    // keep last 2 lines (conclusion)
    kept.add(lines.length - 2)
    kept.add(lines.length - 1)

    // keep code blocks
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]!.startsWith("```") || lines[i]!.startsWith("  ") || lines[i]!.startsWith("\t")) {
        kept.add(i)
      }
    }

    return Array.from(kept)
      .sort((a, b) => a - b)
      .map((i) => lines[i])
      .join("\n")
  }

  private dedupe(content: string): string {
    const seen = new Set<string>()
    return content
      .split("\n")
      .filter((line) => {
        const normalized = line.trim().toLowerCase()
        if (seen.has(normalized)) return false
        seen.add(normalized)
        return true
      })
      .join("\n")
  }

  private hybrid(content: string, options?: CompressOptions): string {
    let result = content

    if (options?.stripHtml) {
      result = result.replace(/<[^>]+>/g, "")
    }
    if (options?.shortenUrls) {
      result = result.replace(/https?:\/\/[^\s]+/g, (url) => {
        try {
          const u = new URL(url)
          return `${u.hostname}/...`
        } catch {
          return "[url]"
        }
      })
    }
    if (options?.removeEmptyLines) {
      result = result.replace(/^\s*[\r\n]/gm, "")
    }

    result = this.dedupe(result)
    result = this.summarize(result)
    result = this.truncate(result)

    return result
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }
}

interface CompressOptions {
  stripHtml?: boolean
  shortenUrls?: boolean
  removeEmptyLines?: boolean
}
