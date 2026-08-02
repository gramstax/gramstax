/**
 * Case 3: Safe Data Binding (Default Behavior)
 *
 * This POC demonstrates that the standard {{variable}} syntax is SAFE against
 * data injection from users (e.g., names, bio, messages).
 *
 * Why it is safe: The engine converts {{key}} into data["key"] access inside the
 * template literal. JavaScript treats the value of data["key"] strictly as a
 * string/value, and does NOT re-evaluate it as code even if it contains
 * backticks or ${} syntax.
 *
 * Result: User-provided data cannot trigger RCE as long as it is handled via {{}}.
 */

import {TemplateEngine} from "../packages/gramstax/src/template/engine.js"

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
const result = messages.default.default({username: maliciousUserInput})

console.log(`Final Result (Should be safe string):`, result)
console.log(`Verification: No code was executed.`)
