import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Help page lists available commands.
export class HelpPage extends PageBase {
  async show(edit = true) {
    const kb = this.inlineKeyboardT([StartPage])
    if (edit) this.edit(kb)
    else this.reply(kb)
  }

  async handleCommandText() {
    await this.show(false)
  }

  async handleCallbackData() {
    await this.show(true)
  }

  static template = `
    <base>
      ${this.kbk.back()}
      <message>
        ❓ Help
        
        Available commands:
        - /start: Welcome message
        - /help: Show this help

        You can also send any message to echo it back.
      </message>
    </base>
  `
}
