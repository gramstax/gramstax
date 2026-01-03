import {PageBase} from "~/base/page"

export class KbbePage extends PageBase {
  static data = this.buildData({
    text: `📚 Kbbe:` // <===== overrides "text" data route, default (kbbe)
  })

  kb(count?: number, removeKb?: boolean) {
    const params = {data: {first: this.data.text}}
    return this.bottomKeyboard((kb, arr) => {
      kb.text(count === undefined ? `${arr[0]!} 0` : `${arr[0]} ${count + 1}`)
        .row()
        .text(arr[1]!)
        .oneTime()
      if (removeKb) {
        kb.removeKeyboard()
      }
      return kb
    }, params)
  }

  async internal(count?: number, removeKb?: boolean) {
    await this.reply(this.kb(count, removeKb))
  }

  async callback() {
    await this.internal()
  }

  async text() {
    await this.internal()
  }

  async textPayload() {
    await this.internal(parseInt(this.msgTextPayload))
  }

  async textCommand() {
    await this.internal()
  }

  async textCommandPayload() {
    if (this.msgTextPayload == `reset`) {
      await this.internal()
    }
  }

  static template = /*jsx*/ `    
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
