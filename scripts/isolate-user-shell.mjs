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

// End User Messenger: remove the Professional-only half before dependency extraction.
const messengerFile = path.join(sourceRoot, 'core/chat/messenger-mode.js');
let messenger = fs.readFileSync(messengerFile, 'utf8');
messenger = messenger.replace("import { USER_ORIGIN } from '../environment.js';\n", '');
messenger = messenger.replace(/import \{[\s\S]*?\} from '\.\/internal-chat\.js';/, `import {
  endUserChatActions,
  getEndUserChatConversations,
  getEndUserChatThread,
  getEndUserChatThreads,
  sendEndUserChatMessage,
} from './internal-chat.js';`);
messenger = messenger.replace("import { findPeopleByPhone, getAllPeople } from '../people/data.js';\n", '');
messenger = messenger.replace(/const USER_HOST = new URL\(USER_ORIGIN\)\.hostname;\n/, '');
messenger = messenger.replace(/function isEndUserRuntime\(\) \{[\s\S]*?\n\}\n\n/, '');
messenger = messenger.replace(/function professionalThreadTitle\(thread = \{\}\) \{[\s\S]*?\n\}\n\nfunction endUserThreadTitle/, 'function endUserThreadTitle');
messenger = messenger.replace(/function personTitle\(person = \{\}\) \{[\s\S]*?\n\}\n\nfunction messageTime/, 'function messageTime');
messenger = messenger.replace(/async function openProfessionalThread\(mode, thread\) \{[\s\S]*?\n\}\n\nexport function openMessengerMode/, 'export function openMessengerMode');
messenger = messenger.replace(
  "  if (isEndUserRuntime()) void renderEndUserRoot(mode);\n  else void renderProfessionalRoot(mode, personKey);",
  '  void renderEndUserRoot(mode);',
);
messenger = messenger.replace(/\nif \(typeof window !== 'undefined'\) \{[\s\S]*?\n\}\s*$/, '\n');
fs.writeFileSync(messengerFile, messenger);

const internalChatFile = path.join(sourceRoot, 'core/chat/internal-chat.js');
let internalChat = fs.readFileSync(internalChatFile, 'utf8');
internalChat = internalChat.replace(/import \{[\s\S]*?\} from '\.\/messenger-api\.js';/, `import {
  deleteEndUserMessengerMessage,
  editEndUserMessengerMessage,
  forwardEndUserMessengerMessage,
  getEndUserMessengerConversations,
  getEndUserMessengerMessages,
  markEndUserMessengerConversationRead,
  pinEndUserMessengerMessage,
  reactEndUserMessengerMessage,
  searchEndUserMessenger,
  sendEndUserMessengerMessage,
  setEndUserMessengerConversationState,
  voteEndUserMessengerPoll,
} from './messenger-api.js';`);
internalChat = internalChat.replace(/export async function getProfessionalChatThreads\(\) \{[\s\S]*?\n\}\n\nexport async function getEndUserChatThreads/, 'export async function getEndUserChatThreads');
internalChat = internalChat.replace(/\nexport const professionalChatActions = \{[\s\S]*?\n\};\n/, '\n');
fs.writeFileSync(internalChatFile, internalChat);

console.log('User shell isolation: prepared');
