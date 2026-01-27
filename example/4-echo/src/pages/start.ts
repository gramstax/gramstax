import {PageBase} from "~/base/page"
import {HelpPage} from "./help"
import {EchoPage} from "./echo"

// Start page with welcome message and navigation.
export class StartPage extends PageBase {
  async show(edit = true) {
    const kb = this.inlineKeyboardT([HelpPage, EchoPage])
    if (edit) await this.edit(kb)
    else await this.reply(kb)
  }

  async handleCommandText() {
    await this.show(false)
  }

  async handleCallbackData() {
    await this.show(true)
  }

  static template = `
    <base>
      <keyboard>❓ Help, 🔁 Echo Tips</keyboard>
      <message>
        🔊 Echo Bot

        Send any message and I will repeat it back exactly as received. You can try text, photos, videos, documents, and more.
      </message>
    </base>
  `
}
