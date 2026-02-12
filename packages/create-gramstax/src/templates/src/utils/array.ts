export class ArrayUt {
  /**
   * 1. Mengambil satu elemen secara acak
   */
  static random(array: any[]) {
    if (!Array.isArray(array) || array.length === 0) return undefined
    const randomIndex = Math.floor(Math.random() * array.length)
    return array[randomIndex]
  }

  /**
   * 2. Mengacak urutan array (Fisher-Yates Shuffle)
   * Menghasilkan array baru agar tidak merubah array asli (immutable)
   */
  static shuffle(array: any[]) {
    if (!Array.isArray(array)) return []
    const newArray = [...array] // Clone array
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[newArray[i], newArray[j]] = [newArray[j], newArray[i]]
    }
    return newArray
  }
}
