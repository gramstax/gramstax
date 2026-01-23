import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Creates a new item in cache.
export class CreatePage extends PageBase {
  kb(baseId?: string) {
    return this.inlineKeyboardT([StartPage], `1`, baseId)
  }

  async callback() {
    await this.sessionTextFree({step: `title`})
    const bi = `form-title`
    await this.edit(this.kb(`${bi}-kb`), {}, bi)
  }

  async textFree() {
    if (!this.validateSessionTextFree()) return null
    await this.sessionGet()
    await this.handleCreate(this.msgText)
  }

  private async handleCreate(input?: string) {
    const stepRaw = (this.session?.params as {step?: string; title?: string} | undefined)?.step
    const step = stepRaw === `description` ? `description` : `title`
    const value = input?.trim()
    const biInv = `invalid`
    if (!value) {
      await this.sessionTextFree({step})
      return await this.reply(this.kb(`${biInv}-kb`), {}, biInv)
    }

    if (step === `title`) {
      await this.sessionTextFree({step: `description`, title: value})
      const bi = `form-description`
      return await this.reply(this.kb(`${bi}-kb`), {title: value}, bi)
    }

    const title = (this.session?.params as {title?: string} | undefined)?.title
    if (!title) {
      await this.sessionTextFree({step: `title`})
      return await this.reply(this.kb(`${biInv}-kb`), {}, biInv)
    }

    const item = this.crudStore.createItem(this.userId, title, value)
    await this.sessionClear()
    const bi = `success`
    await this.reply(this.kb(`${bi}-kb`), {id: item.id, title: item.title, description: item.description, status: item.status}, bi)
  }

  static template = `
    <base id="form-title">
      <message>
        ✏️ Create a new item

        Send the title for the item.
        Example: Coffee Beans
      </message>
      <message lang="id">
        ✏️ Buat item baru

        Kirim judul item.
        Contoh: Biji Kopi
      </message>
    </base>

    <base id="form-description">
      <message>
        ✅ Title saved: {{title}}

        Now send the description.
        Example: Medium roast, 250g
      </message>
      <message lang="id">
        ✅ Judul tersimpan: {{title}}

        Sekarang kirim deskripsinya.
        Contoh: Medium roast, 250g
      </message>
    </base>

    <base id="success">
      <message>
        ✅ Item created (#{{id}})

        🏷️ Title: {{title}}
        📝 Description: {{description}}
        📌 Status: {{status}}
      </message>
      <message lang="id">
        ✅ Item dibuat (#{{id}})

        🏷️ Judul: {{title}}
        📝 Deskripsi: {{description}}
        📌 Status: {{status}}
      </message>
    </base>

    <base id="invalid">
      <message>
        ⚠️ Invalid input.

        Please send a non-empty value.
      </message>
      <message lang="id">
        ⚠️ Input tidak valid.

        Mohon kirim nilai yang tidak kosong.
      </message>
    </base>

    <base id="form-title-kb">
      ${this.kbk.cancel()}
    </base>

    <base id="form-description-kb">
      ${this.kbk.cancel()}
    </base>

    <base id="success-kb">
      ${this.kbk.home()}
    </base>

    <base id="invalid-kb">
      ${this.kbk.cancel()}
    </base>
  `
}
