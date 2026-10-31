import fs from 'node:fs';
import path from 'node:path';

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === '.git' || entry.name === 'node_modules') return [];
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

let found = 0;
for (const file of walk(process.cwd()).filter((item) => item.endsWith('.js'))) {
  const code = fs.readFileSync(file, 'utf8');
  const lines = code.split('\n');
  lines.forEach((line, index) => {
    if (!line.includes('finance')) return;
    found += 1;
    console.log(`${path.relative(process.cwd(), file)}:${index + 1}: ${line.trim()}`);
  });
}
console.log(`Finance references found: ${found}`);
