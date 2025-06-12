import { describe, test, expect } from 'vitest'
import { ModelAssignmentOutput, parse_to_assignment, poly_s } from './z3_integration'
import { S } from './s'
import { ConstraintOrRealExpr, PrSat } from './types'
import { TruthTable, VariableLists } from './pr_sat'
import { Res } from './utils'
import { Model } from 'z3-solver'

describe('parse_to_assignment', () => {
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
      // expect(() => parse_to_assignment(s)).toThrow()
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

describe('Z3Instance', () => {
})
