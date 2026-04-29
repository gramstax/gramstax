import {PageBase} from "~/base/page"
import {StartPage} from "./start"

type CreateSessionParams = {step?: `title` | `description`; title?: string}

class Base {
  static s1: `form-title`
  static s2: `form-description`
  static success: `success`
  static warnInvalid: `w-invalid`
}

class Helper {
  static buildHomeKeyboard(ctx: CreatePage, baseId?: string) {
    return ctx.inlineKeyboardT([StartPage], `1`, baseId)
  }

  static getSessionParams(ctx: CreatePage) {
    return (ctx.temp.session?.params as CreateSessionParams | undefined) ?? {}
  }
}

class Main {
  static async showStep1Form(ctx: CreatePage) {
    await ctx.sessionFreeText({step: `title`})
    const bi = Base.s1
    const kb = Helper.buildHomeKeyboard(ctx, bi)
    const da = {}
    await ctx.edit(kb, da, bi)
  }

  static async processStep1Answer(ctx: CreatePage, title: string) {
    await ctx.sessionFreeText({step: `description`, title})
    await this.showStep2Form(ctx, title)
  }

  static async showStep2Form(ctx: CreatePage, title: string) {
    const bi = Base.s2
    const kb = Helper.buildHomeKeyboard(ctx, bi)
    const da = {title}
    await ctx.reply(kb, da, bi)
  }

  static async processStep2Answer(ctx: CreatePage, input?: string) {
    const {step, title} = Helper.getSessionParams(ctx)
    const currentStep = step === `description` ? `description` : `title`
    const value = input?.trim()
    if (!value || !title) {
      await ctx.sessionFreeText({step: !value ? currentStep : `title`})
      return await Alert.warnInvalid(ctx)
    }

    if (currentStep === `title`) {
      return await this.processStep1Answer(ctx, value)
    }

    await ctx.clearSession()
    const item = await ctx.db.createItem(ctx.userId, title, value)
    await Alert.success(ctx, {
      id: item.id,
      title: item.title,
      description: item.description,
      status: item.status
    })
  }
}

class Alert {
  static async success(ctx: CreatePage, data: {id: string; title: string; description: string; status: string}) {
    const bi = Base.success
    const kb = Helper.buildHomeKeyboard(ctx, bi)
    await ctx.reply(kb, data, bi)
  }

  static async warnInvalid(ctx: CreatePage) {
    const bi = Base.warnInvalid
    const kb = Helper.buildHomeKeyboard(ctx, bi)
    const da = {}
    await ctx.reply(kb, da, bi)
  }
}

// Creates a new item in cache.
export class CreatePage extends PageBase {
  async handleCallbackData() {
    await Main.showStep1Form(this)
  }

  async handleFreeText() {
    if (!this.isSessionFreeText()) {
      return null
    }
    await Main.processStep2Answer(this, this.msgText)
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

    <base id="${Base.warnInvalid}">
      ${this.kbk.cancel()}
      <message>
        ⚠️ Invalid input

        Please send a non-empty value so we can continue.
      </message>
      <message lang="id">
        ⚠️ Input tidak valid

        Mohon kirim nilai yang tidak kosong agar proses bisa dilanjutkan.
      </message>
    </base>
  `
}
