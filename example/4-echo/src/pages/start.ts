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

  async textCommand() {
    await this.show(false)
  }

  async callback() {
    await this.show(true)
  }

  static template = `
    <base>
      <keyboard>Help, Echo Tips</keyboard>
      <message>
        Welcome to the Echo Bot!

        Send any message and I will repeat it back.
      </message>
    </base>
  `
}
