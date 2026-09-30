import {PageBase} from "./page"

export abstract class PageAdminBase extends PageBase {
  async hookBeforeRoute() {
    /**
     * you can define logic for admin access in here, 
     * just extends this PageAdminBase to your admin page, 
     * example: "StartAdminPage extends PageAdminBase".
     * 
     * you can use hookBeforeRoute in core/bot.ts for all page.
     * 
     * return true if allow, return false if denied
     */
    return true
  }
}
