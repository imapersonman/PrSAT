import { describe, expect, test } from "vitest"

import { Random } from "./random"
import { assert, assert_exists } from "./utils"
import { a2eid, constraint_builder, evaluate_sentence, parse_s, random_letters_and_assignments, real_expr_to_smtlib, recursively_evaluate_sentence, SentenceFuzzer, state_from_index, translate_constraint, translate_real_expr, TruthTable } from "./pr_sat"
import { PrSat, PrSatFuncs as PrSatUtils } from "./types"

type Sentence = PrSat['Sentence']
type RealExpr = PrSat['RealExpr']

const { letter, value, negation, conjunction, disjunction, conditional, biconditional } = PrSatUtils.inits.Sentence
const val = (v: boolean) => value({ value: v })
const not = (s: Sentence) => negation({ sentence: s })
const and = (l: Sentence, r: Sentence) => conjunction({ left: l, right: r })
const or = (l: Sentence, r: Sentence) => disjunction({ left: l, right: r })
const imp = (l: Sentence, r: Sentence) => conditional({ left: l, right: r })
const iff = (l: Sentence, r: Sentence) => biconditional({ left: l, right: r })

const { variable: vbl, plus: add, multiply: times, minus: subtract, divide: over, state_variable_sum: svs, probability: pr, given_probability: cpr, literal: lit } = PrSatUtils.inits.RealExpr
const plus = (left: RealExpr, right: RealExpr): RealExpr => add({ left, right })
const multiply = (left: RealExpr, right: RealExpr): RealExpr => times({ left, right })
const minus = (left: RealExpr, right: RealExpr): RealExpr => subtract({ left, right })
const divide = (numerator: RealExpr, denominator: RealExpr): RealExpr => over({ numerator, denominator })

const { eq } = constraint_builder

describe('TruthTable', () => {
  test('iterator', () => {
    const tt = new TruthTable(['A', 'B', 'C'])
    expect([...tt.state_indices()]).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })
  test('no letters', () => {
    const tt = new TruthTable([])
    // Shouldn't throw!
    tt.compute_dnf(val(true))
  })
})

// describe('specific examples to smtlib strings', () => {
//   test('placeholder')

//   const [A, B, C] = [letter('A'), letter('B'), letter('C')]
//   // console.log(constraints_to_smtlib_string([
//   //   eq(pr(and(A, B)), multiply(pr(A), pr(B))),
//   //   eq(pr(and(A, C)), multiply(pr(A), pr(C))),
//   //   eq(pr(and(B, C)), multiply(pr(B), pr(C))),
//   //   eq(pr(and(A, and(B, C))), multiply(pr(A), multiply(pr(B), pr(C)))),
//   // ]))
//   const [T, W] = [letter('T'), letter('W')]
//   // console.log(constraints_to_smtlib_string([
//   //   lt(pr(T), divide(lit(1), lit(2))),
//   //   gt(cpr(T, W), divide(lit(1), lit(2))),
//   //   gt(cpr(W, T), divide(lit(1), lit(2))),
//   //   cnot(lt(cpr(T, not(W)), pr(W))),
//   // ]))
//   // console.log(constraints_to_smtlib_string([
//   //   lt(pr(T), divide(lit(1), lit(2))),
//   //   gt(cpr(T, W), divide(lit(1), lit(2))),
//   //   gt(cpr(W, T), divide(lit(1), lit(2))),
//   //   cnot(gt(minus(cpr(T, W), cpr(T, not(W))), minus(pr(not(W)), pr(W)))),
//   // ]))
//   // console.log(constraints_to_smtlib_string([
//   //   lt(pr(T), divide(lit(1), lit(2))),
//   //   gt(cpr(T, W), divide(lit(1), lit(2))),
//   //   gt(cpr(W, T), divide(lit(1), lit(2))),
//   //   cor(
//   //     lt(cpr(T, not(W)), pr(W)),
//   //     gt(minus(cpr(T, W), cpr(T, not(W))), minus(pr(not(W)), pr(W))),
//   //   )
//   // ]))
//   const [H, R] = [letter('H'), letter('R')]
//   console.log(constraints_to_smtlib_string([
//     eq(cpr(B, and(R, H)), lit(1)),
//     gt(pr(not(B)), pr(R)),
//     eq(cpr(B, H), pr(B)),
//     eq(cpr(R, H), pr(R)),
//     cnot(gt(cpr(H, and(R, B)), cpr(H, and(not(R), not(B))))),
//   ]))
// })

describe('translate', () => {
  describe('3 sentence-letters', () => {
    const tt = new TruthTable(['A', 'B', 'C'])
    const [A, B, C] = [letter({ id: 'A' }), letter({ id: 'B', index: 0 }), letter({ id: 'C', index: 0 })]
    test('Pr(A)', () => {
      const actual = translate_real_expr(tt, pr({ arg: A }))
      const expected = svs({ indices: [0, 1, 2, 3] })
      expect(actual).toEqual(expected)
    })
    test('Pr(B & ~C)', () => {
      const actual = translate_real_expr(tt, pr({ arg: and(B, not(C)) }))
      const expected = svs({ indices: [1, 5] })
      expect(actual).toEqual(expected)
    })
    test('Pr(A | B <=> C)', () => {
      const actual = translate_real_expr(tt, cpr({ arg: A, given: iff(B, C) }))
      const expected = divide(svs({ indices: [0, 3] }), svs({ indices: [0, 3, 4, 7] }))  // There's a bug in Fitelson's paper on PrSAT.
      expect(actual).toEqual(expected)
    })
    test('Pr(A & B) = Pr(A) * Pr(B)', () => {
      const actual = translate_constraint(tt, eq(pr({ arg: and(A, B) }), multiply(pr({ arg: A }), pr({ arg: B }))))
      const expected = eq(svs({ indices: [0, 1] }), multiply(svs({ indices: [0, 1, 2, 3] }), svs({ indices: [0, 1, 4, 5] })))
      expect(actual).toEqual(expected)
    })
    test('Pr(A & C) = Pr(A) * Pr(C)', () => {
      const actual = translate_constraint(tt, eq(pr({ arg: and(A, C) }), multiply(pr({ arg: A }), pr({ arg: C }))))
      const expected = eq(svs({ indices: [0, 2] }), multiply(svs({ indices: [0, 1, 2, 3] }), svs({ indices: [0, 2, 4, 6] })))
      expect(actual).toEqual(expected)
    })
    test('Pr(B & C) = Pr(B) * Pr(C)', () => {
      const actual = translate_constraint(tt, eq(pr({ arg: and(B, C) }), multiply(pr({ arg: B }), pr({ arg: C }))))
      const expected = eq(svs({ indices: [0, 4] }), multiply(svs({ indices: [0, 1, 4, 5] }), svs({ indices: [0, 2, 4, 6] })))
      expect(actual).toEqual(expected)
    })
    test('Pr(A & B & C) = Pr(A) * Pr(B) * Pr(C)', () => {
      const actual = translate_constraint(tt, eq(pr({ arg: and(A, and(B, C)) }), multiply(pr({ arg: A }), multiply(pr({ arg: B }), pr({ arg: C })))))
      const expected = eq(svs({ indices: [0] }), multiply(svs({ indices: [0, 1, 2, 3] }), multiply(svs({ indices: [0, 1, 4, 5] }), svs({ indices: [0, 2, 4, 6] }))))
      expect(actual).toEqual(expected)
    })
    test('Pr(A | C & B) = 1', () => {
      const actual = translate_constraint(tt, eq(cpr({ arg: A, given: and(C, B) }), lit({ value: 1 })))
      const expected = eq(divide(svs({ indices: [0] }), svs({ indices: [0, 4] })), lit({ value: 1 }))
      expect(actual).toEqual(expected)
    })
  })
})

describe('parse_s', () => {
  test('atom', () => {
    expect(parse_s('something')).toEqual('something')
  })
  test('empty list', () => {
    expect(parse_s('()')).toEqual([])
  })
  test('empty list with spaces', () => {
    expect(parse_s('(\t       \n )')).toEqual([])
  })
  test('non-empty list size = 1', () => {
    expect(parse_s('(something)')).toEqual(['something'])
  })
  test('non-empty list size = 1 with spaces', () => {
    expect(parse_s('(    \n  something\n    \t  )')).toEqual(['something'])
  })
  test('non-empty list size > 1', () => {
    expect(parse_s('(something else happened here)')).toEqual(['something', 'else', 'happened', 'here'])
  })
  test('non-empty list size > 1 with spaces', () => {
    expect(parse_s('(  \tsomething \n else\nhappened\n   here   \n\t\t\t\n)')).toEqual(['something', 'else', 'happened', 'here'])
  })
  test('non-empty list size > 1 with spaces', () => {
    expect(parse_s('(  \tsomething \n else\nhappened\n   here   \n\t\t\t\n)')).toEqual(['something', 'else', 'happened', 'here'])
  })
  test('root-obj', () => {
    expect(parse_s('(root-obj (+ (* 8 (^ x 2)) (* 6 x) (- 1)) 2)'))
      .toEqual(['root-obj', ['+', ['*', '8', ['^', 'x', '2']], ['*', '6', 'x'], ['-', '1']], '2'])
  })
})

// Generates a list of 2^n state variables, where n === letter_ids.length.
// For a list of letter_ids [A_2, A_1, A_0], the state variables will
// 1-1 correspond to the states:
// 000:  A_2 &  A_1 &  A_0  = s_0
// 001:  A_2 &  A_1 & ~A_0  = s_1
// 010:  A_2 & ~A_1 &  A_0  = s_2
// 011:  A_2 & ~A_1 & ~A_0  = s_3
// 100: ~A_2 &  A_1 &  A_0  = s_4
// 101: ~A_2 &  A_1 & ~A_0  = s_5
// 111: ~A_2 & ~A_1 &  A_0  = s_6
// 111: ~A_2 & ~A_1 & ~A_0  = s_6
// In the above states, A_k is negated if the kth most significant bit
// (from right) is a 1, and is not negated otherwise.
// The state index is exactly this binary number.

describe('state_from_index', () => {
  // 0 sentences implies a single state that is always true.
  const [A, B, C] = [letter({ id: 'A', index: 0 }), letter({ id: 'B', index: 0 }), letter({ id: 'C', index: 0 })]
  const top = val(true)
  test('0 vars', () => expect(state_from_index([], 0)).toEqual(top))
  test('1 var, s_0', () => expect(state_from_index(['A'], 0)).toEqual(A))
  test('1 var, s_1', () => expect(state_from_index(['A'], 1)).toEqual(not(A)))
  test('2 var, s_0', () => expect(state_from_index(['A', 'B'], 0)).toEqual(and(A, B)))
  test('2 var, s_1', () => expect(state_from_index(['A', 'B'], 1)).toEqual(and(A, not(B))))
  test('2 var, s_2', () => expect(state_from_index(['A', 'B'], 2)).toEqual(and(not(A), B)))
  test('2 var, s_3', () => expect(state_from_index(['A', 'B'], 3)).toEqual(and(not(A), not(B))))
  test('3 var, s_0', () => expect(state_from_index(['A', 'B', 'C'], 0)).toEqual(and(A, and(B, C))))
  test('3 var, s_1', () => expect(state_from_index(['A', 'B', 'C'], 1)).toEqual(and(A, and(B, not(C)))))
  test('3 var, s_2', () => expect(state_from_index(['A', 'B', 'C'], 2)).toEqual(and(A, and(not(B), C))))
  test('3 var, s_3', () => expect(state_from_index(['A', 'B', 'C'], 3)).toEqual(and(A, and(not(B), not(C)))))
  test('3 var, s_4', () => expect(state_from_index(['A', 'B', 'C'], 4)).toEqual(and(not(A), and(B, C))))
  test('3 var, s_5', () => expect(state_from_index(['A', 'B', 'C'], 5)).toEqual(and(not(A), and(B, not(C)))))
  test('3 var, s_6', () => expect(state_from_index(['A', 'B', 'C'], 6)).toEqual(and(not(A), and(not(B), C))))
  test('3 var, s_7', () => expect(state_from_index(['A', 'B', 'C'], 7)).toEqual(and(not(A), and(not(B), not(C)))))
})

// describe('make_state_vars', () => {
//   test('0 vars', () => expect(make_state_vars(0)).toEqual([sv(0)]))
//   test('1 var', () => expect(make_state_vars(1)).toEqual([sv(0), sv(1)]))
//   test('2 vars', () => expect(make_state_vars(2)).toEqual([sv(0), sv(1), sv(2), sv(3)]))
//   test('3 vars', () => expect(make_state_vars(3)).toEqual([sv(0), sv(1), sv(2), sv(3), sv(4), sv(5), sv(6), sv(7)]))
// })

// const recursively_evaluate_sentence = (assignments: Record<string, boolean>, sentence: Sentence): boolean => {
describe('evaluate_sentence', () => {
  const [A, B] = [letter({ id: 'A', index: 0 }), letter({ id: 'B', index: 0 })]
  const eval_id = a2eid({})
  test('⊤', () => expect(evaluate_sentence(eval_id, val(true))).toEqual(true))
  test('⊥', () => expect(evaluate_sentence(eval_id, val(false))).toEqual(false))
  test('~⊤', () => expect(evaluate_sentence(eval_id, not(val(true)))).toEqual(false))
  test('~⊥', () => expect(evaluate_sentence(eval_id, not(val(false)))).toEqual(true))
  test('⊤ & ⊤', () => expect(evaluate_sentence(eval_id, and(val(true), val(true)))).toEqual(true))
  test('⊤ & ⊥', () => expect(evaluate_sentence(eval_id, and(val(true), val(false)))).toEqual(false))
  test('⊥ & ⊤', () => expect(evaluate_sentence(eval_id, and(val(false), val(true)))).toEqual(false))
  test('⊥ & ⊥', () => expect(evaluate_sentence(eval_id, and(val(false), val(false)))).toEqual(false))
  test('⊤ ∨ ⊤', () => expect(evaluate_sentence(eval_id, or(val(true), val(true)))).toEqual(true))
  test('⊤ ∨ ⊥', () => expect(evaluate_sentence(eval_id, or(val(true), val(false)))).toEqual(true))
  test('⊥ ∨ ⊤', () => expect(evaluate_sentence(eval_id, or(val(false), val(true)))).toEqual(true))
  test('⊥ ∨ ⊥', () => expect(evaluate_sentence(eval_id, or(val(false), val(false)))).toEqual(false))
  test('⊤ → ⊤', () => expect(evaluate_sentence(eval_id, imp(val(true), val(true)))).toEqual(true))
  test('⊤ → ⊥', () => expect(evaluate_sentence(eval_id, imp(val(true), val(false)))).toEqual(false))
  test('⊥ → ⊤', () => expect(evaluate_sentence(eval_id, imp(val(false), val(true)))).toEqual(true))
  test('⊥ → ⊥', () => expect(evaluate_sentence(eval_id, imp(val(false), val(false)))).toEqual(true))
  test('⊤ ↔ ⊤', () => expect(evaluate_sentence(eval_id, iff(val(true), val(true)))).toEqual(true))
  test('⊤ ↔ ⊥', () => expect(evaluate_sentence(eval_id, iff(val(true), val(false)))).toEqual(false))
  test('⊥ ↔ ⊤', () => expect(evaluate_sentence(eval_id, iff(val(false), val(true)))).toEqual(false))
  test('⊥ ↔ ⊥', () => expect(evaluate_sentence(eval_id, iff(val(false), val(false)))).toEqual(true))

  test('~~⊥', () => expect(evaluate_sentence(eval_id, not(not(val(false))))).toEqual(false))
  test('~⊥ → ~⊤', () => expect(evaluate_sentence(eval_id, imp(not(val(false)), not(val(true))))).toEqual(false))

  test('(A = ⊤) ~A ', () => expect(evaluate_sentence(a2eid({ A: true }), not(A))).toEqual(false))
  test('(A = ⊥) ~A ', () => expect(evaluate_sentence(a2eid({ A: false }), not(A))).toEqual(true))
  test('(A = ⊤, B = ⊥) A & B', () => expect(evaluate_sentence(a2eid({ A: true, B: false }), and(A, B))).toEqual(false))
  test('(A = ⊥, B = ⊤) A ∨ B', () => expect(evaluate_sentence(a2eid({ A: false, B: true }), or(A, B))).toEqual(true))
  test('(A = ⊤, B = ⊥) A → B', () => expect(evaluate_sentence(a2eid({ A: true, B: false }), imp(A, B))).toEqual(false))
  test('(A = ⊥, B = ⊥) A ↔ B', () => expect(evaluate_sentence(a2eid({ A: false, B: false }), iff(A, B))).toEqual(true))

  describe('comparing rec to faster stuff', () => {
    const n_example_sentences = 20
    const max_letters = 26
    const fuzzer = new SentenceFuzzer(new Random(), 20)
    const examples: { sentence: Sentence, letters: string[], eval_id: (id: string) => boolean }[] = []

    for (let example_index = 0; example_index < n_example_sentences; example_index++) {
      const n = fuzzer.random.integer({ lower: 1, upper: max_letters })
      const [letters, eval_id] = random_letters_and_assignments(fuzzer.random, n)
      const sentence = fuzzer.generate(letters)
      examples.push({ sentence, letters, eval_id })
    }

    const rec_results: boolean[] = []
    const results: boolean[] = []

    // const rec_start = performance.now()
    for (const { sentence, eval_id } of examples) {
      const value = recursively_evaluate_sentence(eval_id, sentence)
      rec_results.push(value)
    }
    // const rec_end = performance.now()
    // const rec_time_millis = rec_end - rec_start

    // const normal_start = performance.now()
    for (const { sentence, eval_id} of examples) {
      const value = evaluate_sentence(eval_id, sentence)
      results.push(value)
    }
    // const normal_end = performance.now()
    // const normal_time_millis = normal_end - normal_start

    // test('recursive version is slower', () => expect(normal_time_millis).toBeLessThan(rec_time_millis))

    for (let ei = 0; ei < examples.length; ei++) {
      const { letters } = assert_exists(examples[ei])
      test(`seed: ${fuzzer.random.seed_string}, index: ${ei}, n_letters: ${letters.length}`, () => {
        const rec_value = assert_exists(rec_results[ei])
        const value = assert_exists(results[ei])
        expect(value).toEqual(rec_value)
      })
    }
  })
})

// This function probably shouldn't be called, and if it is, it's result shouldn't be evaluated
// using recursively_evaluate_sentence, as a letter_ids.length > 13 results in very large terms.
// Calling evaluate_sentence with the result also should be avoided.
// It's generally safer to evaluate the (likely) smaller terms that the dnf is based on, or to
// call evaluate_dnf on the input.
const state_dnf_to_sentence = (tt: TruthTable, state_dnf: number[]): Sentence => {
  const upper_state_index_bound = Math.pow(2, tt.n_letters())
  let current_sentence: Sentence | undefined = undefined

  for (let si = 0; si < state_dnf.length; si++) {
    const state_index = state_dnf[state_dnf.length - si - 1]
    assert(state_index >= 0, 'State has an index <= 0!')
    assert(state_index < upper_state_index_bound, `State has an index >= upper bound!\nexpected: ${upper_state_index_bound}`)
    const state_sentence = tt.state_from_index(state_index)
    current_sentence =
      current_sentence === undefined ? state_sentence
      : or(state_sentence, current_sentence)
  }

  if (current_sentence === undefined) {
    assert(state_dnf.length === 0)
    return val(false)
  } else {
    return current_sentence
  }
}

describe('translate', () => {
  test('something')
  // const { power } = real_expr_builder
  const { power } = PrSatUtils.inits.RealExpr
  const A = letter({ id: 'A', index: 0 })
  test('translate doesn\'t throw with power', () => {
    translate_real_expr(new TruthTable(['A']), power({ base: pr({ arg: A }), exponent: lit({ value: 2 }) }))
  })
})


// const evaluate_dnf = (letter_ids: string[], assignment: Record<string, boolean>, state_dnf: number[]): boolean => {
//   for (const state_index of state_dnf) {
//     const state = state_from_index(letter_ids, state_index)
//     const value = recursively_evaluate_sentence(assignment, state)
//     if (value) {
//       return true
//     }
//   }
//   return false
// }

describe('state dnf stuff', () => {
  const n_example_sentences = 10
  const max_letters = 12
  const fuzzer = new SentenceFuzzer(new Random())
  const examples: { sentence: Sentence, tt: TruthTable, letters: string[], eval_id: (id: string) => boolean }[] = []

  for (let example_index = 0; example_index < n_example_sentences; example_index++) {
    const n = fuzzer.random.integer({ lower: 1, upper: max_letters })
    const [letters, eval_id] = random_letters_and_assignments(fuzzer.random, n)
    // const [letters, eval_id] = random_letters_and_assignments(fuzzer.random, max_letters)
    const tt = new TruthTable(letters)
    const sentence = fuzzer.generate(letters)
    examples.push({ sentence, tt, letters, eval_id })
  }

  for (const [index, { sentence, tt, letters, eval_id }] of examples.entries()) {
    test(`seed: ${fuzzer.random.seed_string}, index: ${index}, n_letters: ${letters.length}`, () => {
      // for a fixed assignment:
      // eval(sentence) === eval(state_dnf_to_sentence(compute_state_dnf(sentence)))
      const direct_value = recursively_evaluate_sentence(eval_id, sentence)
      const dnf = tt.compute_dnf(sentence)
      const dnf_sentence = state_dnf_to_sentence(tt, dnf)
      const dnf_value = evaluate_sentence(eval_id, dnf_sentence)
      expect(direct_value).toEqual(dnf_value)
      const direct_dnf_value = tt.evaluate_dnf(eval_id, dnf)
      expect(direct_value).toEqual(direct_dnf_value)
    })
  }
})

describe('*_to_smtlib', () => {
  const [a, b, c, d, e, f, g, h] = [vbl({ id: 'a' }), vbl({ id: 'b' }), vbl({ id: 'c' }), vbl({ id: 'd' }), vbl({ id: 'e' }), vbl({ id: 'f' }), vbl({ id: 'g' }), vbl({ id: 'h' })]
  test('+ (flat)', () => {
    const expr = plus(plus(plus(plus(a, b), c), d), plus(e, plus(f, plus(g, h))))
    const expected = ['+', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    expect(real_expr_to_smtlib(expr)).toEqual(expected)
  })
  test('* (flat)', () => {
    const expr = multiply(multiply(multiply(multiply(a, b), c), d), multiply(e, multiply(f, multiply(g, h))))
    const expected = ['*', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    expect(real_expr_to_smtlib(expr)).toEqual(expected)
  })
  test('- (flat)', () => {
    const expr = minus(minus(minus(minus(a, b), c), d), e)
    const expected = ['-', 'a', 'b', 'c', 'd', 'e']
    expect(real_expr_to_smtlib(expr)).toEqual(expected)
  })
  test('- (half-flat)', () => {
    const expr = minus(minus(minus(minus(a, b), c), d), minus(e, minus(f, minus(g, h))))
    const expected = ['-', 'a', 'b', 'c', 'd', ['-', 'e', ['-', 'f', ['-', 'g', 'h']]]]
    expect(real_expr_to_smtlib(expr)).toEqual(expected)
  })
  test('-', () => {
    const expr = minus(a, minus(b, minus(c, minus(d, e))))
    const expected = ['-', 'a', ['-', 'b', ['-', 'c', ['-', 'd', 'e']]]]
    expect(real_expr_to_smtlib(expr)).toEqual(expected)
  })
  test('/ (flat)', () => {
    const expr = divide(divide(divide(divide(a, b), c), d), e)
    const expected = ['/', 'a', 'b', 'c', 'd', 'e']
    expect(real_expr_to_smtlib(expr)).toEqual(expected)
  })
  test('/ (half-flat)', () => {
    const expr = divide(divide(divide(divide(a, b), c), d), divide(e, divide(f, divide(g, h))))
    const expected = ['/', 'a', 'b', 'c', 'd', ['/', 'e', ['/', 'f', ['/', 'g', 'h']]]]
    expect(real_expr_to_smtlib(expr)).toEqual(expected)
  })
  test('/', () => {
    const expr = divide(a, divide(b, divide(c, divide(d, e))))
    const expected = ['/', 'a', ['/', 'b', ['/', 'c', ['/', 'd', 'e']]]]
    expect(real_expr_to_smtlib(expr)).toEqual(expected)
  })
})
