import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const file = 'scripts/extract-user.mjs';
let code = fs.readFileSync(file, 'utf8');
const before = `for (const specifier of dependencySpecifiers(code)) {\n    const resolved = resolveLocal(rel, specifier);\n    if (!resolved || resolved === 'ui/user-ui.js') continue;`;
const after = `for (const specifier of dependencySpecifiers(code)) {\n    const virtual = posix(path.posix.normalize(path.posix.join(path.posix.dirname(rel), specifier)));\n    if (virtual === 'ui/user-ui.js') continue;\n    const resolved = resolveLocal(rel, specifier);\n    if (!resolved) continue;`;
const matches = code.split(before).length - 1;
if (matches !== 2) throw new Error(`Expected 2 dependency loops to patch, found ${matches}`);
code = code.replaceAll(before, after);
fs.writeFileSync(file, code);

const result = spawnSync(process.execPath, [file, process.argv[2] || '/tmp/co-va-core'], { stdio: 'inherit' });
process.exit(result.status ?? 1);
