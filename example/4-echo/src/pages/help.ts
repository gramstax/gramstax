import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Help page lists available commands.
export class HelpPage extends PageBase {
  static data = this.buildData((payload?: string) => [payload])

  kb() {
    return this.ikb((k, a) => {
      return k.text(a[0]!, StartPage.data.callback())
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
