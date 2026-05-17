import { TypstGenerator } from './src/lib/engine/generator/index';
import {
  MULTI_INVOICE_SAMPLE_DATA,
  MULTI_INVOICE_TEMPLATE,
} from './src/lib/templates/multi-invoice';

const generator = new TypstGenerator();
const output = generator.generate(MULTI_INVOICE_TEMPLATE, MULTI_INVOICE_SAMPLE_DATA);
console.log(output);
