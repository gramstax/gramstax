import {PageBase} from "~/base/page"
import {CatalogMock} from "~/mock/catalog"
import {ItemListPage} from "./item-list"
import {StartPage} from "./start"

// Category list page with dynamic inline buttons.
export class CategoryPage extends PageBase {
  static data = this.buildData({
    callback: (action?: string, payload?: string) => [action, payload],
    intentText: `Browse`
  })
  static BASE = {categories: `categories`}

  kb() {
    return this.inlineKeyboard((k, l) => {
      CatalogMock.list.forEach((category, index) => {
        k.text(category.name, this.data.callback(`category`, category.id))
        if (index % 2 === 1) k.row()
      })
      return k.row().text(l[0]!, StartPage.data.callback())
    })
  }

  async transition(edit = true) {
    const kb = this.kb()
    const bi = CategoryPage.BASE.categories
    if (edit) await this.edit(kb, {}, bi)
    else await this.reply(kb, {}, bi)
  }

  async callback() {
    await this.transition(true)
  }

  async text() {
    await this.transition(false)
  }

  async callbackPayload() {
    const [action, categoryId] = this.callbackDataPayloads
    if (action !== `category` || !categoryId) {
      return await this.transition(true)
    }
    await this.cacheState.set(`${this.userId}:category`, categoryId)
    await this.cacheState.set(`${this.userId}:page`, 0)
    await new ItemListPage(this).transition(categoryId, 0, true)
  }

  static template = `
    <base>
      ${this.kbk.back()}
      <message>
        🔎 Browse Categories

        Select a category to see its items.
      </message>
    </base>

    <base id="${this.BASE.categories}">
      <message>
        Choose a category to continue browsing.
      </message>
    </base>
  `
}
