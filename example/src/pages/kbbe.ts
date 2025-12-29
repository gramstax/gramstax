import { PageBase } from "~/base/page"

export class KbbePage extends PageBase {
  public static data = this.buildData({
    text: `📚 Kbbe:` // <===== overrides "text" data route, default (kbbe)
  })

  public kb(count?: number, removeKb?: boolean) {
    return this.bottomKeyboard(
      (kb, arr) => {
        kb.text(count === undefined ? `${arr[0]!} 0` : `${arr[0]} ${count + 1}`)
          .row()
          .text(arr[1]!)
          .oneTime()
        if (removeKb) {
          kb.removeKeyboard()
        }
        return kb
      },
      {
        data: { first: this.data.text }
      }
    )
  }

  public async internal(count?: number, removeKb?: boolean) {
    await this.reply(this.kb(count, removeKb))
  }

  public async callback() {
    await this.internal()
  }

  public async text() {
    await this.internal()
  }

  public async textPayload() {
    await this.internal(parseInt(this.msgTextPayload))
  }

  public async textCommand() {
    await this.internal()
  }

  public async textCommandPayload() {
    if (this.msgTextPayload == `reset`) {
      await this.internal()
    }
  }

  public static template = /*jsx*/ `    
    <base>
      <keyboard type="bottom">{{first}}, ${this.kbd.back(`default`)}</keyboard>
      <keyboard lang="id" type="bottom">{{first}}, ${this.kbd.back(`id`)}</keyboard>
      <message>Use keyboard bottom with emoji and dynamic payload</message>
      <message lang="id">Gunakan keyboard bottom dengan emoji dan payload dinamis</message>
    </base>
    <base id="reset">
      <message>Reset keyboard payload success</message>
      <message lang="id">Reset keyboard payload sukses</message>    
    </base>
  `
}
