import { PrSat } from '../types'
import { parse_constraint } from '../parser'
import { constraint_to_string } from '../pr_sat'
import { assert_exists } from '../utils'

type Constraint = PrSat['Constraint']

export type ConstraintsFile<C extends string | Constraint = Constraint> = {
  constraint_set_blocks: ConstraintSetBlock<C>[]
}

export type ConstraintSetResultStatus =
  // | { tag: 'sat', model: Record<number, ModelAssignmentOutput> }
  | { tag: 'sat', model: Record<number, ModelEntry> }
  | { tag: 'unsat' }
  | { tag: 'unknown' }
  | { tag: 'exception', message: string }
  | { tag: 'cancelled' }

export type ConstraintSetResult = {
  status: ConstraintSetResultStatus
  ms: number
  original: {
    constraints: string[]
    smtlib: string[]
  },
  optimized: {
    constraints: string[]
    smtlib: string[]
  },
}

type ConstraintSetBlock<C extends string | Constraint = Constraint> = {
  description: string[]
  constraint_sets: ConstraintSet<C>[]
}

type GoodConstraintList<C extends string | Constraint = Constraint> = {
  tag: 'good',
  constraints: C[]
}

type BadConstraintList<C extends string | Constraint = Constraint> = {
  tag: 'bad',
  keep: boolean,  // treat this as a good constraint set after removing errors.
  constraints: ({ tag: 'constraint', constraint: C } | { tag: 'error', error: string, line: string })[]
}

type ConstraintSet<C extends string | Constraint> = {
  continued_from_last: boolean
  regular: 'yes' | 'no' | 'both'
  timeout_ms?: number,
  constraints: BadConstraintList<C> | GoodConstraintList<C>
  result?: ConstraintSetResult
}

export const parse_constraints_file = (text: string): ConstraintsFile => {
  const lines = text.split('\n').map((l) => l.trim())
  
  let current_index = 0
  const current = () => assert_exists(lines[current_index], `Current index ${current_index} is past the number of lines, ${lines.length}.`)

  const file: ConstraintsFile = { constraint_set_blocks: [] }

  let n_loops = 0
  const LOOP_LIMIT = 100_000
  while (current_index < lines.length) {
    let comment_block: string[] = []

    while (current_index < lines.length) {
      // Weird that we're throwing away the intermediate comments but its fine.
      if (current() === '') comment_block = []
      while (current_index < lines.length && current() === '') current_index++
      if (current_index >= lines.length) break

      if (current()[0] !== '%') break
      while (current_index <= lines.length && current()[0] === '%') {
        comment_block.push(current().substring(1).trim())
        current_index++
      }
      if (current_index >= lines.length) break
    }

    const block: ConstraintSetBlock = { description: comment_block, constraint_sets: [] }
    while (current_index < lines.length && current()[0] !== '%') {
      let is_bad_list = false
      const bad_list: BadConstraintList = { tag: 'bad', keep: false, constraints: [] }
      const good_list: GoodConstraintList = { tag: 'good', constraints: [] }

      while (current_index < lines.length && current() !== '' && current()[0] !== '%') {
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

      if (current_index >= lines.length) break
      if (current()[0] === '%' && bad_list.constraints.length === 0) break

      if (is_bad_list) {
        block.constraint_sets.push({
          continued_from_last: false,
          regular: 'no',
          constraints: bad_list,
        })
      } else {
        block.constraint_sets.push({
          continued_from_last: false,
          regular: 'no',
          constraints: good_list,
        })
      }

      while (current_index < lines.length && current() === '') current_index++
      if (current_index >= lines.length) break
    }

    if (block.constraint_sets.length !== 0) {
      file.constraint_set_blocks.push(block)
    }

    n_loops++
    if (n_loops > LOOP_LIMIT) throw new Error('parse_constraints_file_2: LOOP_LIMIT reached')
  }

  return file
}

export const constraints_file_to_string = (file: ConstraintsFile): string => {
  const lines: string[] = []

  for (const block of file.constraint_set_blocks) {
    lines.push(...block.description)
    for (const set of block.constraint_sets) {
      if (set.constraints.tag === 'bad') {
        lines.push('BAD:')
        for (const c of set.constraints.constraints) {
          if ('error' in c) {
            lines.push(`error: "${c.line}", ${c.error}`)
          } else {
            lines.push(constraint_to_string(c.constraint))
          }
        }
      } else {
        lines.push('GOOD:')
        for (const c of set.constraints.constraints) {
          lines.push(`  ${constraint_to_string(c)}`)
        }
      }
      lines.push('')
    }
  }

  return lines.join('\n')
}

export const constraints_file_to_partially_parsed_file = (file: ConstraintsFile<Constraint>): ConstraintsFile<string> => {
  const set_blocks: ConstraintSetBlock<string>[] =[]
  for (const block of file.constraint_set_blocks) {
    const partial_sets: ConstraintSet<string>[] = []
    for (const set of block.constraint_sets) {
      if (set.constraints.tag === 'bad') {
        const constraints: BadConstraintList<string> = { tag: 'bad', keep: set.constraints.keep, constraints: [] }
        for (const c of set.constraints.constraints) {
          if (c.tag === 'constraint') {
            constraints.constraints.push({ tag: 'constraint', constraint: constraint_to_string(c.constraint) })
          } else {
            constraints.constraints.push(c)
          }
        }
        partial_sets.push({
          continued_from_last: set.continued_from_last,
          regular: 'no',
          constraints: constraints,
        })
      } else {
        const constraints: GoodConstraintList<string> = { tag: 'good', constraints: [] }
        for (const c of set.constraints.constraints) {
          constraints.constraints.push(constraint_to_string(c))
        }
        partial_sets.push({
          continued_from_last: set.continued_from_last,
          regular: 'no',
          constraints: constraints,
        })
      }
    }
    set_blocks.push({ description: block.description, constraint_sets: partial_sets })
  }
  return { constraint_set_blocks: set_blocks }
}

// What happens if two sets in a row set "continued_from_last: true"?
// There will be the same number of sets to run in total.
// If we have a fully-specified constraint set followed by n constraint_sets with "continued_from_last: true",
//   we'd have n + 1 constraint sets (zero-indexed, so indices range from 0 to n).
// Index 0 would be the fully-specified set.
// Then for all constraint sets at index i > 0, fqcs[i] = [...fqcs[i - 1], cs[i]],
//   where fqcs[j] is the fully-qualified constraint set for the under-qualified constraint set cs[j].
// cs[0] = fqcs[0].

const good_constraints_from_bad = (bad: BadConstraintList<string>): string[] => {
  const the_goods: string[] = []
  for (const ce of bad.constraints) {
    if (ce.tag === 'constraint') {
      the_goods.push(ce.constraint)
    }
  }
  return the_goods
}

// We use a partially parsed file because thats where all of our config stuff goes.
type ToYeet = { index?: number, description: string[], regular: boolean, timeout_ms?: number, constraints: string[], set: ConstraintSet<string> }
export const generate_constraint_sets = function* (partially_parsed_file: ConstraintsFile<string>): Generator<ToYeet> {
  let last_full_set: undefined | ToYeet = undefined
  for (const block of partially_parsed_file.constraint_set_blocks) {
    for (const [index, set] of block.constraint_sets.entries()) {
      if (set.constraints.tag === 'bad' && !set.constraints.keep) {
        continue
      } else {
        const cs = set.constraints.tag === 'bad' ? good_constraints_from_bad(set.constraints) : set.constraints.constraints
        const inherited_part = last_full_set === undefined || !set.continued_from_last ? [] : [...last_full_set.constraints]
        const inherited_desc = last_full_set === undefined || !set.continued_from_last ? [] : last_full_set.description
        // What if we inherit a yes but it's a no?  that would be odd.
        // You know what for now you can't inherit regularity.
        // It might be helpful but I don't know where it would be so no thank you for now.
        const constraints = [...inherited_part, ...cs]
        const full_desc = [...inherited_desc, ...block.description]

        const full_set: ToYeet = {
          index: block.constraint_sets.length === 0 ? undefined : index,
          regular: set.regular === 'yes',
          timeout_ms: set.timeout_ms,
          description: full_desc,
          constraints,
          set
        }
        yield full_set
        if (set.regular === 'both') yield { ...full_set, regular: true }
        last_full_set = full_set
      }
    }
  }
}

const LIB_REL_FILE_PATH = 'stuff'
import * as fs from 'node:fs/promises'
import { ModelEntry } from '../solver'

export const save_constraints_file = async (file: ConstraintsFile<string>, to_path: string): Promise<void> => {
  const text = `
import { ConstraintsFile } from '../${LIB_REL_FILE_PATH}'

const file: ConstraintsFile<string> = ${JSON.stringify(file, null, 2)}
export default file
  `.trim()

  await fs.writeFile(to_path, text)
}
