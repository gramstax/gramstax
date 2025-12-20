import LoggingPretty from "logging-pretty"

export class LoggingUtils extends LoggingPretty {
  public constructor(options?: ConstructorParameters<typeof LoggingPretty>[0]) {
    super(options)
  }

  public errorMake(error: any, constructorOrName?: any, funcName?: string) {
    this.error(`[${constructorOrName?.name || constructorOrName}:${funcName}] ${String(error)}`)
  }
}

export const log = new LoggingUtils()
