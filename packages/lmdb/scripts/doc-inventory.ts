import ts from "typescript"
import {readFileSync} from "node:fs"
import {globSync} from "node:fs"

const files = globSync("src/**/*.ts", {cwd: process.cwd()}).sort()

type Row = {
  file: string
  line: number
  name: string
  kind: string
  visibility: "public" | "private" | "protected"
  params: string[]
  hasDoc: boolean
  underscore: boolean
  depth: number
}

/** JSDoc presence from raw text: robust across TS compiler versions. */
const hasLeadingDoc = (text: string, start: number): boolean => {
  const at = (i: number): string => (i >= 0 && i < text.length ? (text[i] as string) : ``)
  let i = start - 1
  while (i >= 0 && /\s/.test(at(i))) i--
  if (at(i) !== `/` || at(i - 1) !== `*`) return false
  let j = i - 2
  while (j >= 1) {
    if (at(j) === `/` && at(j + 1) === `*`) return true
    if (at(j) === `*` && at(j + 1) === `/`) return false
    j--
  }
  return false
}

const rows: Row[] = []

for (const f of files) {
  const text = readFileSync(f, "utf8")
  const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true)

  const push = (
    fn: ts.FunctionLikeDeclaration,
    kind: string,
    nameNode: ts.PropertyName | ts.BindingName | undefined,
    owner: ts.Node,
    depth: number,
    docOwner: ts.Node = owner
  ) => {
    let name = "<anonymous>"
    if (nameNode) {
      name =
        ts.isIdentifier(nameNode) || ts.isPrivateIdentifier(nameNode)
          ? nameNode.text
          : nameNode.getText(sf)
    }
    const mods = ts.canHaveModifiers(owner) ? (ts.getModifiers(owner) ?? []) : []
    const visibility = mods.some((m) => m.kind === ts.SyntaxKind.PrivateKeyword)
      ? "private"
      : mods.some((m) => m.kind === ts.SyntaxKind.ProtectedKeyword)
        ? "protected"
        : "public"
    rows.push({
      file: f,
      line: sf.getLineAndCharacterOfPosition(owner.getStart(sf)).line + 1,
      name,
      kind,
      visibility,
      params: fn.parameters.map((p) => p.name.getText(sf).replace(/^\.\.\./, "")),
      hasDoc: hasLeadingDoc(text, docOwner.getStart(sf)),
      underscore: name.startsWith("_"),
      depth
    })
  }

const visit = (node: ts.Node, depth: number) => {
    if (ts.isFunctionDeclaration(node)) {
      push(node, "function", node.name, node, depth)
    } else if (ts.isMethodDeclaration(node)) {
      push(node, "method", node.name, node, depth)
    } else if (ts.isConstructorDeclaration(node)) {
      push(node, "constructor", undefined, node, depth)
    } else if (ts.isGetAccessorDeclaration(node)) {
      push(node, "getter", node.name, node, depth)
    } else if (ts.isSetAccessorDeclaration(node)) {
      push(node, "setter", node.name, node, depth)
    } else if (ts.isPropertyDeclaration(node) && node.initializer) {
      const init = node.initializer
      if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
        push(init, "property-fn", node.name, node, depth)
      }
    } else if (ts.isVariableDeclaration(node) && node.initializer) {
      const init = node.initializer
      if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
        // `const` lives on the VariableStatement, not the declaration, so anchor
        // the JSDoc lookup there — otherwise the scan starts at the binding name
        // and stops on the `=`.
        push(init, "const-fn", node.name, node, depth, node.parent)
      }
    }
    const next =
      ts.isFunctionDeclaration(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isConstructorDeclaration(node) ||
      ts.isGetAccessorDeclaration(node) ||
      ts.isSetAccessorDeclaration(node) ||
      ts.isFunctionExpression(node)
        ? depth + 1
        : depth
    ts.forEachChild(node, (c) => visit(c, next))
  }

  visit(sf, 0)
}

const missing = rows.filter((r) => !r.hasDoc)

const byFile = new Map<string, {total: number; missing: number; lines: number}>()
for (const r of rows) {
  const e = byFile.get(r.file) ?? {total: 0, missing: 0, lines: 0}
  e.total++
  if (!r.hasDoc) e.missing++
  byFile.set(r.file, e)
}
for (const f of files) {
  const e = byFile.get(f)
  if (e) e.lines = readFileSync(f, "utf8").split("\n").length
}

console.log(
  `${"file".padEnd(28)}${"lines".padStart(7)}${"callables".padStart(11)}${"missing".padStart(9)}`
)
let tm = 0
let tt = 0
for (const [f, e] of [...byFile.entries()].sort((a, b) => b[1].missing - a[1].missing)) {
  console.log(
    `${f.replace(/\\/g, "/").padEnd(28)}${String(e.lines).padStart(7)}${String(e.total).padStart(11)}${String(e.missing).padStart(9)}`
  )
  tm += e.missing
  tt += e.total
}
console.log(`\nTOTAL callables: ${tt}   undocumented: ${tm}`)

const pub = missing.filter((r) => r.visibility === "public" && !r.underscore)
console.log(`  public, non-underscore : ${pub.length}`)
console.log(`  private / _-prefixed   : ${missing.length - pub.length}`)
if (process.argv.includes("--list")) {
  const byFile2 = new Map<string, Row[]>()
  for (const r of missing) {
    const e = byFile2.get(r.file) ?? []
    e.push(r)
    byFile2.set(r.file, e)
  }
  for (const [f, list] of [...byFile2.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n### ${f.split("\\").join("/")}  (${list.length})`)
    for (const r of list) {
      console.log(
        `  L${String(r.line).padStart(5)} d${r.depth} ${r.visibility.padEnd(9)} ${r.kind.padEnd(11)} ${r.name}(${r.params.join(", ")})`
      )
    }
  }
}
