import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Echo page responds to any free text input.
export class EchoPage extends PageBase {
  static data = this.buildData((payload?: string) => [payload])

  kb() {
    return this.ikb((k, a) => {
      return k.text(a[0]!, StartPage.data.callback())
    })
  }

  // Inline button to show echo usage tips.
  async callback() {
    await this.edit(this.kb(), {}, `tips`)
  }

  // Catch-all for text inputs that are not matched by other pages.
  async textFree() {
    if (this.msgText.startsWith(`/`)) {
      return null
    }

    const data = {
      input: this.msgText
    }

    await this.reply(this.kb(), data, `echo-result`)
  }

  static template = `
    <base>
      <keyboard>Back to Start</keyboard>
      <message>
        Tap Echo Tips to see how echo works.
      </message>
    </base>

    <base id="tips">
      <message>
        Echo Tips:
        - Send any text
        - The bot repeats the same message
      </message>
    </base>

    <base id="echo-result">
      <message>
        Echo: {{input}}
      </message>
    </base>
  `
}
