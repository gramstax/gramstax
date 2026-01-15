import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Help page lists available commands.
export class HelpPage extends PageBase {
  kb() {
    return this.ikb((k, a) => k.text(a[0]!, StartPage.data.callback()))
  }

  async textCommand() {
    const kb = this.kb()
    await this.reply(kb)
  }

  async callback() {
    const kb = this.kb()
    await this.edit(kb)
  }

  static template = `
    <base>
      <keyboard>Back to Start</keyboard>
      <message>
        Available commands:
        - /start: Welcome message
        - /help: Show this help

        You can also send any text to echo it back.
      </message>
    </base>
  `
}
