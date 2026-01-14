import { describe, expect, test } from "vitest"
import { wrapping_slice } from "./wrapping_slice"

describe('wrapping_slice', () => {
  test('[](0, 0)', () => {
    expect(wrapping_slice([], 0, 0)).toEqual([])
  })

  test('[](0, 3)', () => {
    expect(wrapping_slice([], 0, 3)).toEqual([])
  })

  test('[](3, 1)', () => {
    expect(wrapping_slice([], 3, 1)).toEqual([])
  })

  test('[1, 2, 3](0, 3)', () => {
    expect(wrapping_slice([1, 2, 3], 0, 3)).toEqual([1, 2, 3])
  })

  test('[1, 2, 3](1, 2)', () => {
    expect(wrapping_slice([1, 2, 3], 1, 2)).toEqual([2, 3])
  })

  test('[1, 2, 3](1, 3)', () => {
    expect(wrapping_slice([1, 2, 3], 1, 3)).toEqual([2, 3, 1])
  })

  test('[1, 2, 3](1, 4)', () => {
    expect(wrapping_slice([1, 2, 3], 1, 4)).toEqual([2, 3, 1])
  })

  test('[1, 2, 3](3, 1)', () => {
    expect(wrapping_slice([1, 2, 3], 3, 1)).toEqual([1])
  })

  test('[1, 2, 3](1, 0)', () => {
    expect(wrapping_slice([1, 2, 3], 1, 0)).toEqual([])
  })

  test('[1, 2, 3](2)', () => {
    expect(wrapping_slice([1, 2, 3], 2)).toEqual([3, 1, 2])
  })
})
