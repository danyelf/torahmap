// Put dumped data into a mockup page. Usage: node build.mjs <template.html> <data.json> <out.html>
import { readFileSync, writeFileSync } from 'node:fs';

const [template, data, out] = process.argv.slice(2);
writeFileSync(out, readFileSync(template, 'utf8').replace('__DATA__', readFileSync(data, 'utf8')));
