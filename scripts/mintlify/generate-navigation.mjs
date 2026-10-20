// Generate docs-site/config/navigation.json from the api-documenter output.
//
// Mintlify's `sdk` auto-generation only accepts typedoc/docfx/javadoc/sphinx/
// phpdoc artifacts, so it cannot read api-documenter output. Navigation is
// therefore derived here from each page's own heading and committed, because
// docs.json references this file by `$ref`.
//
// Search carries the long tail. The reference is roughly 800 class-member
// pages out of 1,800, so every group is de-weighted via `boost` except the
// overview, which stays on top.
//
// The tree is split into tabs. Mintlify accepts one child-element type per
// level, so a tab carries either `groups` or `pages`, never both, and a group
// always carries `pages`. The single exception is a `{group, pages}` object
// nested inside a `pages` array, which is how class members are grouped.

import {mkdirSync, readdirSync, readFileSync, writeFileSync} from "node:fs"
import {dirname, join, resolve} from "node:path"
import {fileURLToPath} from "node:url"

export function run(SITE) {
  const REFERENCE = join(SITE, "reference")

  // Hand-written pages. The generator owns the reference groups because those
  // are derived from the corpus; these are not, so they are declared here
  // rather than hand-edited into a generated file.
  //
  // Bootstrap pages, end-user help, and learn material are separated by intent
  // (ship the thing / it broke / understand it), not by subject, so each tab
  // stays small enough to scan.
  const DOCUMENTATION_TAB = {
    tab: "Documentation",
    icon: "book-open",
    groups: [
      {
        group: "Get started",
        icon: "rocket",
        boost: 2,
        pages: ["index", "introduction", "quickstart", "guides/packages"]
      },
      {
        // Every guide is reachable here. The 26 entries live in seven nested
        // groups rather than one flat list, because a single 26-row group is
        // the sidebar equivalent of a wall of text. Nesting `{group, pages}`
        // inside a `pages` array is the one shape Mintlify accepts for this.
        group: "Guides",
        icon: "book",
        boost: 1.5,
        pages: [
          {
            group: "Boot and deploy",
            icon: "play",
            pages: ["guides/getting-started", "guides/configuration", "guides/gramstax-start", "guides/gramstax-build", "guides/examples", "guides/serverless-deploy"]
          },
          {
            group: "Pages",
            icon: "file-code",
            pages: ["guides/pages", "guides/routing", "guides/guards", "guides/keyboards", "guides/sessions"]
          },
          {
            group: "Templates",
            icon: "blocks",
            pages: ["guides/template-blocks", "guides/rich-html", "guides/filters", "guides/aot-contract"]
          },
          {
            group: "Replies and fan-out",
            icon: "message-circle",
            pages: ["guides/query-answers", "guides/broadcast", "guides/errors"]
          },
          {
            group: "Operations",
            icon: "activity",
            pages: ["guides/observability", "guides/rate-limiting", "guides/update-queue", "guides/session-lock"]
          },
          {
            group: "Integrations",
            icon: "plug",
            pages: ["guides/storage-lmdb", "guides/worker-threads"]
          },
          {
            group: "Testing and migration",
            icon: "flask-conical",
            pages: ["guides/e2e-testing", "guides/migrating-to-6"]
          }
        ]
      }
    ]
  }

  const LEARN_TAB = {
    tab: "Learn",
    icon: "graduation-cap",
    groups: [
      {
        group: "Core concepts",
        icon: "shapes",
        boost: 1.5,
        pages: ["concepts/page-routing", "concepts/render-contract", "concepts/templates", "concepts/deploy", "concepts/concurrency", "concepts/extending"]
      },
      {group: "Architecture", icon: "sitemap", boost: 1.5, pages: ["guides/architecture"]},
      {group: "Development", icon: "code", boost: 1.5, pages: ["guides/development"]},
      {group: "Glossary", icon: "spell-check", boost: 1.5, pages: ["guides/glossary"]},
      // The eight ADRs are listed individually. Declaring only
      // `guides/adr/index` left every record unreachable from the sidebar: the
      // index links them, but a search or a shared link into `0001` had no
      // navigation context.
      {
        group: "Decisions",
        icon: "scale",
        boost: 0.8,
        pages: [
          "guides/adr/index",
          "guides/adr/0001-build-on-grammy",
          "guides/adr/0002-template-dsl-new-function",
          "guides/adr/0003-keyv-redis-cache",
          "guides/adr/0004-convention-routing",
          "guides/adr/0005-hot-reload-chokidar",
          "guides/adr/0006-in-process-e2e",
          "guides/adr/0007-bun-tsup-nx-toolchain",
          "guides/adr/0008-lint-export-dep-conventions"
        ]
      }
    ]
  }

  // Support material is two pages. A group around two entries only adds a
  // collapsible row, so this tab uses `pages` directly.
  const HELP_TAB = {tab: "Help", icon: "life-buoy", pages: ["guides/troubleshooting", "guides/faq"]}

  // The API reference tab opens with the two hand-declared overview pages. They
  // also classify as `Other` further down, so this list must stay first: the
  // dedupe pass keeps the first occurrence it sees.
  const OVERVIEW = ["reference/gramstax", "reference/index"]
  const REFERENCE_TAB = {
    tab: "API reference",
    icon: "square-terminal",
    groups: [{group: "Overview", icon: "home", boost: 0.8, pages: OVERVIEW}]
  }

  function classify(heading) {
    if (/\bclass$/.test(heading)) return "Classes"
    // api-documenter writes "X type" for type aliases, not "type alias".
    if (/\b(interface|type)$/.test(heading)) return "Types"
    if (/\bfunction$/.test(heading)) return "Functions"
    if (/\bvariable$/.test(heading)) return "Variables"
    if (/\b(method|property|constructor)\b/.test(heading)) return "Members"
    return "Other"
  }

  // Pages inside a class get listed under that class rather than in one flat
  // member bucket, so the sidebar mirrors the code instead of the alphabet.
  function ownerOf(fileName) {
    const parts = fileName.replace(/\.md$/, "").split(".")
    return parts.length > 2 ? parts[2] : null
  }

  const buckets = new Map()
  for (const file of readdirSync(REFERENCE).filter((f) => f.endsWith(".md"))) {
    const heading = (readFileSync(join(REFERENCE, file), "utf8").match(/^## (.+)$/m) || ["", ""])[1]
    const bucket = classify(heading)
    if (!buckets.has(bucket)) buckets.set(bucket, new Map())
    const members = buckets.get(bucket)
    const page = `reference/${file.replace(/\.md$/, "")}`
    const owner = bucket === "Members" ? ownerOf(file) : null
    if (!owner) {
      members.set(page, {page, heading, members: []})
      continue
    }
    const key = `reference/gramstax.${owner.toLowerCase()}`
    if (!members.has(key)) members.set(key, {page: key, heading: owner, members: []})
    members.get(key).members.push({page, heading})
  }

  const order = ["Classes", "Types", "Functions", "Variables", "Members", "Other"]
  const boosts = {Classes: 1, Types: 1, Functions: 1, Variables: 0.8, Members: 0.4, Other: 0.4}

  for (const bucket of order) {
    const entries = buckets.get(bucket)
    if (!entries || entries.size === 0) continue
    const pages = []
    for (const entry of [...entries.values()].sort((a, b) => a.heading.localeCompare(b.heading))) {
      if (entry.members.length === 0) {
        pages.push(entry.page)
        continue
      }
      const children = [...entry.members].sort((a, b) => a.heading.localeCompare(b.heading)).map((m) => m.page)
      pages.push({group: entry.heading, pages: children})
    }
    REFERENCE_TAB.groups.push({group: bucket, pages, boost: boosts[bucket]})
  }

  const tabs = [DOCUMENTATION_TAB, REFERENCE_TAB, LEARN_TAB, HELP_TAB]

  // A page must be listed exactly once across the whole tree: a repeated entry
  // renders as a second sidebar link and counts twice in search weighting.
  // Walking the tree in order makes the first occurrence win, which is why the
  // overview pages are declared before the derived buckets that also match them.
  const seen = new Set()
  let duplicates = 0
  function claim(entry) {
    if (typeof entry === "string") {
      if (seen.has(entry)) {
        duplicates++
        return null
      }
      seen.add(entry)
      return entry
    }
    const pages = claimAll(entry.pages)
    // A nested group that loses every child would render as an empty
    // collapsible, so it goes too.
    return pages.length > 0 ? {group: entry.group, pages} : null
  }
  function claimAll(pages) {
    return pages.map(claim).filter((entry) => entry !== null)
  }

  for (const tab of tabs) {
    if (tab.pages) tab.pages = claimAll(tab.pages)
    if (!tab.groups) continue
    tab.groups = tab.groups.map((group) => ({...group, pages: claimAll(group.pages)})).filter((group) => group.pages.length > 0)
  }

  // Every element of a `pages` array counts as one entry, including a nested
  // `{group, pages}` row for a class, so the total matches the number of rows
  // the sidebar renders.
  const countOf = (pages) => pages.length + pages.reduce((sum, entry) => sum + (typeof entry === "string" ? 0 : countOf(entry.pages)), 0)

  mkdirSync(join(SITE, "config"), {recursive: true})
  writeFileSync(join(SITE, "config", "navigation.json"), JSON.stringify({tabs}, null, 2))

  console.log("  navigation.json ditulis")
  let total = 0
  for (const tab of tabs) {
    console.log("   tab", tab.tab)
    const rows = tab.groups ?? [{group: tab.tab, pages: tab.pages}]
    for (const row of rows) {
      const n = countOf(row.pages)
      total += n
      console.log("     ", String(row.group).padEnd(14), String(n).padStart(4), "entri")
    }
    console.log("     ", "subtotal".padEnd(14), String(countOf(tab.groups ? tab.groups.flatMap((g) => g.pages) : tab.pages)).padStart(4), "entri")
  }
  console.log("    total entri:", total)
  console.log("    duplikat dibuang:", duplicates)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2] ?? join(resolve(dirname(fileURLToPath(import.meta.url)), "..", ".."), "docs-site")
  run(resolve(target))
}
