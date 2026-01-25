#!/usr/bin/env node

/**
 * Docs Finder CLI for Claude Code Skills
 * Efficiently reads documentation files with pattern: prefix.className.memberName.md
 *
 * Usage:
 *   docs-finder                                - List all classes
 *   docs-finder <className>                    - List all members of a class
 *   docs-finder <className> <memberName>       - Read specific doc file
 *   docs-finder <memberName>                   - Find member across all classes (shows suggestions)
 */

import * as fs from "fs"
import * as path from "path"

interface DocFile {
  prefix: string
  className: string
  memberName: string
  filePath: string
  fullPath: string // prefix.className.memberName
}

interface SearchResult {
  type: `file` | `list` | `suggestions`
  data: DocFile[] | string
}

class DocsFinder {
  private docsDir: string
  private docFiles: DocFile[] = []
  private requiredPrefix: string

  constructor(docsDir: string = `./docs`, prefix: string = `gramstax`) {
    this.docsDir = path.resolve(docsDir)
    this.requiredPrefix = prefix
    this.indexDocs()
  }

  /**
   * Index all documentation files matching pattern: prefix.className.memberName.md
   */
  private indexDocs(): void {
    if (!fs.existsSync(this.docsDir)) {
      console.error(`❌ Docs directory not found: ${this.docsDir}`)
      process.exit(1)
    }

    const files = fs.readdirSync(this.docsDir)

    for (const file of files) {
      if (!file.endsWith(`.md`)) continue

      // Parse pattern: prefix.className.memberName.md
      const parts = file.replace(`.md`, ``).split(`.`)

      if (parts.length >= 3) {
        const prefix = parts[0]

        // Skip if not matching required prefix
        if (prefix !== this.requiredPrefix) continue

        const className = parts[1]
        const memberName = parts.slice(2).join(`.`)

        this.docFiles.push({
          prefix,
          className,
          memberName,
          filePath: path.join(this.docsDir, file),
          fullPath: `${prefix}.${className}.${memberName}`
        })
      }
    }

    if (this.docFiles.length === 0) {
      console.warn(`⚠️  No documentation files found with prefix "${this.requiredPrefix}" in ${this.docsDir}`)
    }
  }

  /**
   * Search for documentation
   */
  search(query1?: string, query2?: string): SearchResult {
    // Case 1: No arguments - show all classes
    if (!query1) {
      return this.listAllClasses()
    }

    // Case 2: Two arguments - exact file lookup (className memberName)
    if (query2) {
      return this.getExactDoc(query1, query2)
    }

    // Case 3: One argument - check if it's a className
    const classDocs = this.docFiles.filter((doc) => doc.className.toLowerCase() === query1.toLowerCase())

    if (classDocs.length > 0) {
      return this.listClassMembers(query1, classDocs)
    }

    // If not a className, search as memberName and show suggestions
    return this.searchMemberSuggestions(query1)
  }

  /**
   * List all available classes
   */
  private listAllClasses(): SearchResult {
    const classes = [...new Set(this.docFiles.map((doc) => doc.className))].sort()

    let output = `📚 Available Classes (${classes.length}):\n\n`
    classes.forEach((className) => {
      const count = this.docFiles.filter((doc) => doc.className === className).length
      output += `  • ${className} (${count} members)\n`
    })
    output += `\n💡 Usage: docs-finder <className>\n`

    return {type: `list`, data: output}
  }

  /**
   * List all members of a specific class
   */
  private listClassMembers(className: string, docs: DocFile[]): SearchResult {
    const members = docs.map((doc) => doc.memberName).sort()

    let output = `📖 Members of '${className}' (${members.length}):\n\n`
    members.forEach((member) => {
      output += `  • ${member}\n`
    })
    output += `\n💡 Usage: docs-finder ${className} <memberName>\n`

    return {type: `list`, data: output}
  }

  /**
   * Search member across all classes and show suggestions
   */
  private searchMemberSuggestions(memberName: string): SearchResult {
    const lowerMember = memberName.toLowerCase()

    // Find exact matches
    const exactMatches = this.docFiles.filter((doc) => doc.memberName.toLowerCase() === lowerMember)

    // Find partial matches
    const partialMatches = this.docFiles.filter((doc) => doc.memberName.toLowerCase().includes(lowerMember) && !exactMatches.includes(doc))

    const allMatches = [...exactMatches, ...partialMatches]

    if (allMatches.length === 0) {
      // Try fuzzy search on full path
      const fuzzyMatches = this.docFiles.filter((doc) => doc.fullPath.toLowerCase().includes(lowerMember)).slice(0, 5)

      if (fuzzyMatches.length === 0) {
        return {
          type: `suggestions`,
          data: `❌ Not found: ${memberName}\n\n💡 Try: docs-finder (to see all classes)`
        }
      }

      let output = `❌ Not found: ${memberName}\n\nDid you mean:\n`
      fuzzyMatches.forEach((doc) => {
        output += `  • ${this.requiredPrefix}.${doc.className}.${doc.memberName}\n`
      })
      return {type: `suggestions`, data: output}
    }

    // Show suggestions with proper format
    let output = `❌ Not found: ${memberName}\n\nDid you mean:\n`
    allMatches.slice(0, 5).forEach((doc) => {
      output += `  • ${this.requiredPrefix}.${doc.className}.${doc.memberName}\n`
    })

    return {type: `suggestions`, data: output}
  }

  /**
   * Get exact documentation file
   */
  private getExactDoc(className: string, memberName: string): SearchResult {
    const doc = this.docFiles.find((d) => d.className.toLowerCase() === className.toLowerCase() && d.memberName.toLowerCase() === memberName.toLowerCase())

    if (!doc) {
      // Show suggestions
      const suggestions = this.docFiles.filter((d) => d.className.toLowerCase().includes(className.toLowerCase()) || d.memberName.toLowerCase().includes(memberName.toLowerCase()))

      let output = `❌ Not found: ${className}.${memberName}\n\n`

      if (suggestions.length > 0) {
        output += `Did you mean:\n`
        suggestions.slice(0, 5).forEach((s) => {
          output += `  • ${this.requiredPrefix}.${s.className}.${s.memberName}\n`
        })
      } else {
        output += `💡 Try: docs-finder ${className} (to see all members)\n`
      }

      return {type: `suggestions`, data: output}
    }

    // Return the doc for reading
    return {type: `file`, data: [doc]}
  }

  /**
   * Output result to stdout (for Claude to read)
   */
  output(result: SearchResult): void {
    if (result.type === `list` || result.type === `suggestions`) {
      console.log(result.data)
    } else {
      // Output file content directly for Claude to read
      const docs = result.data as DocFile[]
      docs.forEach((doc) => {
        try {
          const content = fs.readFileSync(doc.filePath, `utf-8`)
          console.log(`\n${`=`.repeat(60)}`)
          console.log(`📄 ${doc.prefix}.${doc.className}.${doc.memberName}`)
          console.log(`${`=`.repeat(60)}\n`)
          console.log(content)
        } catch (error) {
          console.error(`❌ Error reading file: ${error instanceof Error ? error.message : `Unknown error`}`)
        }
      })
    }
  }
}

// CLI Entry Point
function main() {
  const args = process.argv.slice(2)

  // Get configuration from environment
  const docsDir = process.env.DOCS_DIR || `C:\\damar-files\\PROJECT-ORG-GRAMSTAX\\gramstax\\packages\\gramstax\\docs\\markdown`
  const prefix = process.env.DOCS_PREFIX || `gramstax`

  const finder = new DocsFinder(docsDir, prefix)
  const result = finder.search(args[0], args[1])

  finder.output(result)
}

// Run if executed directly
if (require.main === module) {
  main()
}

export {DocsFinder}
