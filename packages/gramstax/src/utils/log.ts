import LoggingPretty from "logging-pretty"

export class LoggingUtils extends LoggingPretty {
  public constructor() {
    super()
  }

  public errorMake(error: any, constructorOrName?: any, funcName?: string) {
    this.error(`[${constructorOrName?.name || constructorOrName}:${funcName}] ${String(error)}`)
  }
}

export const log = new LoggingUtils()
