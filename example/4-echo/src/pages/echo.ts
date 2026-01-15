import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Echo page responds to any free text input.
export class EchoPage extends PageBase {
  kb() {
    return this.inlineKeyboard((k, a) => {
      return k.text(a[0]!, StartPage.data.callback())
    })
  }

  // Inline button to show echo usage tips.
  async callback() {
    const kb = this.kb()
    const bi = `tips`
    await this.edit(kb, {}, bi)
  }

  // Catch-all for text inputs that are not matched by other pages.
  async textFree() {
    if (this.msgText.startsWith(`/`)) {
      return null
    }
    const kb = this.kb()
    const bi = `echo-result`
    const data = {input: this.msgText}
    await this.reply(kb, data, bi)
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
