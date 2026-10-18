// Generate docs-site/config/navigation.json from the api-documenter output.
//
// Mintlify's `sdk` auto-generation only accepts typedoc/docfx/javadoc/sphinx/
// phpdoc artifacts, so it cannot read api-documenter output. Navigation is
// therefore derived here from each page's own heading and committed, because
// docs.json references this file by `$ref`.
//
// Search carries the long tail. The reference is roughly 800 class-member
// pages out of 1,032, so every group is de-weighted via `boost` except the
// overview, which stays on top.

import {mkdirSync, readdirSync, readFileSync, writeFileSync} from "node:fs"
import {dirname, join, resolve} from "node:path"
import {fileURLToPath} from "node:url"

export function run(SITE) {
  const REFERENCE = join(SITE, "reference")

  // Hand-written pages. The generator owns the reference groups because those are
// derived from the corpus; these are not, so they are declared here rather than
// hand-edited into a generated file.
const PROSE = [
  {group: "Introduction", icon: "book-open", boost: 2, pages: ["introduction"]},
  {group: "Quickstart", icon: "rocket", boost: 2, pages: ["quickstart"]},
  {
    group: "Core concepts",
    icon: "shapes",
    boost: 1.5,
    pages: [
      "concepts/page-routing",
      "concepts/render-contract",
      "concepts/templates",
      "concepts/deploy"
    ]
  },
  {
    group: "Guides",
    icon: "book",
    boost: 1.5,
    pages: [
      "guides/getting-started",
      "guides/gramstax-start",
      "guides/gramstax-build",
      "guides/e2e-testing",
      "guides/serverless-deploy",
      "guides/aot-contract",
      "guides/adr/index",
      "guides/glossary",
      "guides/architecture",
      "guides/development"
    ]
  }
]

const OVERVIEW = ["reference/gramstax", "reference/index"]

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
  for (const file of readdirSync(REFERENCE).filter(f => f.endsWith(".md"))) {
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

  const groups = [
    {group: "Overview", icon: "home", boost: 2, pages: ["index"]},
    ...PROSE,
    {group: "API reference", icon: "code", boost: 0.8, pages: OVERVIEW}
  ]
  let total = 0
  for (const bucket of order) {
    const entries = buckets.get(bucket)
    if (!entries || entries.size === 0) continue
    const pages = []
    for (const entry of [...entries.values()].sort((a, b) => a.heading.localeCompare(b.heading))) {
      if (entry.members.length === 0) {
        pages.push(entry.page)
        continue
      }
      const children = [...entry.members].sort((a, b) => a.heading.localeCompare(b.heading)).map(m => m.page)
      pages.push({group: entry.heading, pages: children})
      total += children.length
    }
    groups.push({group: bucket, pages, boost: boosts[bucket]})
    total += pages.length
  }

  mkdirSync(join(SITE, "config"), {recursive: true})
  writeFileSync(join(SITE, "config", "navigation.json"), JSON.stringify({groups}, null, 2))

  console.log("  navigation.json ditulis")
  for (const group of groups) {
    const n = Array.isArray(group.pages) ? group.pages.length : 0
    console.log("   ", String(group.group).padEnd(12), String(n).padStart(4), "entri")
  }
  console.log("    total entri:", total)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2] ?? join(resolve(dirname(fileURLToPath(import.meta.url)), "..", ".."), "docs-site")
  run(resolve(target))
}