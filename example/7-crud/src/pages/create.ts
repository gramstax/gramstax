import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static s1 = `s1`
  static s2 = `s2`
  static success = `s`
}

class Helper {
  static buildHomeKeyboard(ctx: CreatePage, baseId?: string) {
    const kb = ctx.inlineKeyboardT([StartPage], `1`, baseId)
    return kb
  }

  static getSessionParams(ctx: CreatePage) {
    return (
      (ctx.temp.session?.params as {
        step?: Base
        title?: string
      }) ?? {}
    )
  }
}

class Main {
  static async showStep1Form(ctx: CreatePage) {
    const bi = Base.s1
    const kb = Helper.buildHomeKeyboard(ctx, bi)
    const da = {}
    await ctx.setSessionFreeText({step: bi})
    await ctx.edit(kb, da, bi)
  }

  static async processStep1Answer(ctx: CreatePage, title: string) {
    await ctx.setSessionFreeText({step: Base.s2, title})
    await Main.showStep2Form(ctx, title)
  }

  static async showStep2Form(ctx: CreatePage, title: string) {
    const bi = Base.s2
    const kb = Helper.buildHomeKeyboard(ctx, bi)
    const da = {title}
    await ctx.reply(kb, da, bi)
  }

  static async processStep2Answer(ctx: CreatePage, title: string, description: string) {
    const item = await ctx.db.createItem(ctx.userId, title, description)
    await Main.showSuccess(ctx, {
      id: item.id,
      title: item.title,
      description: item.description,
      status: item.status
    })
  }

  static async showSuccess(ctx: CreatePage, da: {id: string; title: string; description: string; status: string}) {
    await ctx.clearSession()
    const bi = Base.success
    const kb = Helper.buildHomeKeyboard(ctx, bi)
    await ctx.reply(kb, da, bi)
  }
}

// Creates a new item in cache.
export class CreatePage extends PageBase {
  async handleCallbackData() {
    await Main.showStep1Form(this)
  }

  async handleSessionFreeText() {
    const {step, title} = Helper.getSessionParams(this)
    const input = this.msgText.trim()
    if (step === Base.s1) {
      await Main.processStep1Answer(this, input)
    } else if (step === Base.s2) {
      await Main.processStep2Answer(this, title!, input)
    }
  }

  static template = `
    <base id="${Base.s1}">
      ${this.kbk.cancel()}
      <message>
        ✏️ Create a new item

        Send a clear title for the item.
        Example: Coffee Beans
      </message>
      <message lang="id">
        ✏️ Buat item baru

        Kirim judul item yang jelas.
        Contoh: Biji Kopi
      </message>
    </base>

    <base id="${Base.s2}">
      ${this.kbk.cancel()}
      <message>
        ✅ Title saved: {{title}}

        Now send a short description or notes.
        Example: Medium roast, 250g
      </message>
      <message lang="id">
        ✅ Judul tersimpan: {{title}}

        Sekarang kirim deskripsi singkat atau catatan.
        Contoh: Medium roast, 250g
      </message>
    </base>

    <base id="${Base.success}">
      ${this.kbk.home()}
      <message>
        ✅ Item created (#{{id}})

        🏷️ Title: {{title}}
        📝 Description: {{description}}
        📌 Status: {{status}}

        You can update or delete it anytime from the menu.
      </message>
      <message lang="id">
        ✅ Item dibuat (#{{id}})

        🏷️ Judul: {{title}}
        📝 Deskripsi: {{description}}
        📌 Status: {{status}}

        Anda dapat memperbarui atau menghapusnya kapan saja dari menu.
      </message>
    </base>
  `
}
