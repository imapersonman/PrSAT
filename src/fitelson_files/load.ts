import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { constraints_file_to_partially_parsed_file, parse_constraints_file, save_constraints_file } from './stuff'


const p = path.join(__dirname, 'inputs', 'probability_table_generator_inputs_2.txt')
const text = (await fs.readFile(p)).toString()
const file = parse_constraints_file(text)
const partially_parsed_file = constraints_file_to_partially_parsed_file(file)

const output_path = path.join(__dirname, 'outputs', 'probability_table_generator_inputs_2.ts')
await save_constraints_file(partially_parsed_file, output_path)
