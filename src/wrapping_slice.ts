import { assert } from "./utils"

export const wrapping_slice = <T>(ts: T[], start: number, n?: number): T[] => {
  const def_n = n ?? ts.length

  assert(Number.isInteger(start), `start is not an integer!\nstart: ${start}`)
  assert(start >= 0, `start is less than zero!\nstart: ${start}`)
  assert(Number.isInteger(def_n))
  assert(def_n >= 0)

  const real_start = start % ts.length
  const real_n = Math.min(def_n, ts.length)
  const new_ts: T[] = []

  for (let i = 0; i < real_n; i++) {
    new_ts.push(ts[(real_start + i) % ts.length])
  }

  return new_ts
}
