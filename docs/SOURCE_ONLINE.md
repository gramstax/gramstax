```typescript
import { PageBase } from "~/base/page";
import { StartPage } from "./start";
import { ChainUt } from "~/utils/chain";
import { GetConfigChain } from "~/chain/config";
import { WalletGuard } from "~/guards/wallet";
import { WalletDetailPage } from "./wallet-detail";
import { WalletCreate1Page } from "./wallet-create-1";
import { WalletImport1Page } from "./wallet-import-1";

export class WalletPage extends PageBase {
  static data = this.buildData((page?: string) => page);

  /**
   * Create data list keyboard with pagination (without total count)
   * @param data Array of data objects
   * @param currentPage Current page number (0-based)
   * @param hasPrevious Whether there's a previous page
   * @param hasMore Whether there are more records
   */
  kbWithoutCount(
    data: any[],
    currentPage: number,
    hasPrevious: boolean,
    hasMore: boolean
  ) {
    return this.ikb((k, a) => {
      for (let index = 0; index < data.length; index++) {
        const { name, chainSymbol } = data[index];
        const displayName = `${name} (${chainSymbol})`;
        k.text(displayName, WalletDetailPage.data.callbackData(name)).row();
      }

      // Add pagination if needed
      if (hasPrevious || hasMore) {
        k.row();
        if (hasPrevious) {
          k.text(a[0]!, this.data.callbackData(`${currentPage - 1}`)); // Previous
        }
        k.text(`${a[4]} ${currentPage + 1}`, `_`); // Current page (no total)
        if (hasMore) {
          k.text(a[1]!, this.data.callbackData(`${currentPage + 1}`)); // Next
        }
      }

      // Add action buttons
      return k //
        .row()
        .text(a[2]!, WalletCreate1Page.data.callbackData())
        .text(a[3]!, WalletImport1Page.data.callbackData())
        .row()
        .text(a[5]!, StartPage.data.callbackData());
    });
  }

  /**
   * Create data list keyboard with pagination
   * @param wallets Array of wallet objects
   * @param currentPage Current page number (0-based)
   * @param totalPages Total number of pages
   */
  kb(wallets: any[], currentPage: number, totalPages: number) {
    return this.ikb((k, a) => {
      // Add wallet buttons
      for (let index = 0; index < wallets.length; index++) {
        const { name, chainSymbol } = wallets[index];
        const displayName = `${name} (${chainSymbol})`;
        k.text(displayName, WalletDetailPage.data.callbackData(name)).row();
      }

      // Add pagination if needed
      if (totalPages > 1) {
        k.row();
        if (currentPage > 0) {
          k.text(a[0]!, this.data.callbackData(`${currentPage - 1}`));
        }
        k.text(`${a[4]} ${currentPage + 1}/${totalPages}`, `_`); // Current page (no total)
        if (currentPage < totalPages - 1) {
          k.text(a[1]!, this.data.callbackData(`${currentPage + 1}`));
        }
      }

      // Add action buttons
      return k //
        .row()
        .text(a[2]!, WalletCreate1Page.data.callbackData())
        .text(a[3]!, WalletImport1Page.data.callbackData())
        .row()
        .text(a[5]!, StartPage.data.callbackData());
    });
  }

  async core(page: number) {
    await this.sessionClear();
    const dataPerPage = 5;
    const offset = page * dataPerPage;
    const data = await new WalletGuard(this).ensureExist(
      dataPerPage + 1,
      offset
    );
    if (data === null) {
      return;
    }

    // Check if there are more records
    const hasMore = data.length > dataPerPage;
    const hasPrevious = page > 0;
    const displayData = (hasMore ? data.slice(0, dataPerPage) : data).map(
      (it: any) => {
        const { chainSymbol, chainDecimals, chainDisplay } = GetConfigChain(
          it.chain
        );
        const balance = ChainUt.formatUnits(it.balance, chainDecimals);
        return {
          ...it,
          balance,
          chainDisplay,
          chainSymbol,
          displayKeyboard: `${balance} (${chainSymbol})`,
        };
      }
    );

    const kb = this.kbWithoutCount(displayData, page, hasPrevious, hasMore);
    await this.edit(kb, {
      totalWallets: displayData.length,
      walletList: displayData,
    });
  }

  async callback() {
    await this.core(0);
  }

  async callbackPayload() {
    await this.core(parseInt(this.callbackDataPayload || `0`));
  }

  static template = (() => {
    const mapc = `
      <map src="walletList" join="\\n\\n">
        {~i+1~}. <b>{{e.name}}</b>
        🔗 {{e.chainDisplay}}
        💰 {{e.balance}} ({{e.chainSymbol}})
        📍 <code>{{e.address}}</code>
      </map>
    `;
    return `
      <base>
        <keyboard>⬅️ Prev, ➡️ Next, ➕ Create, 📥 Import, 🔖, ${this.kbd.back(
          `default`
        )}</keyboard>
        <message>
          <b>💼 Your Wallets</b>

          <b>Total Wallets:</b> {{totalWallets}}
          ${mapc}
        </message>
      </base>
    `;
  })();
}
```
