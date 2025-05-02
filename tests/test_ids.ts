export type TestIdGenerator = { prefix: string, gen: () => string, get: (index: number) => string }

const test_id_generator = (prefix: string): TestIdGenerator => {
  let current = 0
  return {
    prefix,
    gen: () => { console.log("ahsdladhjasldhualkjdn"); return `${prefix}-${current++}` },
    get: (index: number) => `${prefix}-${index}`,
  }
}

const readonly = <T extends {}>(t: T): Readonly<T> => {
  return t
}

export const z3_status = 'z3-status'
// export const single_input = test_id_generator('single-input')
export const find_model = 'find-model'
export const regular_toggle = 'regular-toggle'
export const model_table = 'model-table'

export const single_input = readonly({
  constraint: test_id_generator('single-input-constraint'),
  eval: test_id_generator('single-input-eval'),
  close: 'close',
  input: 'input',
  newline: 'newline',
})
