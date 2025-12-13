class Ctx {
  public async internal?(...args: any): Promise<void>
}

console.log(JSON.stringify(Ctx.prototype))
