/**
 * Case 6: Switch/Each Static Body Breakout
 *
 * This POC proves that backticks and `${}` smuggled into `<g-case>`,
 * `<g-default>`, and `<g-map>` static bodies cannot break out of the
 * generated code. Bodies pass through `_escapeStaticExceptInterpolation`
 * (backticks escaped; a `${...}` span stays live only when it passes the
 * `_isGeneratedCode` gate, i.e. it was produced by an inner block
 * processor — anything else is neutralized to `\${`), so hostile static
 * text renders literally even when the matched branch renders, consistent
 * with top-level static text. Legitimate interpolation stays available
 * via `{{}}`, which is converted to generated code afterwards.
 *
 * Expected: the payload prints literally; no code executes.
 */

import {TemplateEngine} from "../src/template/engine.js"

console.log(`--- CASE 6: SWITCH/EACH STATIC BODY BREAKOUT ---`)

const store = globalThis as unknown as Record<string, unknown>
store.__poc6 = false

const tick = String.fromCharCode(96)
const payload = `${tick} + ((globalThis as unknown as Record<string, unknown>).__poc6 = true) + ${tick}\${store.__poc6}`

// Attack 1: breakout inside the rendered <g-case> branch.
const templateSwitch = `<g-base><g-message><g-switch value="role"><g-case is="admin">${payload}</g-case><g-default>user</g-default></g-switch></g-message></g-base>`
const renderSwitch = TemplateEngine.compileBlockGMessage(templateSwitch).default?.default
if (!renderSwitch) throw new Error(`compile produced no default message`)
const outSwitch = renderSwitch({role: `admin`})
console.log(`Switch output:`, JSON.stringify(outSwitch))

// Attack 2: breakout inside a <g-map> loop body.
const templateMap = `<g-base><g-message><g-map src="items">${payload}</g-map></g-message></g-base>`
const renderMap = TemplateEngine.compileBlockGMessage(templateMap).default?.default
if (!renderMap) throw new Error(`compile produced no default message`)
const outMap = renderMap({items: [`a`]})
console.log(`Map output:`, JSON.stringify(outMap))

if (store.__poc6 === true) {
  console.log(`VULNERABLE: static body breakout executed code`)
  process.exit(1)
} else if (typeof outSwitch === `string` && outSwitch.includes(`__poc6`) && typeof outMap === `string` && outMap.includes(`__poc6`)) {
  console.log(`SAFE: payloads rendered inertly (escaped), no code executed`)
} else {
  console.log(`UNEXPECTED: payload missing from output`)
  process.exit(1)
}
