import { describe, expect, test } from 'vitest'
import { constraint_builder, parse_s, real_expr_builder, sentence_builder, TruthTable, variables_in_constraints } from './pr_sat'
import { init_z3, model_assignment_output_to_string, ModelAssignmentOutput, pr_sat, pr_sat_wrapped, WrappedSolver } from './z3_integration'
import { PrSat } from './types'
import { S, s_to_string } from './s'
import { assert_exists } from './utils'
import { parse_constraint } from './parser'
import { constraints_file_to_string, parse_constraints_file, constraints_file_to_partially_parsed_file, ConstraintsFile, save_constraints_file } from './fitelson_files/stuff'

type Sentence = PrSat['Sentence']
type RealExpr = PrSat['RealExpr']
type Constraint = PrSat['Constraint']

const zero_arity_model_to_string = (model: Record<number, ModelAssignmentOutput>): string => {
  return Object.entries(model)
    .map(([name, assignment]) => `${name} = ${model_assignment_output_to_string(assignment)}`)
    .join('\n')
}

const { eq, gt, cnot, lt, cor, gte, cand } = constraint_builder
const { pr, cpr, lit, divide, multiply, minus, plus } = real_expr_builder
const { and, or, imp, iff, not, letter, val } = sentence_builder

const [A, B, C] = [letter('A'), letter('B'), letter('C')]
const [R, H] = [letter('R'), letter('H')]
const [T, W] = [letter('T'), letter('W')]
const [P, Q] = [letter('P'), letter('Q')]

describe('z3', async () => {
  // const run = async (constraints: Constraint[], regular: boolean = false): Promise<{ status: 'sat' | 'unsat' | 'unknown' }> => {
  //   const { status } = await pr_sat(init_z3, constraints, regular)
  //   if (status === 'cancelled' || status === 'exception') {
  //     throw new Error(`Unexpected status for test run!\nexpected: 'sat', 'unsat', or 'unknown'\nactual: ${status}`)
  //   }
  //   return { status }
  // }

  const solver = new BaseSolver()
  // const solver = new WebWorkerSolver()
  const machine = new SolverStateMachine(solver)
  await machine.as('uninitialized').initialize()

  const run = async (constraints: Constraint[], regular: boolean = false): Promise<{ status: 'sat' | 'unsat' | 'unknown' }> => {
    await machine.as('initialized', 'invalidated').start(constraints, regular)
    machine.as('staged').go()
    const [status, data] = await machine.as('solving').solver.wait()
    machine.as('finished').invalidate()

    if (status === 'exception') {
      throw data
    }
    if (status === 'cancelled') {
      throw new Error(`Unexpected status for test run!\nexpected: 'sat', 'unsat', or 'unknown'\nactual: ${status}`)
    }

    return { status }
  }

  test('gross', async () => {
    const X = letter('X')
    const Y = letter('Y')
    const constraints: Constraint[] = [
      eq(pr(and(X, Y)), multiply(pr(X), pr(Y))),
      eq(pr(X), lit(0)),
    ]
    const regular = false

    await machine.as('initialized', 'invalidated').start(constraints, regular)
    machine.as('staged').go()
    const [status, data] = await machine.as('solving').solver.wait()
    machine.as('finished').invalidate()

    if (status === 'exception') {
      throw data
    }
    if (status === 'cancelled') {
      throw new Error(`Unexpected status for test run!\nexpected: 'sat', 'unsat', or 'unknown'\nactual: ${status}`)
    }

    const result = assert_exists(await data?.evaluate({ tag: 'real_expr', real_expr: cpr(Y, X) }), 'Can\'t evaluate result!')
    expect(result.tag).toEqual('div0')
  })

  test('joined', async () => {
    const { status: sat } = await run([
      cnot(eq(pr(or(P, Q)), minus(plus(pr(P), pr(Q)), pr(and(P, Q)))))
    ])
    expect(sat).toEqual('unsat')

    const { status: sat2 } = await run([
      eq(pr(imp(A, iff(B, C))), lit(1)),
      eq(pr(B), pr(not(B))),
      eq(pr(C), multiply(lit(2), pr(and(C, A)))),
      eq(pr(and(B, and(C, not(A)))), divide(lit(1), lit(5))),
    ])
    expect(sat2).toEqual('sat')
  })

  describe('ugh', () => {
    test('general additivity', async () => {
      const { status: sat } = await run([
        cnot(eq(pr(or(P, Q)), minus(plus(pr(P), pr(Q)), pr(and(P, Q)))))
      ])
      expect(sat).toEqual('unsat')
    })
    test('titelbaum 2.10', async () => {
      const { status: sat } = await run([
        eq(pr(imp(A, iff(B, C))), lit(1)),
        eq(pr(B), pr(not(B))),
        eq(pr(C), multiply(lit(2), pr(and(C, A)))),
        eq(pr(and(B, and(C, not(A)))), divide(lit(1), lit(5))),
      ])
      expect(sat).toEqual('sat')
    })
  })
  test('Pr(~X) = 1 - Pr(X)', async () => {
    const { status: sat } = await run([
      cnot(eq(pr(not(A)), minus(lit(1), pr(A)))),
    ])
    expect(sat).toEqual('unsat')
  })
  test('total probability', async () => {
    const { status: sat } = await run([
      cnot(eq(pr(A), plus(multiply(cpr(A, B), pr(B)), multiply(cpr(A, not(B)), pr(not(B)))))),
    ])
    expect(sat).toEqual('unsat')
  })
  test('intro lecture 17 end', async () => {
    const { status: sat } = await run([
      cnot(gte(pr(imp(A, B)), cpr(B, A))),
    ])
    expect(sat).toEqual('unsat')
  })
  test('intro lecture 18 th.2', async () => {
    const { status: sat } = await pr_sat(init_z3, [
      eq(cpr(A, B), pr(A)),
      cnot(eq(cpr(B, A), cpr(B, not(A)))),
    ])
    expect(sat).toEqual('unsat')
  })
  test('intro lecture 18 not th.4', async () => {
    const { status: sat } = await run([
      cnot(eq(cpr(A, B), cpr(A, not(B)))),
    ])
    expect(sat).toEqual('sat')
  })
  test('intro lecture 18 not th.5', async () => {
    const { status: sat } = await run([
      cnot(gte(pr(iff(A, B)), cpr(B, A))),
    ])
    expect(sat).toEqual('sat')
  })
  test('intro lecture 18 not th.6', async () => {
    const { status: sat } = await run([
      cnot(eq(pr(or(A, B)), plus(pr(A), pr(B)))),
    ])
    expect(sat).toEqual('sat')
  })
  test('intro lecture 18 irrational model', async () => {
    const { status: sat } = await run([
      eq(cpr(B, A), pr(or(A, B))),
      eq(pr(B), pr(not(B))),
      eq(pr(and(A, B)), pr(and(not(A), B))),
    ])
    expect(sat).toEqual('sat')
  })
  test('Pr(true | R) = 1', async () => {
    const { status: sat } = await run([
      cnot(eq(cpr(val(true), R), lit(1))),
    ])
    expect(sat).toEqual('unsat')
  })
  test('Pr(P | R) ≥ 0', async () => {
    const { status: sat } = await run([
      cnot(gte(cpr(P, R), lit(0))),
    ])
    expect(sat).toEqual('unsat')
  })
  test('P and Q mutually exclusive entails Pr(P or Q | R) = Pr(P | R) + Pr(Q | R)', async () => {
    const { status: sat } = await run([
      eq(pr(and(P, Q)), lit(0)),
      cnot(gte(cpr(or(P, Q), R), plus(cpr(P, R), cpr(Q, R)))),
    ])
    expect(sat).toEqual('unsat')
  })
  test('Pr(~P | R) = 1 - Pr(P | R)', async () => {
    const { status: sat } = await run([
      cnot(eq(cpr(not(P), R), minus(lit(1), cpr(P, R)))),
    ])
    expect(sat).toEqual('unsat')
  })
  test('Pr(P | true) = Pr(P)', async() => {
    const { status: sat } = await run([
      cnot(eq(cpr(P, val(true)), pr(P))),
    ])
    expect(sat).toEqual('unsat')
  })
  test('Pr(true) = 1', async () => {
    const { status: sat } = await run([
      cnot(eq(pr(val(true)), lit(1))),
    ])
    expect(sat).toEqual('unsat')
  })
  test('Pr(false) = 0', async () => {
    const { status: sat } = await run([
      cnot(eq(pr(val(false)), lit(0))),
    ])
    expect(sat).toEqual('unsat')
  })
  test('Bayes', async () => {
    const { status: sat } = await run([
      cnot(eq(cpr(A, B), divide(multiply(cpr(B, A), pr(A)), pr(B)))),
    ])
    expect(sat).toEqual('unsat')
  })
  test('titelbaum independence (3.14) => (3.15) through (3.18)', async () => {
    const { status: sat } = await run([
      eq(cpr(P, Q), pr(P)),
      cnot(
        cand(
          eq(pr(P), cpr(P, not(Q))),
          cand(
            eq(cpr(P, Q), cpr(P, not(Q))),
            cand(
              eq(cpr(Q, P), pr(Q)),
              cand(
                eq(pr(Q), cpr(Q, not(P))),
                eq(pr(and(P, Q)), multiply(pr(P), pr(Q)))))))),
    ])
    expect(sat).toEqual('unsat')
  })
  test('titelbaum (3.23) and (3.24) sat', async () => {
    const { status: sat } = await run([
      gt(cpr(A, B), pr(A)),
      eq(cpr(A, and(B, C)), cpr(A, C)),
    ])
    expect(sat).toEqual('sat')
  })
  test('pairwise to mutual independence', async () => {
    const { status: sat } = await run([
      eq(pr(and(A, B)), multiply(pr(A), pr(B))),
      eq(pr(and(A, C)), multiply(pr(A), pr(C))),
      eq(pr(and(B, C)), multiply(pr(B), pr(C))),
      eq(pr(and(A, and(B, C))), multiply(pr(A), multiply(pr(B), pr(C)))),
    ], true)

    expect(sat).toEqual('sat')
  })
  describe('lotteries and miracles', () => {
    test('(1)-(3) entail (4)', async () => {
      const { status: sat } = await run([
        lt(pr(T), divide(lit(1), lit(2))),
        gt(cpr(T, W), divide(lit(1), lit(2))),
        gt(cpr(W, T), divide(lit(1), lit(2))),
        cnot(lt(cpr(T, not(W)), pr(W))),
      ])

      expect(sat).toEqual('sat')
    })
    test('(1)-(3) entail (5)', async () => {
      const { status: sat } = await run([
        lt(pr(T), divide(lit(1), lit(2))),
        gt(cpr(T, W), divide(lit(1), lit(2))),
        gt(cpr(W, T), divide(lit(1), lit(2))),
        cnot(gt(minus(cpr(T, W), cpr(T, not(W))), minus(pr(not(W)), pr(W)))),
      ])

      expect(sat).toEqual('sat')
    })
    test('(1)-(3) entail (4) or (5)', async () => {
      const constraints = [
        lt(pr(T), divide(lit(1), lit(2))),
        gt(cpr(T, W), divide(lit(1), lit(2))),
        gt(cpr(W, T), divide(lit(1), lit(2))),
        cnot(
          cor(
            lt(cpr(T, not(W)), pr(W)),
            gt(minus(cpr(T, W), cpr(T, not(W))), minus(pr(not(W)), pr(W)))
          )
        ),
      ]
      const { status: sat } = await run(constraints)
      expect(sat).toEqual('unsat')
    })
  })
  describe('raven\'s paradox', () => {
    const _1_through_2 = [
      gt(pr(and(not(H), and(not(B), R))), lit(0)),  // Extra unstated assumption.
      eq(cpr(B, and(R, H)), lit(1)),
      gt(pr(not(B)), pr(R)),
    ]
    const _1_through_4 = [
      ..._1_through_2,
      eq(cpr(B, H), pr(B)),
      eq(cpr(R, H), pr(R)),
    ]
    const _5 = gt(cpr(H, and(R, B)), cpr(H, and(not(R), not(B))))
    const _6 = gt(cpr(H, and(not(R), not(B))), pr(H))
    const _7 = lt(cpr(H, and(not(R), B)), pr(H))
    const _C = gte(cpr(H, R), cpr(H, not(B)))
    const regular = false
    test('(1) - (4) entail (5)', async () => {
      const constraints = [
        ..._1_through_4,
        cnot(_5),
      ]
      const { status: sat } = await run(constraints, regular)
      expect(sat).toEqual('unsat')
    })
    test('(1) - (4) entail (6)', async () => {
      const constraints = [
        ..._1_through_4,
        cnot(_6),
      ]
      const { status: sat } = await run(constraints, regular)
      expect(sat).toEqual('unsat')
    })
    test('(1) - (4) entail (7)', async () => {
      const constraints = [
        ..._1_through_4,
        cnot(_7),
      ]
      const { status: sat } = await run(constraints, regular)
      expect(sat).toEqual('unsat')
    })
    test('(1), (2), (C) entail (5)', async () => {
      const constraints = [
        ..._1_through_2,
        _C,
        cnot(_5),
      ]
      const { status: sat } = await run(constraints, regular)
      expect(sat).toEqual('unsat')
    })
    test('(1), (2), (C) does not entail (6)', async () => {
      const constraints = [
        ..._1_through_2,
        _C,
        cnot(_6),
      ]
      const { status: sat } = await run(constraints)
      expect(sat).toEqual('sat')
    })
    test('(1), (2), (C) does not entail (7)', async () => {
      const constraints = [
        ..._1_through_2,
        _C,
        cnot(_7),
      ]
      const { status: sat } = await run(constraints)
      expect(sat).toEqual('sat')
    })
  })
  describe('bayesian confirmation theory', () => {
    const confirms = (E: Sentence, H: Sentence): Constraint => gt(cpr(H, E), pr(H))
    const dk = (H: Sentence, E: Sentence, K: Sentence): RealExpr =>
      minus(cpr(H, and(E, K)), cpr(H, K))
    const ik = (H: Sentence, E: Sentence, K: Sentence): RealExpr =>
      divide(minus(cpr(E, and(H, K)), cpr(E, and(not(H), K))), plus(cpr(E, and(H, K)), cpr(E, and(not(H), K))))
    const sk = (H: Sentence, E: Sentence, K: Sentence): RealExpr =>
      minus(cpr(H, and(E, K)), cpr(H, and(not(E), K)))
    const without_k = (degk: (H: Sentence, E: Sentence, K: Sentence) => RealExpr) => (H: Sentence, E: Sentence): RealExpr =>
      degk(H, E, val(true))
    const [E1, E2] = [letter('E1'), letter('E2')]

    describe('without K', () => {
      const desideratum = (degree: (H: Sentence, E: Sentence) => RealExpr): Constraint[] => [
        gte(cpr(H, E1), cpr(H, E2)),
        cnot(gte(degree(H, E1), degree(H, E2))),
      ]

      test('d', async () => {
        const constraints = desideratum(without_k(dk))
        const { status: sat } = await run(constraints)
        expect(sat).toEqual('unsat')
      })
      test('i', async () => {
        const constraints = desideratum(without_k(ik))
        const { status: sat } = await run(constraints)
        expect(sat).toEqual('unsat')
      })
      test('s', async () => {
        const constraints = desideratum(without_k(sk))
        const { status: sat } = await run(constraints)
        expect(sat).toEqual('sat')
      })
    })
    describe('with K', () => {
      const desideratum = (degk: (H: Sentence, E: Sentence, K: Sentence) => RealExpr): Constraint[] => [
        confirms(E1, H),
        confirms(E2, H),
        eq(degk(H, E1, E2), without_k(degk)(H, E1)),
        eq(degk(H, E2, E1), without_k(degk)(H, E2)),
        cnot(gt(without_k(degk)(H, and(E1, E2)), without_k(degk)(H, E2))),
      ]
      test('d', async () => {
        const constraints = desideratum(dk)
        const { status: sat } = await run(constraints)
        expect(sat).toEqual('unsat')
      })
      test('i', async () => {
        const constraints = desideratum(ik)
        const { status: sat } = await run(constraints)
        expect(sat).toEqual('unsat')
      })
      describe('s (which takes too long so we\'re testing timing stuff)', () => {
        test.skip('by itself', async () => {
          const constraints = desideratum(sk)
          const { status: sat } = await run(constraints)
          expect(sat).toEqual('sat')
        })
        // test.skip('with timeout', async () => {
        //   const { Context } = await init_z3()
        //   const constraints = desideratum(sk)
        //   const start = performance.now()
        //   const tt = new TruthTable(variables_in_constraints(constraints))
        //   const timeout_ms = 5_000
        //   const fudge = 1_000
        //   const { status: sat } = await pr_sat(Context('main'), tt, constraints, { timeout_ms })
        //   const end = performance.now()
        //   expect(sat).toEqual('unknown')
        //   expect(end - start).toBeLessThan(timeout_ms + fudge)
        // })
      })
    })
  })
})

// describe.only('running a lot of stuff', () => {
//   test('all of them!', async () => {
//     // const relp = './fitelson_files/outputs/probability_table_generator_inputs_2.ts'
//     // const path = relp
//     const file: ConstraintsFile<string> = await import('./fitelson_files/outputs/probability_table_generator_inputs_2.ts').then((i) => i.default)
//     // Problems indices: 20, 23
//     await run_file(file, true, 0, 1)
//     process.stdout.write('Saving results... ')
//     // await save_constraints_file(file, path)
//     console.log('saved!')
//   })
// })

describe('smtlib-direct', () => {
  const smtlib = `
(set-logic QF_NRA)
(declare-fun a2 () Real)
(declare-fun a3 () Real)
(declare-fun a4 () Real)
(declare-fun a5 () Real)
(declare-fun a6 () Real)
(declare-fun a7 () Real)
(declare-fun a8 () Real)
(assert (and (= (+ (* (/ a6 (+ a2 a6)) (- 1)) (/ a8 (+ a5 a8))) (+ (* (/ (+ a4 a6) (- 1 a3 a5 a7 a8)) (- 1)) (/ (+ a7 a8) (+ a3 a5 a7 a8)))) (= (+ (* (/ a7 (+ a3 a7)) (- 1)) (/ a8 (+ a5 a8))) (+ (* (/ (+ a4 a7) (- 1 a2 a5 a6 a8)) (- 1)) (/ (+ a6 a8) (+ a2 a5 a6 a8)))) (<= (+ (* (/ (+ a4 a6 a7) (- 1 a5 a8)) (- 1)) (/ a8 (+ a5 a8))) (+ (* (/ (+ a4 a7) (- 1 a2 a5 a6 a8)) (- 1)) (/ (+ a6 a8) (+ a2 a5 a6 a8)))) (< 0 a2) (< 0 a3) (< 0 a4) (< 0 a5) (< 0 a6) (< 0 a7) (< 0 a8) (< 0 (+ (* (/ (+ a4 a6) (- 1 a3 a5 a7 a8)) (- 1)) (/ (+ a7 a8) (+ a3 a5 a7 a8)))) (< 0 (+ (* (/ (+ a4 a7) (- 1 a2 a5 a6 a8)) (- 1)) (/ (+ a6 a8) (+ a2 a5 a6 a8)))) (< a2 1) (< a3 1) (< a4 1) (< a5 1) (< a6 1) (< a7 1) (< a8 1) (< (+ a2 a3 a4 a5 a6 a7 a8) 1) (not (= (+ a2 a6) 0)) (not (= (+ a5 a8) 0)) (not (= (- 1 a3 a5 a7 a8) 0)) (not (= (+ a3 a5 a7 a8) 0)) (not (= (+ a3 a7) 0)) (not (= (+ a5 a8) 0)) (not (= (- 1 a2 a5 a6 a8) 0)) (not (= (+ a2 a5 a6 a8) 0)) (not (= (- 1 a5 a8) 0)) (not (= (+ a5 a8) 0)) (not (= (- 1 a2 a5 a6 a8) 0)) (not (= (+ a2 a5 a6 a8) 0)) (not (= (- 1 a3 a5 a7 a8) 0)) (not (= (+ a3 a5 a7 a8) 0)) (not (= (- 1 a2 a5 a6 a8) 0)) (not (= (+ a2 a5 a6 a8) 0))))
(check-sat)
(get-model)
  `

  const split_assertion_and = (text: string): string => {
    const split_lines = text.trim().split('\n')
    const s_lines: S[] = []
    for (const l of split_lines) {
      const l_as_s = parse_s(l)
      if (Array.isArray(l_as_s) && l_as_s.length > 0 && l_as_s[0] === 'assert' && Array.isArray(l_as_s[1]) && l_as_s[1].length > 0 && l_as_s[1][0] === 'and') {
        const and_operands = l_as_s[1].slice(1)
        for (const operand of and_operands) {
          s_lines.push(['assert', operand])
        }
      } else {
        s_lines.push(l_as_s)
      }
    }
    const result_lines = s_lines.map((s) => s_to_string(s, false))
    return result_lines.join('\n')
  }

  test('confirmation measure s', async () => {
    const { Context } = await init_z3()
    const ctx = Context('main')
    const { Solver } = ctx
    const s = new Solver()

    const expanded_and_stuff = split_assertion_and(smtlib)
    // console.log(expanded_and_stuff)
    s.fromString(expanded_and_stuff)

    const result = await s.check()
    expect(result).toEqual('sat')
  })

  // test('continuing Solver instance', () => {
  // })
})

describe('different denominator constraints', () => {
  test('total probability changes denominator to > 0', async () => {
    const cs: Constraint[] = [
      cnot(eq(pr(A), plus(multiply(cpr(A, B), pr(B)), multiply(cpr(A, not(B)), pr(not(B)))))),
    ]

    const z3 = await init_z3()
    const result = await pr_sat_wrapped(new WrappedSolver(z3, init_z3), new TruthTable(variables_in_constraints(cs)), cs)
    expect(result.solver_output.status).toEqual('unsat')
    console.log(result.optimized.smtlib.join('\n'))
    expect(result.optimized.smtlib).toEqual(
`(set-logic QF_NRA)
(declare-const s_0 Real)
(declare-const s_1 Real)
(declare-const s_2 Real)
(assert (>= s_0 0))
(assert (>= s_1 0))
(assert (>= s_2 0))
(assert (<= (+ s_0 s_1 s_2) 1))
(assert (> (+ s_0 s_2) 0))
(assert (> (- 1 (+ s_0 s_2)) 0))
(assert (not (= (+ s_0 s_1) (+ (* (/ s_0 (+ s_0 s_2)) (+ s_0 s_2)) (* (/ s_1 (- 1 (+ s_0 s_2))) (- 1 (+ s_0 s_2)))))))
(check-sat)`
    )
  })
  test('Pr(A) / Pr(B) = 1 changes denominator constraint to > 0', async () => {
    const cs: Constraint[] = [
      eq(divide(pr(A), pr(B)), lit(1)),
    ]

    const z3 = await init_z3()
    const result = await pr_sat_wrapped(new WrappedSolver(z3, init_z3), new TruthTable(variables_in_constraints(cs)), cs)
    expect(result.solver_output.status).toEqual('sat')
    console.log(result.optimized.smtlib)
    expect(result.optimized.smtlib).toEqual(
`(set-logic QF_NRA)
(declare-const s_0 Real)
(declare-const s_1 Real)
(declare-const s_2 Real)
(assert (>= s_0 0))
(assert (>= s_1 0))
(assert (>= s_2 0))
(assert (<= (+ s_0 s_1 s_2) 1))
(assert (> (+ s_0 s_2) 0))
(assert (= (/ (+ s_0 s_1) (+ s_0 s_2)) 1))
(check-sat)
(get-model)`
    )
  })
  test('Pr(A) / (Pr(B) - 10) > 1 keeps denominator constraint as != 0', async () => {
    const cs: Constraint[] = [
      eq(divide(pr(A), minus(pr(B), lit(10))), lit(1)),
    ]

    const z3 = await init_z3()
    const result = await pr_sat_wrapped(new WrappedSolver(z3, init_z3), new TruthTable(variables_in_constraints(cs)), cs)
    expect(result.solver_output.status).toEqual('unsat')
    console.log(result.optimized.smtlib)
    expect(result.optimized.smtlib).toEqual(
`(set-logic QF_NRA)
(declare-const s_0 Real)
(declare-const s_1 Real)
(declare-const s_2 Real)
(assert (>= s_0 0))
(assert (>= s_1 0))
(assert (>= s_2 0))
(assert (<= (+ s_0 s_1 s_2) 1))
(assert (not (= (- (+ s_0 s_2) 10) 0)))
(assert (= (/ (+ s_0 s_1) (- (+ s_0 s_2) 10)) 1))
(check-sat)`
    )
  })
})

import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { SolverStateMachine } from './solver'
import { BaseSolver } from './solver/basic'
import { WebWorkerSolver } from './solver/ww-solver'
import { run_file } from './fitelson_files/run'

describe('fitelson\'s inputs', () => {
  // You know what?
  // Fitelson likes giving me files in a particular format.
  // The format is loosely described as follows.
  // A single set of constraints appear in a contiguous chunk of lines.
  // If there are comments (a line preceded by a %) that are butted up against
  // a set of constraints, it acts as the description for the set.
  // SMT constraints may appear and will just be ignored for now.
  type ConstraintSet = {
    // If a comment is split across two lines (like '%line1\n%line2') will appear
    //   as [line1, line2].
    // Additionally, line1 and line2 are assumed to start at the first non-whitespace,
    //   non-newline characters after the '%', and end at the first newline character.
    description: string[]
    constraints: GoodConstraintList | BadConstraintList
  }

  type GoodConstraintList = {
    tag: 'good',
    constraints: Constraint[]
  }

  type BadConstraintList = {
    tag: 'bad',
    keep: boolean,  // treat this as a good constraint list without the errors.
    constraints: ({ tag: 'constraint', constraint: Constraint } | { tag: 'error', error: string, line: string })[]
  }

  type ConstraintsFile = {
    constraint_sets: ConstraintSet[]
  }

  const parse_case_file = (text: string): ConstraintsFile => {
    const LOOP_LIMIT = 100_000
    const lines = text.split('\n').map((l) => l.trim())
    const file: ConstraintsFile = { constraint_sets: [] }

    let current_index = 0
    const current = () => assert_exists(lines[current_index])

    let n_loops = 0
    while (current_index < lines.length) {
      while (current_index < lines.length && current() === '') {
        current_index++
      }

      if (current_index >= lines.length) {
        break
      }

      let comment_lines: string[] = []
      while (current_index < lines.length && current()[0] === '%') {
        comment_lines.push(current())
        current_index++
      }

      if (current_index >= lines.length) {
        break
      }

      let is_bad_list = false
      const bad_list: BadConstraintList = { tag: 'bad', keep: false, constraints: [] }
      const good_list: GoodConstraintList = { tag: 'good', constraints: [] }
      while (current_index < lines.length && current() !== '') {
        const [success, constraint_or_error] = parse_constraint(current())
        if (!success) {
          is_bad_list = true
          bad_list.constraints.push({ tag: 'error', error: constraint_or_error, line: current() })
        } else {
          bad_list.constraints.push({ tag: 'constraint', constraint: constraint_or_error })
          if (!is_bad_list) {
            good_list.constraints.push(constraint_or_error)
          }
        }
        current_index++
      }

      if (is_bad_list) {
        file.constraint_sets.push({
          description: comment_lines,
          constraints: bad_list,
        })
      } else {
        file.constraint_sets.push({
          description: comment_lines,
          constraints: good_list,
        })
      }

      n_loops++
      if (n_loops > LOOP_LIMIT) {
        throw new Error('parse_case_file: hit LOOP_LIMIT!')
      }
    }

    return file
  }

  // That was cool and all but descriptions aren't being applied to everything they ought be applied to.
  // For example, early in the file there are these lines:
  // `
  // % Three Forms of Bayes's Theorem
  // Pr(H | E) ≠ Pr(E | H)* Pr(H) / (Pr(E | H)* Pr(H) + Pr(E | ~H) * Pr(~H))
  //
  // Pr(H | E)/Pr(~H | E) ≠ (Pr(E | H)/Pr(E | ~H))*(Pr(H)/Pr(~H))
  //
  // Pr(H | E) ≠ 1 / (1 + (Pr(E | ~H)/Pr(E | H))*(Pr(~H)/Pr(H)))
  // `
  // The comment should be used to describe all three of these problems.
  // One could easily imagine a file where the comment is separated from the leading constraint set.
  // This suggests the following type def.

  type ConstraintsFile2 = {
    constraint_set_blocks: ConstraintSetBlock[]
  }

  type ConstraintSetBlock = {
    description: string[]
    constraint_sets: ConstraintSet2[]
  }

  type ConstraintSet2 = {
    continued_from_last: boolean
    constraints: BadConstraintList | GoodConstraintList
  }

  // It's relatively common in his files for two comment blocks to occur in a row without any constraints.
  // If this happens only the last comment block is associated with the following constraint.

  // After the second version of the parser I now realize that there's no way to parse the file how I'd like to
  // given how instructions for constructing sets of constraints sometimes appear in comments.
  // For example, there are some "continued" constraint sets which basically say to make a new set of constraints
  //   using the previous set plus some additional constraints.
  // It should be emphasized that from these two constraint blocks we still derive two sets of constraints, but
  //   the second set is defined as the previous block plus the second set.
  // For example:
  // % Simpson's Paradox 
  // `
  // Pr(X | Y & Z) > Pr(X | Z)
  // Pr(X | Y & ~Z) > Pr(X | ~Z)
  // Pr(X | Y) < Pr(X)
  //
  // % simplify the models with these numerical constraints
  // Pr(X)=1/2
  // Pr(Y)=1/2
  // `

  // I could do something like call into an LLM and have it try to guess what to do in this case, but that's
  //   overengineered, costs money to run, and would often be incorrect (especially if done cheaply) so I'll
  // just make it easier to change myself instead.

  // I'm retroactively adding a couple of fields.
  
  const FITELSON_FILE = `
'anot% PrSAT 3.0b: The Probability Table Generator (Beta)
% Koissi & Branden 
% August 20, 2025
 
% PrSAT 3.0 is an open source, ASCII/web based probability table generator.  
% It runs on any modern browser, and requires no additional software.
% It takes (arbitrary) sets of statements in probability calculus as input (in ASCII format).
% If the set is satisfiable, it will return a probability distribution (in the form of a probability table).
% If not, it will return "unsatisfiable."
% 
% Here is a brief video demo of the software.

% Some simple theorems

% probability of the conditional vs conditional probability
Pr(X > Y) < Pr(Y | X)

% Three Forms of Bayes's Theorem
Pr(H | E) ≠ Pr(E | H)* Pr(H) / (Pr(E | H)* Pr(H) + Pr(E | ~H) * Pr(~H))

Pr(H | E)/Pr(~H | E) ≠ (Pr(E | H)/Pr(E | ~H))*(Pr(H)/Pr(~H))

Pr(H | E) ≠ 1 / (1 + (Pr(E | ~H)/Pr(E | H))*(Pr(~H)/Pr(H)))

% Some Simple non-Theorems 

% Simpson's Paradox 
Pr(X | Y & Z) > Pr(X | Z)
Pr(X | Y & ~Z) > Pr(X | ~Z)
Pr(X | Y) < Pr(X)

% simplify the models with these numerical constraints
Pr(X)=1/2
Pr(Y)=1/2

% an unsatisfiable triple, resembling Simpson's Paradox
Pr(X | Y & Z) > Pr(X)
Pr(X | Y & ~Z) > Pr(X)
Pr(X | Y) < Pr(X)

% Cute Biconditional theorem
% Theorem: (1) & (2) IFF (3)
% (1) Pr(A | A <-> B) = Pr(A | ~(A <-> B))
% (2) Pr(B | A <-> B) = Pr(B | ~(A <-> B))
% (3) Pr(A) = Pr(B) = 1/2

% IF direction (I)
Pr(A) = Pr(B)
Pr(A) = 1/2
Pr(A | A <-> B) ≠ Pr(A | ~(A <-> B))

% IF direction (II)
Pr(A) = Pr(B)
Pr(A) = 1/2
Pr(B | A <-> B) ≠ Pr(B | ~(A <-> B))

% ONLY IF direction (I)
Pr(A | A <-> B) = Pr(A | ~(A <-> B))
Pr(B | A <-> B) = Pr(B | ~(A <-> B))
Pr(A) ≠ Pr(B)

% ONLY IF direction (II)
Pr(A | A <-> B) = Pr(A | ~(A <-> B))
Pr(B | A <-> B) = Pr(B | ~(A <-> B))
Pr(A) ≠ 1/2


% Reichenbach's Conjunctive Fork Theorem
Pr(E1 | E2 & C) = Pr(E1 | C)
Pr(E1 | E2 & ~C) = Pr(E1 | ~C)
Pr(E1 | C) > Pr(E1)
Pr(E2 | C) > Pr(E2)
Pr(E1 | E2) ≤ Pr(E1)

% Three props which are pairwise independent but not independent
% This produces an irregular model by default
% If we ask it for a regular model, it gives irrational numbers
Pr(X & Y) = Pr(X) * Pr(Y)
Pr(X & Z) = Pr(X) * Pr(Z)
Pr(Y & Z) = Pr(Y) * Pr(Z)
Pr(X & Y & Z) ≠ Pr(X) * Pr(Y) * Pr(Z)

% If we add this numerical constraint, then it gives a nice urn model
Pr(X) = 1/2

% Four props that are 2-wise and 3-wise independent, but not 4-wise independent
% It can't solve this one without additional numerical constraints (in up to 3 mins)
Pr(X & Y) = Pr(X) * Pr(Y)
Pr(X & Z) = Pr(X) * Pr(Z)
Pr(Y & Z) = Pr(Y) * Pr(Z)
Pr(X & U) = Pr(X) * Pr(U)
Pr(Y & U) = Pr(Y) * Pr(U)
Pr(Z & U) = Pr(Z) * Pr(U)
Pr(X & Y & Z) = Pr(X) * Pr(Y) * Pr(Z)
Pr(X & Y & U) = Pr(X) * Pr(Y) * Pr(U)
Pr(X & Z & U) = Pr(X) * Pr(Z) * Pr(U)
Pr(Y & Z & U) = Pr(Y) * Pr(Z) * Pr(U)
Pr(X & Y & Z & U) ≠ Pr(X) * Pr(Y) * Pr(Z) * Pr(U)

% with just this constraint, it gives irrational numbers
Pr(X)=1/2

% with one more numerical constraint, it gives a nice urn model
Pr(Y)=1/2

% Z- measure impossibility (trivial)
Pr(H | E1) > Pr(H)
Pr(H | E2) < Pr(H)
(Pr(H | E1 & E2) - Pr(H | E2)) / Pr(~H | E2) = (Pr(H | E1) - Pr(H)) / Pr(~H)
(Pr(H | E2 & E1) - Pr(H | E1)) / Pr(H | E1) = (Pr(H | E2) - Pr(H)) / Pr(H)

% S-measure impossibility (there are no REGULAR models for this, but there are SOME models)
% Note: for any value other than 1/2 there are Regular models...
(Pr(H | E1 & E2) - Pr(H | ~E1 & E2)) = (Pr(H | E1) - Pr(H | ~E1))
(Pr(H | E2 & E1) - Pr(H | ~E2 & E1)) = (Pr(H | E2) - Pr(H | ~E2))
Pr(H | E1) - Pr(H | ~E1) = 1/2
Pr(H | E2) - Pr(H | ~E2) = -1/2
Pr(H | E1 & E2) - Pr(H | ~(E1 & E2)) ≠ 0

% Wason result verification -- easily solved
Pr(B | H & R) = 1
Pr(~B)/Pr(R) ≥ Pr(~B | H)/Pr(R | H)
Pr(~B) > Pr(R)
Pr(H & R & B) > 0
Pr(H & ~R & B) > 0 
Pr(H & ~R & ~B) > 0
Pr(~H & R & B) > 0
Pr(~H & R & ~B) > 0
Pr(~H & ~R & ~B) > 0
Pr(~H & ~R & B) > 0
Pr(B | R) * (Pr(H | R & B) - Pr(H | R)) + Pr(~B | R) * Pr(H | R) ≤ Pr(R | ~B) * Pr(H | ~B) + Pr(~R | ~B) * (Pr(H | ~R & ~B) - Pr(H | ~B))

% Wason/Rvens problem -- non-triviality model for KO measure.  Finds a simpler model than Mathematica's!
Pr(B | H & R) = 1
Pr(~B)/Pr(R) >= Pr(~B | H)/Pr(R | H) 
Pr(~B) > Pr(R)
Pr(H & R & B) > 0
Pr(H & ~R & B) > 0
Pr(H & ~R & ~B) > 0
Pr(~H & R & B) > 0
Pr(~H & R & ~B) > 0
Pr(~H & ~R & ~B) > 0
Pr(~H & ~R & B) > 0
Pr(B | R) * ((Pr(B | H & R) - Pr(B | ~H & R))/( Pr(B | H & R) + Pr(B | ~H & R))) * (( Pr(B | H & R) - Pr(B | ~H & R))/( Pr(B | H & R) + Pr(B | ~H & R))) + Pr(~B | R) * (( Pr(~B | H & R) - Pr(~B | ~H & R))/( Pr(~B | H & R) + Pr(~B | ~H & R))) * (( Pr(~B | H & R) - Pr(~B | ~H & R))/( Pr(~B | H & R) + Pr(~B | ~H & R))) >= Pr(R | ~B) * (( Pr(R | H & ~B) - Pr(R | ~H & ~B))/( Pr(R | H & ~B) + Pr(R | ~H & ~B))) * (( Pr(R | H & ~B) - Pr(R | ~H & ~B))/( Pr(R | H & ~B) + Pr(R | ~H & ~B))) + Pr(~R | ~B) * (( Pr(~R | H & ~B) - Pr(~R | ~H & ~B))/( Pr(~R | H & ~B) + Pr(~R | ~H & ~B))) * (( Pr(~R | H & ~B) - Pr(~R | ~H & ~B))/( Pr(~R | H & ~B) + Pr(~R | ~H & ~B)))

% Wason/Rvens problem -- trying to verify the KO version of the theorem -- hard
% It verifies this result -- and in under 30s!  I was not able to get any solver to do this!  Huge.
Pr(B | H & R) = 1
Pr(~B)/Pr(R) >= Pr(~B | H)/Pr(R | H) 
Pr(~B) > Pr(R)
Pr(H & R & B) > 0
Pr(H & ~R & B) > 0
Pr(H & ~R & ~B) > 0
Pr(~H & R & B) > 0
Pr(~H & R & ~B) > 0
Pr(~H & ~R & ~B) > 0
Pr(~H & ~R & B) > 0
Pr(B | R) * ((Pr(B | H & R) - Pr(B | ~H & R))/( Pr(B | H & R) + Pr(B | ~H & R))) * (( Pr(B | H & R) - Pr(B | ~H & R))/( Pr(B | H & R) + Pr(B | ~H & R))) + Pr(~B | R) * (( Pr(~B | H & R) - Pr(~B | ~H & R))/( Pr(~B | H & R) + Pr(~B | ~H & R))) * (( Pr(~B | H & R) - Pr(~B | ~H & R))/( Pr(~B | H & R) + Pr(~B | ~H & R))) < Pr(R | ~B) * (( Pr(R | H & ~B) - Pr(R | ~H & ~B))/( Pr(R | H & ~B) + Pr(R | ~H & ~B))) * (( Pr(R | H & ~B) - Pr(R | ~H & ~B))/( Pr(R | H & ~B) + Pr(R | ~H & ~B))) + Pr(~R | ~B) * (( Pr(~R | H & ~B) - Pr(~R | ~H & ~B))/( Pr(~R | H & ~B) + Pr(~R | ~H & ~B))) * (( Pr(~R | H & ~B) - Pr(~R | ~H & ~B))/( Pr(~R | H & ~B) + Pr(~R | ~H & ~B)))

% Another negative Wason result —- that u(B) > u (~B) does NOT follow from the strong Byesian assumptions.  
% Finds a nice simple urn model.
Pr(B | H & R) = 1 
Pr(H | R) = Pr(H | ~R)
Pr(H | B) = Pr(H | ~B)
Pr(~B) > Pr(B)
Pr(B) > Pr(R)
Pr(H & R & B) > 0
Pr(H & ~R & B) > 0
Pr(H & ~R & ~B) > 0
Pr(~H & R & B) > 0
Pr(~H & R & ~B) > 0
Pr(~H & ~R & ~B) > 0
Pr(~H & ~R & B) > 0
Pr(R | B) * (Pr(H | R & B) - Pr(H | B)) * (Pr(H | R & B) - Pr(H | B)) + Pr(~R | B) * (Pr(H | ~R & B) - Pr(H | B)) * (Pr(H | ~R & B) - Pr(H | B)) < Pr(R | ~B) * (Pr(H | R & ~B) - Pr(H | ~B)) * (Pr(H | R & ~B) - Pr(H | ~B)) + Pr(~R | ~B) * (Pr(H | ~R & ~B) - Pr(H | ~B)) * (Pr(H | ~R & ~B) - Pr(H | ~B))

% And here is the positive result -- that absence of confirmation bias fills this gap 
% it can't solve this one -- even in 5 minutes (SMT input  below: ≠ 0 replaced with > 0)
Pr(B | H & R) = 1 
Pr(H | R) = Pr(H | ~R)
Pr(H | B) = Pr(H | ~B)
Pr(~B) > Pr(B)
Pr(B) > Pr(R)
Pr(H & R & B) > 0
Pr(H & ~R & B) > 0
Pr(H & ~R & ~B) > 0
Pr(~H & R & B) > 0
Pr(~H & R & ~B) > 0
Pr(~H & ~R & ~B) > 0
Pr(~H & ~R & B) > 0
Pr(R | B) <= Pr(R | ~B)
Pr(R | B) * (Pr(H | R & B) - Pr(H | B)) * (Pr(H | R & B) - Pr(H | B)) + Pr(~R | B) * (Pr(H | ~R & B) - Pr(H | B)) * (Pr(H | ~R & B) - Pr(H | B)) <= Pr(R | ~B) * (Pr(H | R & ~B) - Pr(H | ~B)) * (Pr(H | R & ~B) - Pr(H | ~B)) + Pr(~R | ~B) * (Pr(H | ~R & ~B) - Pr(H | ~B)) * (Pr(H | ~R & ~B) - Pr(H | ~B))

(set-logic QF_NRA)
(declare-const s_0 Real)
(declare-const s_1 Real)
(declare-const s_2 Real)
(declare-const s_3 Real)
(declare-const s_4 Real)
(declare-const s_5 Real)
(declare-const s_6 Real)
(assert (>= s_0 0))
(assert (>= s_1 0))
(assert (>= s_2 0))
(assert (>= s_3 0))
(assert (>= s_4 0))
(assert (>= s_5 0))
(assert (>= s_6 0))
(assert (<= (+ s_0 s_1 s_2 s_3 s_4 s_5 s_6) 1))
(assert (> (+ s_0 s_4) 0))
(assert (> (+ s_0 s_2 s_4 s_6) 0))
(assert (> (- 1 (+ s_0 s_2 s_4 s_6)) 0))
(assert (> (+ s_0 s_1 s_2 s_3) 0))
(assert (> (- 1 (+ s_0 s_1 s_2 s_3)) 0))
(assert (> (+ s_0 s_1 s_2 s_3) 0))
(assert (> (- 1 (+ s_0 s_1 s_2 s_3)) 0))
(assert (> (+ s_0 s_1 s_2 s_3) 0))
(assert (> (+ s_0 s_2) 0))
(assert (> (+ s_0 s_1 s_2 s_3) 0))
(assert (> (+ s_0 s_2) 0))
(assert (> (+ s_0 s_1 s_2 s_3) 0))
(assert (> (+ s_0 s_1 s_2 s_3) 0))
(assert (> (+ s_1 s_3) 0))
(assert (> (+ s_0 s_1 s_2 s_3) 0))
(assert (> (+ s_1 s_3) 0))
(assert (> (+ s_0 s_1 s_2 s_3) 0))
(assert (> (- 1 (+ s_0 s_1 s_2 s_3)) 0))
(assert (> (+ s_4 s_6) 0))
(assert (> (- 1 (+ s_0 s_1 s_2 s_3)) 0))
(assert (> (+ s_4 s_6) 0))
(assert (> (- 1 (+ s_0 s_1 s_2 s_3)) 0))
(assert (> (- 1 (+ s_0 s_1 s_2 s_3)) 0))
(assert (> (- 1 (+ s_0 s_1 s_2 s_3 s_4 s_6)) 0))
(assert (> (- 1 (+ s_0 s_1 s_2 s_3)) 0))
(assert (> (- 1 (+ s_0 s_1 s_2 s_3 s_4 s_6)) 0))
(assert (> (- 1 (+ s_0 s_1 s_2 s_3)) 0))
(assert (= (/ s_0 (+ s_0 s_4)) 1))
(assert (= (/ (+ s_0 s_4) (+ s_0 s_2 s_4 s_6)) (/ (+ s_1 s_5) (- 1 (+ s_0 s_2 s_4 s_6)))))
(assert (= (/ (+ s_0 s_1) (+ s_0 s_1 s_2 s_3)) (/ (+ s_4 s_5) (- 1 (+ s_0 s_1 s_2 s_3)))))
(assert (> (- 1 (+ s_0 s_1 s_2 s_3)) (+ s_0 s_1 s_2 s_3)))
(assert (> (+ s_0 s_1 s_2 s_3) (+ s_0 s_2 s_4 s_6)))
(assert (> s_0 0))
(assert (> s_1 0))
(assert (> s_5 0))
(assert (> s_2 0))
(assert (> s_6 0))
(assert (> (- 1 (+ s_0 s_1 s_2 s_3 s_4 s_5 s_6)) 0))
(assert (> s_3 0))
(assert (<= (/ (+ s_0 s_2) (+ s_0 s_1 s_2 s_3)) (/ (+ s_4 s_6) (- 1 (+ s_0 s_1 s_2 s_3)))))
(assert (<= (+ (* (/ (+ s_0 s_2) (+ s_0 s_1 s_2 s_3)) (- (/ s_0 (+ s_0 s_2)) (/ (+ s_0 s_1) (+ s_0 s_1 s_2 s_3))) (- (/ s_0 (+ s_0 s_2)) (/ (+ s_0 s_1) (+ s_0 s_1 s_2 s_3)))) (* (/ (+ s_1 s_3) (+ s_0 s_1 s_2 s_3)) (- (/ s_1 (+ s_1 s_3)) (/ (+ s_0 s_1) (+ s_0 s_1 s_2 s_3))) (- (/ s_1 (+ s_1 s_3)) (/ (+ s_0 s_1) (+ s_0 s_1 s_2 s_3))))) (+ (* (/ (+ s_4 s_6) (- 1 (+ s_0 s_1 s_2 s_3))) (- (/ s_4 (+ s_4 s_6)) (/ (+ s_4 s_5) (- 1 (+ s_0 s_1 s_2 s_3)))) (- (/ s_4 (+ s_4 s_6)) (/ (+ s_4 s_5) (- 1 (+ s_0 s_1 s_2 s_3))))) (* (/ (- 1 (+ s_0 s_1 s_2 s_3 s_4 s_6)) (- 1 (+ s_0 s_1 s_2 s_3))) (- (/ s_5 (- 1 (+ s_0 s_1 s_2 s_3 s_4 s_6))) (/ (+ s_4 s_5) (- 1 (+ s_0 s_1 s_2 s_3)))) (- (/ s_5 (- 1 (+ s_0 s_1 s_2 s_3 s_4 s_6))) (/ (+ s_4 s_5) (- 1 (+ s_0 s_1 s_2 s_3))))))))
(check-sat)

% does eliminating ratios help? 
% nope -- it seems to be the last, big constraint (SMT input directly below)
Pr(B & H & R) = Pr(H & R) 
Pr(H & R) * Pr(~R) = Pr(H & ~R)* Pr(R)
Pr(H & B) * Pr(~B) = Pr(H & ~B) * Pr(B)
Pr(~B) > Pr(B)
Pr(B) > Pr(R)
Pr(H & R & B) > 0
Pr(H & ~R & B) > 0
Pr(H & ~R & ~B) > 0
Pr(~H & R & B) > 0
Pr(~H & R & ~B) > 0
Pr(~H & ~R & ~B) > 0
Pr(~H & ~R & B) > 0
Pr(R & B) * Pr(~B) <= Pr(R & ~B) * Pr(B)
Pr(R | B) * (Pr(H | R & B) - Pr(H | B)) * (Pr(H | R & B) - Pr(H | B)) + Pr(~R | B) * (Pr(H | ~R & B) - Pr(H | B)) * (Pr(H | ~R & B) - Pr(H | B)) <= Pr(R | ~B) * (Pr(H | R & ~B) - Pr(H | ~B)) * (Pr(H | R & ~B) - Pr(H | ~B)) + Pr(~R | ~B) * (Pr(H | ~R & ~B) - Pr(H | ~B)) * (Pr(H | ~R & ~B) - Pr(H | ~B))

(set-logic QF_NRA)
(declare-const s_0 Real)
(declare-const s_1 Real)
(declare-const s_2 Real)
(declare-const s_3 Real)
(declare-const s_4 Real)
(declare-const s_5 Real)
(declare-const s_6 Real)
(assert (>= s_0 0))
(assert (>= s_1 0))
(assert (>= s_2 0))
(assert (>= s_3 0))
(assert (>= s_4 0))
(assert (>= s_5 0))
(assert (>= s_6 0))
(assert (<= (+ s_0 s_1 s_2 s_3 s_4 s_5 s_6) 1))
(assert (> (+ s_0 s_4) 0))
(assert (> (+ s_0 s_2 s_4 s_6) 0))
(assert (> (- 1 (+ s_0 s_2 s_4 s_6)) 0))
(assert (> (+ s_0 s_1 s_2 s_3) 0))
(assert (> (- 1 (+ s_0 s_1 s_2 s_3)) 0))
(assert (> (+ s_0 s_1 s_2 s_3) 0))
(assert (> (- 1 (+ s_0 s_1 s_2 s_3)) 0))
(assert (> (+ s_0 s_1 s_2 s_3) 0))
(assert (> (+ s_0 s_2) 0))
(assert (> (+ s_0 s_1 s_2 s_3) 0))
(assert (> (+ s_0 s_2) 0))
(assert (> (+ s_0 s_1 s_2 s_3) 0))
(assert (> (+ s_0 s_1 s_2 s_3) 0))
(assert (> (+ s_1 s_3) 0))
(assert (> (+ s_0 s_1 s_2 s_3) 0))
(assert (> (+ s_1 s_3) 0))
(assert (> (+ s_0 s_1 s_2 s_3) 0))
(assert (> (- 1 (+ s_0 s_1 s_2 s_3)) 0))
(assert (> (+ s_4 s_6) 0))
(assert (> (- 1 (+ s_0 s_1 s_2 s_3)) 0))
(assert (> (+ s_4 s_6) 0))
(assert (> (- 1 (+ s_0 s_1 s_2 s_3)) 0))
(assert (> (- 1 (+ s_0 s_1 s_2 s_3)) 0))
(assert (> (- 1 (+ s_0 s_1 s_2 s_3 s_4 s_6)) 0))
(assert (> (- 1 (+ s_0 s_1 s_2 s_3)) 0))
(assert (> (- 1 (+ s_0 s_1 s_2 s_3 s_4 s_6)) 0))
(assert (> (- 1 (+ s_0 s_1 s_2 s_3)) 0))
(assert (= (/ s_0 (+ s_0 s_4)) 1))
(assert (= (/ (+ s_0 s_4) (+ s_0 s_2 s_4 s_6)) (/ (+ s_1 s_5) (- 1 (+ s_0 s_2 s_4 s_6)))))
(assert (= (/ (+ s_0 s_1) (+ s_0 s_1 s_2 s_3)) (/ (+ s_4 s_5) (- 1 (+ s_0 s_1 s_2 s_3)))))
(assert (> (- 1 (+ s_0 s_1 s_2 s_3)) (+ s_0 s_1 s_2 s_3)))
(assert (> (+ s_0 s_1 s_2 s_3) (+ s_0 s_2 s_4 s_6)))
(assert (> s_0 0))
(assert (> s_1 0))
(assert (> s_5 0))
(assert (> s_2 0))
(assert (> s_6 0))
(assert (> (- 1 (+ s_0 s_1 s_2 s_3 s_4 s_5 s_6)) 0))
(assert (> s_3 0))
(assert (<= (/ (+ s_0 s_2) (+ s_0 s_1 s_2 s_3)) (/ (+ s_4 s_6) (- 1 (+ s_0 s_1 s_2 s_3)))))
(assert (<= (+ (* (/ (+ s_0 s_2) (+ s_0 s_1 s_2 s_3)) (- (/ s_0 (+ s_0 s_2)) (/ (+ s_0 s_1) (+ s_0 s_1 s_2 s_3))) (- (/ s_0 (+ s_0 s_2)) (/ (+ s_0 s_1) (+ s_0 s_1 s_2 s_3)))) (* (/ (+ s_1 s_3) (+ s_0 s_1 s_2 s_3)) (- (/ s_1 (+ s_1 s_3)) (/ (+ s_0 s_1) (+ s_0 s_1 s_2 s_3))) (- (/ s_1 (+ s_1 s_3)) (/ (+ s_0 s_1) (+ s_0 s_1 s_2 s_3))))) (+ (* (/ (+ s_4 s_6) (- 1 (+ s_0 s_1 s_2 s_3))) (- (/ s_4 (+ s_4 s_6)) (/ (+ s_4 s_5) (- 1 (+ s_0 s_1 s_2 s_3)))) (- (/ s_4 (+ s_4 s_6)) (/ (+ s_4 s_5) (- 1 (+ s_0 s_1 s_2 s_3))))) (* (/ (- 1 (+ s_0 s_1 s_2 s_3 s_4 s_6)) (- 1 (+ s_0 s_1 s_2 s_3))) (- (/ s_5 (- 1 (+ s_0 s_1 s_2 s_3 s_4 s_6))) (/ (+ s_4 s_5) (- 1 (+ s_0 s_1 s_2 s_3)))) (- (/ s_5 (- 1 (+ s_0 s_1 s_2 s_3 s_4 s_6))) (/ (+ s_4 s_5) (- 1 (+ s_0 s_1 s_2 s_3))))))))
(check-sat)


% Maybe if we break this down into cases? Yes!
% (1) given B, R confirms H.  Then, Pr(H | R & B) - Pr(H | B) and Pr(H | B) - Pr(H | ~R & B) are non-negative
% (2) given ~B, , R confirms H. Then, Pr(H | R & ~B) - Pr(H | ~B) and Pr(H | ~B) - Pr(H | R & ~B) are non-negative
% There are 4 cases: (1) & (2).  Then, the final constraint is just the following, and then DOES return UNSAT
Pr(R | B) * (Pr(H | R & B) - Pr(H | B)) + Pr(~R | B) * (Pr(H | B) - Pr(H | ~R & B)) <= Pr(R | ~B) * (Pr(H | R & ~B) - Pr(H | ~B)) + Pr(~R | ~B) * (Pr(H | ~B) - Pr(H | ~R & ~B))

% I'm sure that will be the same for the 3 other cases: (1) & ~(2), ~(1) & (2), and ~(1) & ~(2)

% Here is a non-triviality model for the full Bayesian assumptions + the full Nickerson ordering + no confirmation bias.  Easily finds a simple urn model.
Pr(B | H & R) = 1 
Pr(H | R) = Pr(H | ~R)
Pr(H | B) = Pr(H | ~B)
Pr(~B) > Pr(B)
Pr(B) > Pr(R)
Pr(H & R & B) > 0
Pr(H & ~R & B) > 0
Pr(H & ~R & ~B) > 0
Pr(~H & R & B) > 0
Pr(~H & R & ~B) > 0
Pr(~H & ~R & ~B) > 0
Pr(~H & ~R & B) > 0
Pr(R | B) <= Pr(R | ~B)
Pr(R | B) * (Pr(H | R & B) - Pr(H | B)) * (Pr(H | R & B) - Pr(H | B)) + Pr(~R | B) * (Pr(H | ~R & B) - Pr(H | B)) * (Pr(H | ~R & B) - Pr(H | B)) > Pr(R | ~B) * (Pr(H | R & ~B) - Pr(H | ~B)) * (Pr(H | R & ~B) - Pr(H | ~B)) + Pr(~R | ~B) * (Pr(H | ~R & ~B) - Pr(H | ~B)) * (Pr(H | ~R & ~B) - Pr(H | ~B))
Pr(B | R) * (Pr(H | R & B) - Pr(H | R)) * (Pr(H | R & B) - Pr(H | R)) + Pr(~B | R) * (Pr(H | R & ~B) - Pr(H | R)) * (Pr(H | R & ~B) - Pr(H | R)) > Pr(R | B) * (Pr(H | R & B) - Pr(H | B)) * (Pr(H | R & B) - Pr(H | B)) + Pr(~R | B) * (Pr(H | ~R & B) - Pr(H | B)) * (Pr(H | ~R & B) - Pr(H | B))

% Here is the Wason (positive) confirmation-bias result --- solves it in ~30s)
Pr(B | H & R) = 1 
Pr(~B)/Pr(R) >= Pr(~B | H)/Pr(R | H) 
Pr(~B) > Pr(B)
Pr(B) > Pr(R)
Pr(H & R & B) > 0
Pr(H & ~R & B) > 0
Pr(H & ~R & ~B) > 0
Pr(~H & R & B) > 0
Pr(~H & R & ~B) > 0
Pr(~H & ~R & ~B) > 0
Pr(~H & ~R & B) > 0
Pr(R | B) * (Pr(H | R & B) - Pr(H | B)) * (Pr(H | R & B) - Pr(H | B)) + Pr(~R | B) * (Pr(H | ~R & B) - Pr(H | B)) * (Pr(H | ~R & B) - Pr(H | B))  > Pr(R | ~B) * (Pr(H | R & ~B) - Pr(H | ~B)) * (Pr(H | R & ~B) - Pr(H | ~B)) + Pr(~R | ~B) * (Pr(H | ~R & ~B) - Pr(H | ~B)) * (Pr(H | ~R & ~B) - Pr(H | ~B))
Pr(R | B) <= Pr(R | ~B)
(Pr(H | R & ~B) - Pr(H | ~B)) * (Pr(H | R & ~B) - Pr(H | ~B)) > (Pr(H | R & B) - Pr(H | B)) * (Pr(H | R & B) - Pr(H | B))

% And, it does  find a non-triviality model for this one (in ~40s)
Pr(B | H & R) = 1 
Pr(~B)/Pr(R) >= Pr(~B | H)/Pr(R | H) 
Pr(~B) > Pr(B)
Pr(B) > Pr(R)
Pr(H & R & B) > 0
Pr(H & ~R & B) > 0
Pr(H & ~R & ~B) > 0
Pr(~H & R & B) > 0
Pr(~H & R & ~B) > 0
Pr(~H & ~R & ~B) > 0
Pr(~H & ~R & B) > 0
Pr(R | B) * (Pr(H | R & B) - Pr(H | B)) * (Pr(H | R & B) - Pr(H | B)) + Pr(~R | B) * (Pr(H | ~R & B) - Pr(H | B)) * (Pr(H | ~R & B) - Pr(H | B))  > Pr(R | ~B) * (Pr(H | R & ~B) - Pr(H | ~B)) * (Pr(H | R & ~B) - Pr(H | ~B)) + Pr(~R | ~B) * (Pr(H | ~R & ~B) - Pr(H | ~B)) * (Pr(H | ~R & ~B) - Pr(H | ~B))
Pr(R | B) > Pr(R | ~B)
(Pr(H | R & ~B) - Pr(H | ~B)) * (Pr(H | R & ~B) - Pr(H | ~B)) > (Pr(H | R & B) - Pr(H | B)) * (Pr(H | R & B) - Pr(H | B))

% Sidebar on Nickerson's numerical model: Nickerson's numerical assumption that P[H] = 1/2, 
% which may seem innocuous, actually entails (given only our weak background assumptions 
% + the additional assumption that Pr(~Ba)>8/10) that Pr[Ra | Ba]  > Pr[Ra | ~Ba].  
% Here is a demonstration -- easily verified with Koissi's program
Pr(B | H & R) = 1 
Pr(~B)/Pr(R) >= Pr(~B | H)/Pr(R | H) 
Pr(~B) > 8/10
8/10 > Pr(R)
Pr(H & R & B) > 0
Pr(H & ~R & B) > 0
Pr(H & ~R & ~B) > 0
Pr(~H & R & B) > 0
Pr(~H & R & ~B) > 0
Pr(~H & ~R & ~B) > 0
Pr(~H & ~R & B) > 0
Pr(H) = 1/2
Pr(R | B) ≤ Pr(R | ~B)

% Salmon's sufficient condition for AND (verifies this)
Pr(B | A) > Pr(B)
Pr(C | A) > Pr(C)
Pr(C | A) - Pr(C) = Pr(C | A & B) - Pr(C | B)
Pr(B & C | A) <= Pr(B & C)

% Salmon's sufficient condition for OR (verifies this -- in under 1m)
Pr(B | A) > Pr(B)
Pr(C | A) > Pr(C)
Pr(C | A) - Pr(C) = Pr(C | A & B) - Pr(C | B)
Pr(B \/ C | A) <= Pr(B \/ C)

% Our weaker Salmonian sufficient condition for AND (assuming Regularity, case 1 -- easily verified)
% This is a nice example to illustrate when Regularity can make a difference
Pr(B | A) > Pr(B)
Pr(C | A) > Pr(C)
Pr(C | A & B) ≥ Pr(C | B)
Pr(B & C | A) <= Pr(B & C)

% Our weaker sufficient condition for OR (assuming Regularity, case 1 -- verifies this too, in under 1m)
Pr(B | A) > Pr(B)
Pr(C | A) > Pr(C)
Pr(C | A) - Pr(C) ≥ Pr(C | A & B) - Pr(C | B)
Pr(B \/ C | A) <= Pr(B \/ C)

% robustness of our Salmonian condition for OR —- for the m measure 
% (Koissi's program does this -- none of the others do)
Pr(C | A) > Pr(C)
Pr(B | A) > Pr(B)
Pr(A | C) - Pr(A | ~C) ≥ Pr(A | C & B) - Pr(A | ~C & B)
Pr(B \/ C | A) ≤ Pr(B \/ C)

% Our Triviality Result (trivial for the program)
Pr(C) = Pr(Q | P)
Pr(C | ~Q) = Pr(Q | P & ~Q)
Pr(C | ~P \/ Q) = Pr(Q | P & (~P \/ Q))
Pr(P & (Q <> C)) < 1

% Industrial Strength Example with 63 real variables
% Example #2: 63 real variables -- solved instantly by PrSAT 3.0b.  
% Takes 600+ seconds on PrSAT 2.5 random search!
Pr(A & B & H) = Pr(A) * Pr(B) * Pr(H | A & B)
Pr(A & B & ~H) = Pr(A) * Pr(B) * Pr(~H | A & B)
Pr(A & ~B & H) = Pr(A) * Pr(~B) * Pr(H | A & ~B)
Pr(A & ~B & ~H) = Pr(A) * Pr(~B) * Pr(~H | A & ~B)
Pr(~A & B & H) = Pr(~A) * Pr(B) * Pr(H | ~A & B)
Pr(~A & B & ~H) = Pr(~A) * Pr(B) * Pr(~H | ~A & B)
Pr(~A & ~B & H) = Pr(~A) * Pr(~B) * Pr(H | ~A & ~B)
Pr(~A & ~B & ~H) = Pr(~A) * Pr(~B) * Pr(~H | ~A & ~B)
Pr(A & B & H) = Pr(F & G & Y)
Pr(A & B & ~H) = Pr(F & G & ~Y)
Pr(A & ~B & H) = Pr(F & ~G & Y)
Pr(A & ~B & ~H) = Pr(F & ~G & ~Y)
Pr(~A & B & H) = Pr(~F & G & Y)
Pr(~A & B & ~H) = Pr(~F & G & ~Y)
Pr(~A & ~B & H) = Pr(~F & ~G & Y)
Pr(~A & ~B & ~H) = Pr(~F & ~G & ~Y)
Pr(F & G & Y) = Pr(F) * Pr(G | F) * Pr(Y | F & G)
Pr(F & G & ~Y) = Pr(F) * Pr(G | F) * Pr(~Y | F & G)
Pr(F & ~G & Y) = Pr(F) * Pr(~G | F) * Pr(Y | F & ~G)
Pr(F & ~G & ~Y) = Pr(F) * Pr(~G | F) * Pr(~Y | F & ~G)
Pr(~F & G & Y) = Pr(~F) * Pr(G | ~F) * Pr(Y | ~F & G)
Pr(~F & G & ~Y) = Pr(~F) * Pr(G | ~F) * Pr(~Y | ~F & G)
Pr(~F & ~G & Y) = Pr(~F) * Pr(~G | ~F) * Pr(Y | ~F & ~G)
Pr(~F & ~G & ~Y) = Pr(~F) * Pr(~G | ~F) * Pr(~Y | ~F & ~G)
Pr(H | A) > Pr(H)
Pr(H | B) > Pr(H)
Pr(A & B) = Pr(A) * Pr(B)
Pr(H | F) > Pr(H)
Pr(H | G) > Pr(H)
Pr(A) = Pr(F)
Pr(B) = Pr(G)
Pr(A) = 1/6
Pr(B) = 1/6
Pr(H) = 1/6
Pr(F) = 1/6
Pr(G) = 1/6
Pr(Y) = 1/6
Pr(A & H)/(Pr(A) * Pr(H)) = Pr(F & H)/(Pr(F) * Pr(H))

% Showing d,l are not ordinally equivalent (does not solve this -- in even 2 mins)
Pr(H1 | E1) - Pr(H1) > Pr(H2 | E2) - Pr(H2)
Pr(E1 | H1)/Pr(E1 | ~H1) < Pr(E2 | H2)/Pr(E2 | ~H2)

% But, simply adding a single marginal constraint yields a regular model in <30s
Pr(H1) = 1/2

% Another approach: eliminate ratios.  This usually helps a lot. Now it solves in under 1m!
Pr(H1 & E1) * Pr(E2) - Pr(H1) * Pr(E1) * Pr(E2) > Pr(H2 & E2) * Pr(E1) - Pr(H2) * Pr(E1) * Pr(E2)
Pr(E1 & H1) * Pr(E2 & ~H2) * Pr(H2) * Pr(~H1) < Pr(E2 & H2) * Pr(E1 & ~H1) * Pr(H1) * Pr(~H2)

% easier example: showing d,r,s are not ordinally equivalent
Pr(X | Y) - Pr(X) > Pr(Y | X) - Pr(Y)
Pr(X | Y) - Pr(X | ~Y) < Pr(Y | X) - Pr(Y | ~X)
(Pr(X | Y) - Pr(X))/(Pr(X | Y) + Pr(X)) = (Pr(Y | X) - Pr(Y))/(Pr(Y | X) + Pr(Y))
  `
  test('NOICE', () => {
    const file = parse_constraints_file(FITELSON_FILE)
    console.log(constraints_file_to_string(file))
  }, 5000)
  test('nice', () => {
    const file = parse_constraints_file(FITELSON_FILE)
    console.log(JSON.stringify(constraints_file_to_partially_parsed_file(file), null, 2))
  })

  test('NICE', async () => {
    const p = path.join(__dirname, 'fitelson_files', 'inputs', 'probability_table_generator_inputs_2.txt')
    const text = (await fs.readFile(p)).toString()
    const file = parse_constraints_file(text)
    const partially_parsed_file = constraints_file_to_partially_parsed_file(file)
    console.log(partially_parsed_file)
  })
})
