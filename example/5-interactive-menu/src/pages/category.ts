import {PageBase} from "~/base/page"
import {CatalogData} from "~/labels/catalog"
import {ItemListPage} from "./item-list"
import {StartPage} from "./start"

// Category list page with dynamic inline buttons.
export class CategoryPage extends PageBase {
  static data = this.buildData({
    callback: (action?: string, payload?: string) => [action, payload],
    intentText: `Browse`
  })

  kb() {
    return this.inlineKeyboard((k, a) => {
      CatalogData.list.forEach((category, index) => {
        k.text(category.name, this.data.callback(`category`, category.id))
        if (index % 2 === 1) k.row()
      })
      return k.row().text(a[0]!, StartPage.data.callback())
    })
  }

  async to(isEdit = true) {
    const kb = this.kb()
    const bi = `categories`
    if (isEdit) {
      await this.edit(kb, {}, bi)
    } else {
      await this.reply(kb, {}, bi)
    }
  }

  async callback() {
    await this.to(true)
  }

  async text() {
    await this.to(false)
  }

  async callbackPayload() {
    const [action, categoryId] = this.callbackDataPayloads
    if (action !== `category` || !categoryId) {
      await this.to(true)
      return
    }
    await this.cacheState.set(`${this.userId}:category`, categoryId)
    await this.cacheState.set(`${this.userId}:page`, 0)
    await new ItemListPage(this).to(categoryId, 0, true)
  }

  static template = `
    <base>
      ${this.kbk.back(`default`)}
      <message>
        Browse Categories
      </message>
    </base>

    <base id="categories">
      <message>
        Choose a category to continue.
      </message>
    </base>
  `
}
