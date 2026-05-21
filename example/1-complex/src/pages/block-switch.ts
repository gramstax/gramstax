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
    <base id="${Base.step1}">
      <keyboard>
        <switch value="status">
          <case is="1">🔴 Off</case>
          <default>🟢 On</default>
        </switch>,
        ${this.kbl.back.default}
      </keyboard>
      <keyboard lang="id">
        <switch value="status">
          <case is="1">🔴 Mati</case>
          <default>🟢 Nyala</default>
        </switch>,
        ${this.kbl.back.id}
      </keyboard>

      <message>
        <b>🔀 Template switch demo</b>

        <switch value="status">
          <case is="1">Active</case>
          <default>Inactive</default>
        </switch>

        Toggle the button to see the template update in real time.
      </message>
      <message lang="id">
        <b>🔀 Demo switch template</b>

        <switch value="status">
          <case is="1">Aktif</case>
          <default>Tidak Aktif</default>
        </switch>

        Tekan tombol untuk melihat pembaruan template secara langsung.
      </message>
    </base>
  `
}
