import {PageBase} from "~/base/page"
import {HelpPage} from "./help"
import {EchoPage} from "./echo"

// Start page with welcome message and navigation.
export class StartPage extends PageBase {
  static data = this.buildData((payload?: string) => [payload])

  kb() {
    return this.ikb((k, a) => {
      return k.text(a[0]!, HelpPage.data.callback()).text(a[1]!, EchoPage.data.callback())
    })
  }

  async textCommand() {
    await this.reply(this.kb())
  }

  async callback() {
    await this.edit(this.kb())
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
