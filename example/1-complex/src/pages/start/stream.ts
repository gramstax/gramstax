import {PageBase} from "~/base/page"
import {setTimeout as sleep} from "node:timers/promises"

export class StartStreamPage extends PageBase {
  async handleCallbackQueryData() {
    async function* simulateAI() {
      yield `🤖 *Generating response...*\n\n`
      await sleep(400)

      yield `Below is example how to use \`fetch()\` in Javascript:\n\n`
      await sleep(600)

      yield `\`\`\`js\n`
      await sleep(120)

      yield `const response = await fetch(`
      await sleep(80)

      yield `"https://api.example.com/chat", {\n`
      await sleep(120)

      yield `  method: "POST",\n`
      await sleep(100)

      yield `  headers: {\n`
      await sleep(80)

      yield `    "Content-Type": "application/json",\n`
      await sleep(120)

      yield `  },\n`
      await sleep(80)

      yield `  body: JSON.stringify({\n`
      await sleep(120)

      yield `    prompt: "Hello AI!",\n`
      await sleep(100)

      yield `  }),\n`
      await sleep(100)

      yield `})\n`
      await sleep(120)

      yield `\nconst data = await response.json()\n`
      await sleep(120)

      yield `console.log(data)\n`
      await sleep(80)

      yield `\`\`\`\n\n`
      await sleep(500)

      yield `✅ *Done.*`
    }

    await this.replyWithStream(simulateAI())
  }

  static template = ``
}
