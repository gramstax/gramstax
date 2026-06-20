import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static step1 = `s1`
}

class Main {
  static async showStep1Form(ctx: BlockSwitchPage, status: string) {
    const bi = Base.step1
    const da = {status}
    const kb = ctx.inlineKeyboardT([ctx.data.callbackData(bi, status == `1` ? `0` : `1`), StartPage], `1`, bi, da)
    await ctx.edit(kb, da, bi)
  }

  static async processStep1Answer(ctx: BlockSwitchPage, status: string) {
    await Main.showStep1Form(ctx, status)
  }
}

export class BlockSwitchPage extends PageBase {
  static data = this.buildData((step?: string, status?: string) => [step, status])

  async handleCallbackData() {
    await Main.showStep1Form(this, `0`)
  }

  async handleArgsCallbackData() {
    const [step, status] = this.callbackDataArgs
    if (step === Base.step1) {
      await Main.processStep1Answer(this, status!)
    }
  }

  static template = `
    <g-base id="${Base.step1}">
      <g-keyboard>
        <g-switch value="status">
          <g-case is="1">🔴 Off</g-case>
          <g-default>🟢 On</g-default>
        </g-switch>,
        ${this.kbl.back.default}
      </g-keyboard>
      <g-keyboard lang="id">
        <g-switch value="status">
          <g-case is="1">🔴 Mati</g-case>
          <g-default>🟢 Nyala</g-default>
        </g-switch>,
        ${this.kbl.back.id}
      </g-keyboard>

      <g-message>
        <b>🔀 Template switch demo</b>

        <g-switch value="status">
          <g-case is="1">Active</g-case>
          <g-default>Inactive</g-default>
        </g-switch>

        Toggle the button to see the template update in real time.
      </g-message>
      <g-message lang="id">
        <b>🔀 Demo switch template</b>

        <g-switch value="status">
          <g-case is="1">Aktif</g-case>
          <g-default>Tidak Aktif</g-default>
        </g-switch>

        Tekan tombol untuk melihat pembaruan template secara langsung.
      </g-message>
    </g-base>
  `
}
