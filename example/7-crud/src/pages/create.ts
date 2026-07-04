import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static title = `t`
  static notes = `n`
  static success = `s`
}

class Helper {
  static buildHomeKeyboard(ctx: CreatePage, AGBaseId?: string) {
    const kb = ctx.inlineKeyboardT([StartPage], `1`, AGBaseId)
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
  static async showTitleForm(ctx: CreatePage) {
    const bi = Base.title
    const kb = Helper.buildHomeKeyboard(ctx, bi)
    const da = {}
    await ctx.setSessionFreeText({step: bi})
    await ctx.edit(kb, da, bi)
  }

  static async processTitleForm(ctx: CreatePage, title: string) {
    await ctx.setSessionFreeText({step: Base.notes, title})
    await Main.showNotesForm(ctx, title)
  }

  static async showNotesForm(ctx: CreatePage, title: string) {
    const bi = Base.notes
    const kb = Helper.buildHomeKeyboard(ctx, bi)
    const da = {title}
    await ctx.reply(kb, da, bi)
  }

  static async processNotesForm(ctx: CreatePage, title: string, description: string) {
    const item = await ctx.db.items.create(ctx.userId, title, description)
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
    await Main.showTitleForm(this)
  }

  async handleSessionFreeText() {
    const {step, title} = Helper.getSessionParams(this)
    const input = this.msgText.trim()
    if (step === Base.title) {
      await Main.processTitleForm(this, input)
    } else if (step === Base.notes) {
      await Main.processNotesForm(this, title!, input)
    }
  }

  static template = `
    <g-base id="${Base.title}">
      ${this.kbk.cancel()}
      <g-message>
        ✏️ Create a new item

        Send a clear title for the item.
        Example: Coffee Beans
      </g-message>
      <g-message lang="id">
        ✏️ Buat item baru

        Kirim judul item yang jelas.
        Contoh: Biji Kopi
      </g-message>
    </g-base>

    <g-base id="${Base.notes}">
      ${this.kbk.cancel()}
      <g-message>
        ✅ Title saved: {{title}}

        Now send a short description or notes.
        Example: Medium roast, 250g
      </g-message>
      <g-message lang="id">
        ✅ Judul tersimpan: {{title}}

        Sekarang kirim deskripsi singkat atau catatan.
        Contoh: Medium roast, 250g
      </g-message>
    </g-base>

    <g-base id="${Base.success}">
      ${this.kbk.home()}
      <g-message>
        ✅ Item created (#{{id}})

        🏷️ Title: {{title}}
        📝 Description: {{description}}
        📌 Status: {{status}}

        You can update or delete it anytime from the menu.
      </g-message>
      <g-message lang="id">
        ✅ Item dibuat (#{{id}})

        🏷️ Judul: {{title}}
        📝 Deskripsi: {{description}}
        📌 Status: {{status}}

        Anda dapat memperbarui atau menghapusnya kapan saja dari menu.
      </g-message>
    </g-base>
  `
}
