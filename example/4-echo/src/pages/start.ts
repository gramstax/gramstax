import {PageBase} from "~/base/page"
import {HelpPage} from "./help"
import {EchoPage} from "./echo"

// Start page with welcome message and navigation.
export class StartPage extends PageBase {
  kb() {
    return this.inlineKeyboard((k, a) => {
      return k //
        .text(a[0]!, HelpPage.data.callback())
        .text(a[1]!, EchoPage.data.callback())
    })
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
      <keyboard>Help, Echo Tips</keyboard>
      <message>
        Welcome to the Echo Bot!

        Send any message and I will repeat it back.
      </message>
    </base>
  `
}
