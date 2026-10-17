import {PageBase} from "~/base/page"
import {CatalogData} from "~/data/catalog"
import {StartPage} from "~/pages/start"
import {StartItemListPage} from "./item/list"

// Category list page with dynamic inline buttons.
export class StartCategoryPage extends PageBase {
  static data = this.buildData({
    callbackQueryData: (payload?: string) => [payload],
    intentText: `Browse`
  })

  async handleCallbackQueryData() {
    await this.gdefault.show()
  }

  async handleText() {
    await this.gdefault.show()
  }

  async handleArgsCallbackQueryData() {
    const categoryId = this.callbackQueryDataArg
    await this.gdefault.process(categoryId!)
  }

  helper = {}
  gdefault = {
    show: async () => {
      await this.renderText({
        keyboard: this.inlineKeyboard((k, l) => {
          CatalogData.list.forEach((category, index) => {
            k.text(category.name, this.data.callbackQueryData(category.id))
            if (index % 2 === 1) {
              k.row()
            }
          })
          return k.row().text(l[0]!, StartPage)
        })
      })
    },
    process: async (categoryId: string) => {
      await this.cacheState.set(`${this.from!.id}:category`, categoryId)
      await this.cacheState.set(`${this.from!.id}:page`, 0)
      await new StartItemListPage(this).gdefault.show(categoryId, 0)
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
