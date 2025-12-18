import { assert_parse_constraint } from '../parser'
import { constraint_to_smtlib, state_index_id, TruthTable } from '../pr_sat'
import { WrappedSolver, init_z3, input_constraints_to_string } from '../z3_integration'
import { ConstraintSetResult, ConstraintSetResultStatus, ConstraintsFile, generate_constraint_sets, save_constraints_file } from './stuff'
import { PrSat } from '../types'
import { S, s_to_string } from '../s'
import { assert } from '../utils'
import { wrapping_slice } from '../wrapping_slice'

type Constraint = PrSat['Constraint']

// const wrapped_solver_result_to_constraint_set_result_status = (solver_result: WrappedSolverResult): ConstraintSetResultStatus => {
//   if (solver_result.status === 'sat') {
//     return { tag: 'sat', model: solver_result.state_assignments }
//   } else if (solver_result.status === 'exception') {
//     return { tag: 'exception', message: solver_result.message }
//   } else {
//     return { tag: solver_result.status }
//   }
// }

const solver_result_to_constraint_set_result_status = (solver_result: SolverResult): ConstraintSetResultStatus => {
  const [status, data] = solver_result
  if (status === 'sat') {
    return { tag: 'sat', model: data.model }
  } else if (status === 'exception') {
    return { tag: 'exception', message: data.message }
  } else {
    return { tag: status }
  }
}

const to_comparing_smtlib = (tt: TruthTable, original: Constraint[], optimized: Constraint[]): S[] => {
  const smtlib_lines: S[] = []

  for (const rv of tt.variables.real.entries()) {
    const declaration = ['declare-const', rv, 'Real']
    smtlib_lines.push(declaration)
  }

  for (const state_index of tt.state_indices()) {
    const declaration = ['declare-const', state_index_id(state_index), 'Real']
    smtlib_lines.push(declaration)
  }

  const original_assertions: S[] = ['and']
  for (const c of original) {
    const smtlib = constraint_to_smtlib(c)
    original_assertions.push(smtlib)
  }

  const optimized_assertions: S[] = ['and']
  for (const c of optimized) {
    const smtlib = constraint_to_smtlib(c)
    optimized_assertions.push(smtlib)
  }

  smtlib_lines.push(['assert', ['not', ['=', original_assertions, optimized_assertions]]])
  return smtlib_lines
}

import * as readline from 'node:readline'
import * as path from 'node:path'
import { SolverResult, SolverStateMachine } from '../solver'
import { BaseSolver } from '../solver/basic'
import { WebWorkerSolver } from '../solver/ww-solver'

const COLOR = {
  red: '[31m',
  green: '[32m',
  yellow: '[33m',
}

const color = (code: string, text: string): string => `\x1b${code}${text}\x1b[0m`

// Mutating partially_parsed_file and storing it someplace.
export const run_file = async (partially_parsed_file: ConstraintsFile<string>, should_solve: boolean, offset: number = 0, first_n: number | undefined = undefined) => {
  assert(first_n === undefined || (Number.isInteger(first_n) && first_n > 0))
  const constraint_sets = wrapping_slice([...generate_constraint_sets(partially_parsed_file)], offset)
  const max_count = first_n ?? constraint_sets.length
  const max_index_digits = Math.ceil(Math.log10(max_count))
  let failures = 0

  console.log('(absolute_index) (successes/seen/total)')

  const status = (index: number, message: string) => {
    const successes = index + 1 - failures
    const actual_index = offset + index
    const actual_index_string = `(${actual_index})`.padEnd(max_index_digits + 2, ' ')
    const status_string = `(${successes}/${index + 1}/${max_count})`.padEnd(max_index_digits * 3 + 4, ' ')
    return `${actual_index_string} ${status_string} ${message}`
  }

  const solver = new BaseSolver()
  // const solver = new WebWorkerSolver()
  const machine = new SolverStateMachine(solver)
  await machine.as('uninitialized').initialize()

  const z3_solver = new WrappedSolver(await init_z3(), init_z3)

  for (const [index, { description, constraints, regular, timeout_ms, set }] of constraint_sets.entries()) {
    if (index >= max_count) break

    const d = description
    const c = constraints.map(assert_parse_constraint)

    // const abort_controller = new AbortController()
    // setTimeout(() => abort_controller.abort(), timeout_ms ?? 5 * 60 * 1000)

    // const tt = new TruthTable(variables_in_constraints(c))
    // const solver = new WrappedSolver(await init_z3(), init_z3)

    // const stage = pr_sat_staged(solver, tt, c, { regular, abort_signal: abort_controller.signal })

    await machine.as('initialized', 'invalidated').start(c, regular)
    const stage_data = machine.as('staged').data

    //////////
    if (should_solve) {
      readline.clearLine(process.stdout, 0)
      readline.cursorTo(process.stdout, 0)
      // process.stdout.write(`(successes/seen/total) (${successes}/${actual_index + 1}/${max_count}) working...`)
      process.stdout.write(status(index, 'working...'))
      machine.as('staged').go()
      const start = performance.now()
      // const solver_output = await stage.go()
      const solver_output = await machine.as('solving').solver.wait()
      machine.as('finished').invalidate()
      const elapsed_ms = performance.now() - start

      const constraints_set_result: ConstraintSetResult = {
        ms: elapsed_ms,
        // status: wrapped_solver_result_to_constraint_set_result_status(solver_output),
        status: solver_result_to_constraint_set_result_status(solver_output),
        original: input_constraints_to_string({ constraints: stage_data.constraints.original.internal, smtlib: stage_data.constraints.original.smtlib }),
        optimized: input_constraints_to_string({ constraints: stage_data.constraints.optimized.internal, smtlib: stage_data.constraints.optimized.smtlib }),
      }
      set.result = constraints_set_result

      if (solver_output[0] === 'cancelled') {
        readline.clearLine(process.stdout, 0)
        readline.cursorTo(process.stdout, 0)
        // console.log(`(successes/seen/total) (${successes}/${actual_index + 1}/${max_count}) ${color(COLOR.yellow, 'UNSOLVED')}.`)
        console.log(status(index, `${color(COLOR.yellow, 'UNSOLVED')}.`))
        console.log(`  ${d.join('\n  ')}`)
      }

      readline.clearLine(process.stdout, 0)
      readline.cursorTo(process.stdout, 0)
    } else {
      machine.as('staged').invalidate()
    }
    //////////

    // process.stdout.write(`(successes/seen/total) (${successes}/${actual_index + 1}/${max_count}) checking...`)
    process.stdout.write(status(index, 'checking...'))

    const comparing_smtlib = to_comparing_smtlib(stage_data.truth_table, stage_data.constraints.original.internal, stage_data.constraints.optimized.internal)
    const comparing_smtlib_string = comparing_smtlib.map((s) => s_to_string(s, false)).join('\n')

    const ac2 = new AbortController()
    // setTimeout(() => ac2.abort(), 3 * 60 * 1000)
    const comparing_result = await z3_solver.solve(comparing_smtlib_string, ac2.signal)

    if (comparing_result.status !== 'unsat') {
      failures++
      readline.clearLine(process.stdout, 0)
      readline.cursorTo(process.stdout, 0)
      const message = comparing_result.status === 'sat' ? color(COLOR.red, 'FAILURE') : comparing_result.status === 'cancelled' ? color(COLOR.yellow, 'UNVERIFIED') : '??'
      // console.log(`(successes/seen/total) (${successes}/${actual_index + 1}/${max_count}) ${message}.`)
      console.log(status(index, `${message}.`))
      console.log(`  ${d.join('\n  ')}`)
      // break
    } else {
      readline.clearLine(process.stdout, 0)
      readline.cursorTo(process.stdout, 0)
      // process.stdout.write(`(successes/seen/total) (${successes}/${actual_index + 1}/${max_count}) ${color(COLOR.green, 'SUCCESS')}!`)
      // process.stdout.write(status(index, `${color(COLOR.green, 'SUCCESS')}!`))
      console.log(status(index, `${color(COLOR.green, 'SUCCESS')}!`))
    }
  }

  readline.clearLine(process.stdout, 0)
  readline.cursorTo(process.stdout, 0)

  return partially_parsed_file
}

const relp = './outputs/probability_table_generator_inputs_2.ts'
const absp = path.join(__dirname, relp)

await (async () => {
  const file: ConstraintsFile<string> = await import(absp).then((i) => i.default)
  // Problems indices: 20, 23
  await run_file(file, false, 0, 1)
  process.stdout.write('Saving results... ')
  await save_constraints_file(file, absp)
  console.log('saved!')
  process.exit()
})()
