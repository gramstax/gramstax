/**
 * Case 5: Filter Argument Injection
 *
 * This POC proves that malicious filter names and arguments in `{{var|filter}}`
 * pipes cannot break out of the generated code. Filter arguments are embedded
 * via `JSON.stringify` (never raw backticks), the argument string splits on
 * the first `:` only, and unknown filter names render empty with a
 * compile-time warning.
 *
 * Expected: no code executes; malicious pipes render empty or inert text.
 */

import {TemplateEngine} from "../src/template/engine.js"

console.log(`--- CASE 5: FILTER ARGUMENT INJECTION ---`)

const store = globalThis as unknown as Record<string, unknown>
store.__poc5 = false

const tick = String.fromCharCode(96)

// Attack 1: backtick breakout inside a filter argument. The old chain builder
// wrapped args in raw backticks, so this would execute. It must now be inert.
const breakoutArg = `${tick}, ((globalThis as unknown as Record<string, unknown>).__poc5 = true), ${tick}`
const templateArg = `<g-base><g-message>{{name|default:${breakoutArg}}}</g-message></g-base>`
const renderArg = TemplateEngine.compileBlockGMessage(templateArg).default?.default
if (!renderArg) throw new Error(`compile produced no default message`)
const outArg = renderArg({})
console.log(`Arg-breakout output:`, JSON.stringify(outArg))

// Attack 2: code hidden in the filter NAME. Unknown names render "".
const templateName = `<g-base><g-message>{{name|upper")), ((globalThis as unknown as Record<string, unknown>).__poc5 = true), (("}}</g-message></g-base>`
const renderName = TemplateEngine.compileBlockGMessage(templateName).default?.default
if (!renderName) throw new Error(`compile produced no default message`)
const outName = renderName({name: `bob`})
console.log(`Name-breakout output:`, JSON.stringify(outName))

// Attack 3: `${}` payload inside a filter argument must stay literal.
const templateInterp = `<g-base><g-message>{{name|default:\${store.__poc5}}}</g-message></g-base>`
const renderInterp = TemplateEngine.compileBlockGMessage(templateInterp).default?.default
if (!renderInterp) throw new Error(`compile produced no default message`)
const outInterp = renderInterp({})
console.log(`Interpolation-arg output:`, JSON.stringify(outInterp))

if (store.__poc5 === true) {
  console.log(`VULNERABLE: filter injection executed code`)
  process.exit(1)
} else {
  console.log(`SAFE: no code executed through filter pipes`)
}
