/**
 * Case 3: Safe Data Binding (Default Behavior)
 *
 * This POC proves that the standard `{{variable}}` syntax is safe against
 * data injection from users (e.g., names, bio, messages). Data values are
 * resolved at runtime and never re-evaluated as code, even when they
 * contain backticks or `${}` syntax.
 *
 * Expected: the malicious input prints literally; no code executes.
 */

import {TemplateEngine} from "../src/template/engine.js"

console.log(`--- CASE 3: SAFE DATA BINDING ---`)

// Static template defined by developer
const safeTemplate = `
  <g-base>
    <g-message>
      Hello {{username}}, welcome to the bot!
    </g-message>
  </g-base>
`

console.log(`Compiling template...`)
const messages = TemplateEngine.compileBlockGMessage(safeTemplate)

// Input from a malicious user attempting to inject code through their name
const maliciousUserInput = `\` + console.log("I am trying to hack you") + \`\${process.exit()}`

console.log(`Executing compiled function with malicious data...`)
const render = messages.default?.default
if (!render) throw new Error(`compile produced no default message`)
const result = render({username: maliciousUserInput})

console.log(`Final Result (Should be safe string):`, result)

if (typeof result === `string` && result.includes(maliciousUserInput)) {
  console.log(`SAFE: user input rendered literally, no code executed`)
} else {
  console.log(`UNEXPECTED: user input missing from output`)
  process.exit(1)
}
