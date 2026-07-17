import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import {CatalogData} from "~/data/catalog"
import {ItemListPage} from "./item-list"

// Category list page with dynamic inline buttons.
export class CategoryPage extends PageBase {
  static data = this.buildData({
    callbackData: (payload: string) => [payload],
    intentText: `Browse`
  })

  async handleCallbackData() {
    await this.bdefault.show(true)
  }

  async handleText() {
    await this.bdefault.show(false)
  }

  async handleArgsCallbackData() {
    const categoryId = this.callbackDataArg
    await this.bdefault.process(categoryId!)
  }

  bdefault = {
    show: async (isEdit = true) => {
      const kb = this.inlineKeyboard((k, l) => {
        CatalogData.list.forEach((category, index) => {
          k.text(category.name, this.data.callbackData(category.id))
          if (index % 2 === 1) {
            k.row()
          }
        })
        return k.row().text(l[0]!, StartPage.data.callbackData())
      })
      if (isEdit) {
        await this.edit(kb)
      } else {
        await this.reply(kb)
      }
    },
    process: async (categoryId: string) => {
      await this.cacheState.set(`${this.userId}:category`, categoryId)
      await this.cacheState.set(`${this.userId}:page`, 0)
      await new ItemListPage(this).bdefault.show(categoryId, 0, true)
    }
  }

  static template = `
    <g-base>
      ${this.kbk.back()}
      <g-message>
        Choose a category to continue browsing.
      </g-message>
      <g-message lang="id">
        Pilih kategori untuk melanjutkan browsing.
      </g-message>
    </g-base>
  `
}
