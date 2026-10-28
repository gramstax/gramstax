// Keep every skill's advertised version equal to the version being released.
//
//   node scripts/skills/sync-version.mjs          rewrite drifted SKILL.md files
//   node scripts/skills/sync-version.mjs --check  exit 1 on drift (CI gate)
//
// A SKILL.md frontmatter carries `metadata.version`, which tells a consumer
// which package release the rules describe. Nothing in the code reads that
// field, so it silently rots: `nx release` bumps the four package manifests and
// tags the commit, but the five skills keep advertising whatever version they
// had when they were last edited by hand.
//
// This script makes the manifests the single source of truth. All four packages
// are published at one workspace version (nx.json releases `packages/*` with a
// single tag), so a divergence between them is a defect, not a case to resolve
// here. `skills-version.yml` runs the sync after a successful release and
// commits the result; `bun run skills:version:check` runs in `ci:check` and in
// the release job, so a tree with stale skills never gets versioned.
//
// The rewrite splices the version token in place instead of rebuilding the
// file. Frontmatter is prose people edit on Windows and CI checks out on Linux,
// and a whole-file rewrite would quietly normalise CRLF to LF or reflow the
// block. Only the bytes of the version token change.

import {readFileSync, readdirSync, writeFileSync} from "node:fs"
import {dirname, join, resolve} from "node:path"
import {fileURLToPath} from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, "..", "..")
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/

const USAGE = `Usage: node scripts/skills/sync-version.mjs [--check]

  (no flag)  rewrite every skills/*/SKILL.md whose metadata.version differs
             from the released package version
  --check    report drift and exit 1 without writing anything
  --help     print this message`

function fail(message) {
  console.error(message)
  process.exit(1)
}

function subdirectories(parent) {
  return readdirSync(join(REPO, parent), {withFileTypes: true})
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

/** The one version all four packages are published at. */
function canonicalVersion() {
  const found = []
  for (const name of subdirectories(`packages`)) {
    const rel = `packages/${name}/package.json`
    let raw
    try {
      raw = readFileSync(join(REPO, rel), `utf8`)
    } catch {
      continue
    }
    let manifest
    try {
      manifest = JSON.parse(raw)
    } catch (error) {
      fail(`${rel}: invalid JSON (${String(error)})`)
    }
    if (typeof manifest.version !== `string` || manifest.version.length === 0) fail(`${rel}: missing "version"`)
    found.push({rel, version: manifest.version})
  }
  if (found.length === 0) fail(`no packages/*/package.json found under ${REPO}`)

  const versions = new Set(found.map((entry) => entry.version))
  if (versions.size > 1) {
    console.error(`package versions diverged — nx releases one workspace version:`)
    for (const entry of found) console.error(`  ${entry.rel.padEnd(40)} ${entry.version}`)
    fail(`Fix the manifests before touching skill metadata.`)
  }

  const version = [...versions][0]
  if (!SEMVER.test(version)) fail(`packages/*/package.json: "${version}" is not a semver version`)
  return {version, count: found.length}
}

/**
 * Locate `metadata.version` inside the frontmatter.
 *
 * Returns the file text plus the absolute bounds of the version token, so the
 * caller can splice it without touching a single other byte.
 */
function readSkill(rel) {
  const text = readFileSync(join(REPO, rel), `utf8`)

  const open = /^---\r?\n/.exec(text)
  if (!open) fail(`${rel}: missing YAML frontmatter (expected a leading --- line)`)
  const frontmatterStart = open[0].length

  const close = /\r?\n---[ \t]*(?:\r?\n|$)/.exec(text.slice(frontmatterStart))
  if (!close) fail(`${rel}: unterminated YAML frontmatter (no closing ---)`)
  const frontmatter = text.slice(frontmatterStart, frontmatterStart + close.index)

  const metadata = /^metadata:[ \t]*\r?$/m.exec(frontmatter)
  if (!metadata) fail(`${rel}: frontmatter has no top-level \`metadata:\` block`)

  // Only the indented lines directly under `metadata:` belong to the block; a
  // `version:` under any other key must never satisfy this lookup.
  const blockStart = metadata.index + metadata[0].length
  let blockEnd = frontmatter.length
  const lines = /\r?\n([^\r\n]*)/g
  lines.lastIndex = blockStart
  let line
  while ((line = lines.exec(frontmatter)) !== null) {
    const content = line[1]
    if (content.trim() === ``) continue
    if (!/^[ \t]/.test(content)) {
      blockEnd = line.index
      break
    }
  }

  const block = frontmatter.slice(blockStart, blockEnd)
  const version = /^([ \t]+version:[ \t]*)([^\r\n]+?)([ \t]*)\r?$/m.exec(block)
  if (!version) fail(`${rel}: \`metadata:\` has no \`version:\` field`)

  const tokenStart = frontmatterStart + blockStart + version.index + version[1].length
  const token = version[2]
  if (token.length === 0) fail(`${rel}: \`metadata.version\` is empty`)
  return {rel, text, version: token, tokenStart, tokenEnd: tokenStart + token.length}
}

function skills() {
  const found = []
  for (const name of subdirectories(`skills`)) {
    const rel = `skills/${name}/SKILL.md`
    try {
      readFileSync(join(REPO, rel))
    } catch {
      continue
    }
    found.push(readSkill(rel))
  }
  if (found.length === 0) fail(`no skills/*/SKILL.md found under ${REPO}`)
  return found
}

const args = process.argv.slice(2)
if (args.includes(`--help`)) {
  console.log(USAGE)
  process.exit(0)
}
const unknown = args.filter((arg) => arg !== `--check`)
if (unknown.length > 0) fail(`unknown argument${unknown.length === 1 ? `` : `s`}: ${unknown.join(`, `)}\n\n${USAGE}`)
const check = args.includes(`--check`)

const {version, count} = canonicalVersion()
const entries = skills()

console.log(`skills version ${check ? `check` : `sync`} — canonical ${version} (${count} packages agree)`)

let drift = 0
for (const entry of entries) {
  if (entry.version === version) {
    if (check) console.log(`  ok        ${entry.rel}`)
    continue
  }
  drift += 1
  if (check) {
    console.log(`  MISMATCH  ${entry.rel.padEnd(48)} ${entry.version} (expected ${version})`)
    continue
  }
  writeFileSync(join(REPO, entry.rel), `${entry.text.slice(0, entry.tokenStart)}${version}${entry.text.slice(entry.tokenEnd)}`)
  console.log(`  updated   ${entry.rel.padEnd(48)} ${entry.version} -> ${version}`)
}

if (check) {
  if (drift > 0) {
    console.error(``)
    console.error(`FAIL: ${drift} of ${entries.length} skills advertise a version other than ${version}.`)
    console.error(`Run \`bun run skills:version:sync\` and commit the result.`)
    process.exit(1)
  }
  console.log(`${entries.length} skills match ${version}.`)
  process.exit(0)
}

if (drift === 0) {
  console.log(`already in sync — nothing written.`)
} else {
  console.log(`${drift} of ${entries.length} files updated; stage \`skills/\` and commit.`)
}
