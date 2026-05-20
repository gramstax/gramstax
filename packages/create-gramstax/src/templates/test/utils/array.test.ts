import {describe, it, expect} from "bun:test"
import {ArrayUt} from "~/utils/array"

describe(`ArrayUt`, () => {
  describe(`random`, () => {
    it(`returns an element from the array`, () => {
      const arr = [1, 2, 3, 4, 5]
      const result = ArrayUt.random(arr)
      expect(arr).toContain(result)
    })

    it(`returns undefined for empty array`, () => {
      expect(ArrayUt.random([])).toBeUndefined()
    })

    it(`returns undefined for non-array input`, () => {
      expect(ArrayUt.random(`not an array` as any)).toBeUndefined()
      expect(ArrayUt.random(null as any)).toBeUndefined()
      expect(ArrayUt.random(undefined as any)).toBeUndefined()
    })

    it(`returns the only element from single-item array`, () => {
      expect(ArrayUt.random([42])).toBe(42)
    })

    it(`works with mixed type arrays`, () => {
      const arr = [`a`, 1, true, null, {key: `value`}]
      const result = ArrayUt.random(arr)
      expect(arr).toContain(result)
    })
  })

  describe(`shuffle`, () => {
    it(`returns a new array with same elements`, () => {
      const arr = [1, 2, 3, 4, 5]
      const shuffled = ArrayUt.shuffle(arr)
      expect(shuffled.length).toBe(arr.length)
      expect(shuffled.sort()).toEqual(arr.sort())
    })

    it(`does not mutate the original array`, () => {
      const arr = [1, 2, 3, 4, 5]
      const original = [...arr]
      ArrayUt.shuffle(arr)
      expect(arr).toEqual(original)
    })

    it(`returns empty array for non-array input`, () => {
      expect(ArrayUt.shuffle(`not an array` as any)).toEqual([])
      expect(ArrayUt.shuffle(null as any)).toEqual([])
      expect(ArrayUt.shuffle(undefined as any)).toEqual([])
    })

    it(`returns empty array for empty input`, () => {
      expect(ArrayUt.shuffle([])).toEqual([])
    })

    it(`returns same single element array`, () => {
      expect(ArrayUt.shuffle([42])).toEqual([42])
    })

    it(`produces different orderings over multiple shuffles`, () => {
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      let hadDifferent = false
      for (let i = 0; i < 20; i++) {
        const shuffled = ArrayUt.shuffle(arr)
        if (JSON.stringify(shuffled) !== JSON.stringify(arr)) {
          hadDifferent = true
          break
        }
      }
      expect(hadDifferent).toBe(true)
    })
  })
})
