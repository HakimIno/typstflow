import { readFileSync, writeFileSync } from 'node:fs';
import { TypstGenerator } from '../../src/lib/engine/generator';

const schema = JSON.parse(
  readFileSync('./examples/json/unliquidated-cash-advances.json', 'utf8')
);
const data = {
  items: [
    {
      fund: 'General Fund',
      debtor: 'John Doe',
      balance: 15000.0,
      date: '2019-01-15',
      purpose: 'Travel expenses',
      current_30: 15000.0,
      current_90: 0.0,
      current_365: 0.0,
      past_1y: 0.0,
      past_2y: 0.0,
      past_3y: 0.0,
      remarks: 'Pending liquidation',
    },
  ],
};

const generator = new TypstGenerator();
const output = generator.generate(schema, data);
writeFileSync('./examples/output/scratch-output.typ', output, 'utf8');
console.log('Typst markup generated successfully at examples/output/scratch-output.typ');
