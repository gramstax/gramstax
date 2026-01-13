import {PageBase} from "~/base/page"
import {catalog} from "~/data/catalog"
import {ItemListPage} from "./item-list"
import {StartPage} from "./start"

// Category list page with dynamic inline buttons.
export class CategoryPage extends PageBase {
  static data = this.buildData((payload?: string) => payload)

  kb() {
    return this.ikb((k) => {
      catalog.forEach((category, index) => {
        k.text(category.name, this.data.callbackData(`category:${category.id}`))
        if (index % 2 === 1) k.row()
      })

      return k.row().text(`Back to Menu`, StartPage.data.callbackData())
    })
  }

  async to(isEdit = true) {
    if (isEdit) {
      await this.edit(this.kb(), {}, `categories`)
      return
    }

    await this.reply(this.kb(), {}, `categories`)
  }

  async callback() {
    await this.to(true)
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
