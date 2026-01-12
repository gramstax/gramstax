import {PageBase} from "~/base/page"

export class KbbePage extends PageBase {
  static data = this.buildData({
    text: `📚 Kbbe:` // <===== overrides "text" data route, default (kbbe)
  })

  kb(count?: number) {
    const params = {data: {first: this.data.text}}
    return this.bkb((k, a) => {
      k.text(count === undefined ? `${a[0]!} 0` : `${a[0]} ${count + 1}`)
        .row()
        .text(a[1]!)
        .oneTime()
      return k
    }, params)
  }

  async internal(count?: number) {
    await this.reply(this.kb(count))
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
    const pld = this.msgTextCommandPayload
    console.log({pld})
    if (pld == `reset`) {
      await this.internal()
    }
    if (pld == `delete`) {
      await this.reply(undefined, undefined, undefined, {reply_markup: {remove_keyboard: true}})
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
