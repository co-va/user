import fs from 'node:fs';
import path from 'node:path';

const sourceRoot = path.resolve(process.argv[2] || '/tmp/co-va-core');
const shellFile = path.join(sourceRoot, 'online-booking/account-shell.js');
let shell = fs.readFileSync(shellFile, 'utf8');

function replaceRequired(before, after, label) {
  if (!shell.includes(before)) throw new Error(`Expected ${label} import was not found`);
  shell = shell.replace(before, after);
}

replaceRequired(
  "import { projectRecordStatuses } from '../core/record/index.js';",
  "import { projectRecordStatuses } from '../core/record/state.js';",
  'Record state',
);

replaceRequired(
`import {
  calculateInvestmentState,
  cashEntityCardAppearance,
  cashEntityCardFields,
  investmentRoleLabel,
  normalizeInvestmentTerms,
} from '../core/finance/index.js';`,
`import {
  calculateInvestmentState,
  investmentRoleLabel,
  normalizeInvestmentTerms,
} from './user-investment-calculator.js';
import {
  cashEntityCardAppearance,
  cashEntityCardFields,
} from './user-investment-card.js';`,
  'Finance projection',
);

replaceRequired(
  "import { personalAccountVisualCard } from '../core/loyalty/personal-account/index.js';",
  "import { personalAccountVisualCard } from './user-personal-account-card.js';",
  'personal account presentation',
);

replaceRequired(
  "import { renderJournal } from '../journal/journal.js';",
  "import { renderJournal } from './user-journal.js';",
  'User Journal',
);

fs.writeFileSync(shellFile, shell);

const templateRoot = path.resolve('scripts/templates');
for (const name of ['user-journal.js', 'user-personal-account-card.js']) {
  fs.copyFileSync(path.join(templateRoot, name), path.join(sourceRoot, 'online-booking', name));
}

fs.copyFileSync(
  path.join(sourceRoot, 'core/finance/cash/investment-calculator.js'),
  path.join(sourceRoot, 'online-booking/user-investment-calculator.js'),
);

let card = fs.readFileSync(path.join(sourceRoot, 'core/finance/cash/card-presentation.js'), 'utf8');
card = card
  .replace("from '../../../ui/ui.js'", "from '../ui/ui.js'")
  .replace("from '../../card-appearance-templates.js'", "from '../core/card-appearance-templates.js'");
fs.writeFileSync(path.join(sourceRoot, 'online-booking/user-investment-card.js'), card);

console.log('User shell isolation: prepared');
