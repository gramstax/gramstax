import { Ctx } from "gramstax"

export class StartPage extends Ctx {
  public kb() {
    return this.inlineKeyboard((kb, arr) => {
      return kb.text(arr[0]!, this.data.callbackData())
    })
  }

  public async internal(edit = true) {
    const kb = this.kb()
    const data = { time: new Date().toString() }
    if (edit) {
      await this.edit(kb, data)
    } else {
      await this.reply(kb, data)
    }
  }

  public async textCommand() {
    await this.internal(false)
  }

  public async callback() {
    await this.internal(true)
  }

  public static template = /*jsx*/ `
    <base>
      <keyboard>Refresh</keyboard>
      <message>
        Hello World! 
        Time now: {{time}}
      </message>
    </base>
  `
}
