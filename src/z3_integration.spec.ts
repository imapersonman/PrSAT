import { describe, test, expect } from 'vitest'
import { model_assignment_output_to_string, ModelAssignmentOutput, parse_to_assignment, poly_s, pr_sat_staged, WrappedSolver } from './z3_integration'
import { S } from './s'

type Constraint = PrSat['Constraint']

describe('parse_to_assignment', () => {
  describe('negative', () => {
    test('negative rational', () => {
      const s: S = ['-', ['/', '3', '16']]
      const parsed = parse_to_assignment(s)
      const expected: ModelAssignmentOutput = { tag: 'negative', inner: { tag: 'rational', numerator: { tag: 'literal', value: 3 }, denominator: { tag: 'literal', value: 16 } } }
      expect(parsed).toEqual(expected)
    })
  })
  describe('root-obj', () => {
    test('degree 1', () => {
      // Not sure if this will ever be output from a z3 model but its fine.
      const s: S = ['root-obj', ['+', ['*', '3', 'x'], '5'], '1']
      const ps: S = ['root-obj', poly_s([3, 5]), '1']
      expect(ps).toEqual(s)
      const parsed = parse_to_assignment(s)
      const expected: ModelAssignmentOutput = { tag: 'generic-root-obj', degree: 1, coefficients: [3, 5], index: 1 }
      expect(parsed).toEqual(expected)
    })
    test('degree 2', () => {
      const s: S = ['root-obj', ['+', ['*', '3', ['^', 'x', '2']], ['*', '5', 'x'], '4'], '1']
      const ps: S = ['root-obj', poly_s([3, 5, 4]), '1']
      expect(ps).toEqual(s)
      const parsed = parse_to_assignment(s)
      const expected: ModelAssignmentOutput = { tag: 'generic-root-obj', degree: 2, coefficients: [3, 5, 4], index: 1 }
      expect(parsed).toEqual(expected)
    })
    test('degree 3', () => {
      const s: S = ['root-obj', ['+', ['*', '3', ['^', 'x', '3']], ['*', '5', ['^', 'x', '2']], ['*', '4', 'x'], '1'], '3']
      const ps: S = ['root-obj', poly_s([3, 5, 4, 1]), '3']
      expect(ps).toEqual(s)
      const parsed = parse_to_assignment(s)
      const expected: ModelAssignmentOutput = { tag: 'generic-root-obj', degree: 3, coefficients: [3, 5, 4, 1], index: 3 }
      expect(parsed).toEqual(expected)
    })
    test('degree 11', () => {
      // z3 is not guarunteed to explicitly include the coefficient when it's equal to 1 as far as I know, so I
      // need to handle the case where it's implicit.
      const s: S = ['root-obj', ['+', ['*', '3', ['^', 'x', '11']], ['*', '5', ['^', 'x', '10']], ['*', '4', ['^', 'x', '9']], ['*', '1', ['^', 'x', '8']], ['*', '5', ['^', 'x', '7']], ['*', '8', ['^', 'x', '6']], ['*', '19', ['^', 'x', '5']], ['*', '31', ['^', 'x', '4']], ['*', '9', ['^', 'x', '3']], ['*', '7', ['^', 'x', '2']], ['*', '2', 'x'], '89'], '8']
      // const ps: S = ['root-obj', poly([3, 5, 4, 1, 5, 8, 19, 31, 9, 7, 2, 89]), '8']
      // expect(ps).toEqual(s)
      const parsed = parse_to_assignment(s)
      const expected: ModelAssignmentOutput = { tag: 'generic-root-obj', degree: 11, coefficients: [3, 5, 4, 1, 5, 8, 19, 31, 9, 7, 2, 89], index: 8 }
      expect(parsed).toEqual(expected)
    })
    test('degree 11 leave 1s implicit', () => {
      // z3 is not guarunteed to explicitly include the coefficient when it's equal to 1 as far as I know, so I
      // need to handle the case where it's implicit.
      const s: S = ['root-obj', ['+', ['*', '3', ['^', 'x', '11']], ['*', '5', ['^', 'x', '10']], ['*', '4', ['^', 'x', '9']], ['^', 'x', '8'], ['*', '5', ['^', 'x', '7']], ['*', '8', ['^', 'x', '6']], ['*', '19', ['^', 'x', '5']], ['*', '31', ['^', 'x', '4']], ['*', '9', ['^', 'x', '3']], ['*', '7', ['^', 'x', '2']], ['*', '2', 'x'], '89'], '8']
      const ps: S = ['root-obj', poly_s([3, 5, 4, 1, 5, 8, 19, 31, 9, 7, 2, 89]), '8']
      expect(ps).toEqual(s)
      const parsed = parse_to_assignment(s)
      const expected: ModelAssignmentOutput = { tag: 'generic-root-obj', degree: 11, coefficients: [3, 5, 4, 1, 5, 8, 19, 31, 9, 7, 2, 89], index: 8 }
      expect(parsed).toEqual(expected)
    })
    test('badly ordered terms', () => {
      const s: S = ['root-obj', ['+', '1', ['^', 'x', '2']], '1']
      // const parsed = parse_to_assignment(s)
      // expect(parsed).toEqual(true)
      expect(() => parse_to_assignment(s)).toThrow()
    })
    test('mostly zeroes', () => {
      const s: S = ['root-obj', ['+', ['^', 'x', '2'], '1'], '1']
      const parsed = parse_to_assignment(s)
      const expected: ModelAssignmentOutput = { tag: 'generic-root-obj', degree: 2, coefficients: [1, 0, 1], index: 1 }
      expect(parsed).toEqual(expected)
    })
    test('degree 11 with some zeroes', () => {
      const s: S = ['root-obj', ['+', ['*', '3', ['^', 'x', '11']], ['*', '5', ['^', 'x', '10']], ['*', '4', ['^', 'x', '9']], ['^', 'x', '8'], ['*', '5', ['^', 'x', '7']], ['*', '8', ['^', 'x', '6']], ['*', '31', ['^', 'x', '4']], ['*', '9', ['^', 'x', '3']], ['*', '2', 'x'], '89'], '8']
      const ps: S = ['root-obj', poly_s([3, 5, 4, 1, 5, 8, 0, 31, 9, 0, 2, 89]), '8']
      expect(ps).toEqual(s)
      const parsed = parse_to_assignment(s)
      const expected: ModelAssignmentOutput = { tag: 'generic-root-obj', degree: 11, coefficients: [3, 5, 4, 1, 5, 8, 0, 31, 9, 0, 2, 89], index: 8 }
      expect(parsed).toEqual(expected)
    })
    test('with negative coefficients', () => {
      const s: S = ['root-obj', ['+', ['*', ['-', '3'], ['^', 'x', '3']], ['*', '5', ['^', 'x', '2']], ['*', ['-', '4'], 'x'], ['-', '1']], '3']
      const ps: S = ['root-obj', poly_s([-3, 5, -4, -1]), '3']
      expect(ps).toEqual(s)
      const parsed = parse_to_assignment(s)
      const expected: ModelAssignmentOutput = { tag: 'generic-root-obj', degree: 3, coefficients: [-3, 5, -4, -1], index: 3 }
      expect(parsed).toEqual(expected)
    })
    test('implicit 1 with no exp (so just \'x\')', () => {
      const s: S = ['root-obj', ['+', ['^', 'x', '2'], 'x', '1'], '1']
      const parsed = parse_to_assignment(s)
      const expected: ModelAssignmentOutput = { tag: 'generic-root-obj', degree: 2, coefficients: [1, 1, 1], index: 1 }
      expect(parsed).toEqual(expected)
    })
    test('implicit -1 with no exp (so just \'x\')', () => {
      const s: S = ['root-obj', ['+', ['^', 'x', '2'], ['-', 'x'], '1'], '1']
      const parsed = parse_to_assignment(s)
      const expected: ModelAssignmentOutput = { tag: 'generic-root-obj', degree: 2, coefficients: [1, -1, 1], index: 1 }
      expect(parsed).toEqual(expected)
    })
    test('implicit -1 with exp (like \'-x^2\')', () => {
      const s: S = ['root-obj', ['+', ['-', ['^', 'x', '2']], 'x', '1'], '1']
      const parsed = parse_to_assignment(s)
      const expected: ModelAssignmentOutput = { tag: 'generic-root-obj', degree: 2, coefficients: [-1, 1, 1], index: 1 }
      expect(parsed).toEqual(expected)
    })
  })
})

import { init_z3, parse_smtlib2_expr } from './z3_integration'
import { assert_result, map_record } from './utils'
import { assert_parse_constraint, assert_parse_real_expr } from './parser'
import { PrSat } from './types'
import { TruthTable, variables_in_constraints } from './pr_sat'

describe('parse and evaluate', () => {
  test('sanity check', async () => {
    const { Context } = await init_z3()
    const ctx = Context('main')
    const solver = new ctx.Solver()

    const input = `
  (set-logic QF_NRA)
  (declare-const s_0 Real)
  (declare-const s_1 Real)
  (assert (= s_0 2))
  (assert (= s_1 2.5))
  (check-sat)`

    solver.fromString(input)

    const result = await solver.check()
    expect(result).toEqual('sat')
    const model = solver.model()
    
    const expr = assert_result(parse_smtlib2_expr(ctx, ['s_0', 's_1'], '(+ s_0 s_1)'))
    expect(model.eval(expr).sexpr()).toEqual('(/ 9.0 2.0)')

    const bool = assert_result(parse_smtlib2_expr(ctx, ['s_0', 's_1'], '(= s_0 s_1)'))
    // console.log(ctx.isBool(bool))
    // if (!ctx.isBool(bool)) {
    //   throw new Error('not bool!')
    // }
    expect(model.eval(bool).sexpr()).toEqual('0')
  })
  test('evaluate from simpson\'t paradox', async () => {
    const constraints: Constraint[] = [
      assert_parse_constraint('Pr(X | Y & Z) > Pr(X | Z)'),
      assert_parse_constraint('Pr(X | Y & -Z) > Pr(X | -Z)'),
      assert_parse_constraint('Pr(X | Y) < Pr(X)'),
      assert_parse_constraint('Pr(X) = 1/2'),
      assert_parse_constraint('Pr(Y) = 1/2'),
    ]
    const tt = new TruthTable(variables_in_constraints(constraints))
    const stage = pr_sat_staged(new WrappedSolver(await init_z3(), init_z3), tt, constraints)
    const result = await stage.go()
    if (result.status !== 'sat') {
      throw new Error(`Expected sat but not sat!\nactual: ${result.status}\n${result.status === 'exception' ? `message: ${result.message}` : ''}`)
    }

    // console.log(map_record(result.state_assignments, (_, v) => model_assignment_output_to_string(v)))

    // These checks should really be done after every call to stuff but its fine for now!
    for (const c of constraints) {
      const evald = await result.evaluate(tt, { tag: 'constraint', constraint: c })
      expect(evald).toEqual({ tag: 'bool-result', result: true })
    }
  })

  test('evaluate from all zeroes', async () => {
    const constraints: Constraint[] = [
      assert_parse_constraint('Pr(X & Y) = 0'),
      assert_parse_constraint('Pr(X & -Y) = 0'),
      assert_parse_constraint('Pr(-X & Y) = 0'),
      assert_parse_constraint('Pr(-X & -Y) = 1'),
    ]

    const tt = new TruthTable(variables_in_constraints(constraints))
    const stage = pr_sat_staged(new WrappedSolver(await init_z3(), init_z3), tt, constraints)
    const result = await stage.go()
    if (result.status !== 'sat') {
      throw new Error(`Expected sat but not sat!\nactual: ${result.status}\n${result.status === 'exception' ? `message: ${result.message}` : ''}`)
    }

    // div0
    const evald1 = await result.evaluate(tt, { tag: 'real_expr', real_expr: assert_parse_real_expr('1 / Pr(X & Y)') })
    expect(evald1.tag).toEqual('div0')

    // unknown sentence variables
    const evald2 = await result.evaluate(tt, { tag: 'real_expr', real_expr: assert_parse_real_expr('Pr(W & Z)') })
    expect(evald2).toEqual({ tag: 'undeclared-vars', variables: { real: [], sentence: [{ tag: 'letter', id: 'W', index: 0 }, { tag: 'letter', id: 'Z', index: 0 }] } })

    // unknown real variables and sentence variables
    const evald3 = await result.evaluate(tt, { tag: 'real_expr', real_expr: assert_parse_real_expr('a + b') })
    expect(evald3).toEqual({ tag: 'undeclared-vars', variables: { real: ['a', 'b'], sentence: [] } })

    // unknown real variables and sentence variables
    const evald4 = await result.evaluate(tt, { tag: 'real_expr', real_expr: assert_parse_real_expr('(a + b) / Pr(W & Z)') })
    expect(evald4).toEqual({ tag: 'undeclared-vars', variables: { real: ['a', 'b'], sentence: [{ tag: 'letter', id: 'W', index: 0 }, { tag: 'letter', id: 'Z', index: 0 }] } })
  })
})
