import { MULTI_INVOICE_TEMPLATE, MULTI_INVOICE_SAMPLE_DATA } from './src/lib/templates/multi-invoice';
import { TypstGenerator } from './src/lib/engine/generator/index';

const generator = new TypstGenerator();
const output = generator.generate(MULTI_INVOICE_TEMPLATE, MULTI_INVOICE_SAMPLE_DATA);
console.log(output);
