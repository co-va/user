import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve, sep, extname } from 'node:path';
import { chromium } from 'playwright';
import { button, copyIconButton, smallActionButton } from '../../ui/buttons/index.js';
import { repeatedField } from '../../ui/repeated-fields/index.js';
import { links } from '../../ui/links/index.js';
import { miniCard } from '../../ui/cards/mini-card.js';

const root = process.cwd();
const read = (file) => readFileSync(resolve(root, file), 'utf8');
const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>:root{--ui-control-height:48px;--ui-field-height:46px;--text:#111;--text-secondary:#777;--white:#fff;--border:#aaa;--danger:#ff1111;--button-secondary:#ddd;}</style>
<style>${read('ui/buttons/buttons.css')}</style>
<style>${read('ui/inputs/inputs.css')}</style>
<style>${read('ui/profile/profile.css')}</style>
<style>${read('ui/cards/mini-card.css')}</style>
<style>${read('ui/calendar/calendar.css')}</style>
</head><body class="v2-app"><div class="modal--profile-editor"><div class="profile-editor">
${repeatedField({ label:'Email', name:'extraEmail', values:[], type:'email', showEmptyRow:false, addInHeader:true })}
${repeatedField({ label:'Telegram', name:'extraTelegram', values:['@example'], showEmptyRow:false, addInHeader:true })}
${links({ label:'Ссылки', links:[{type:'Сайт', url:'https://example.org'}], name:'profileLinks', addInHeader:true })}
<div class="extras">${smallActionButton({ aria:'Информация' })}${copyIconButton({ data:'data-copy-test' })}${button('Сохранить')}</div>
</div></div>
<div id="compact-record-test">${miniCard({recordLayout:{
  headerMode:'person', identity:'Бьюти тория', moment:'13.11.26',
  rightAction:{label:'↻',data:'data-record-repeat',aria:'Повторить запись'},
  leftAction:{label:'⚙',icon:'settings',variant:'secondary',data:'data-record-settings',aria:'Настройки записи'},
  services:[{value:'Стрижка',rightValue:'2000 ₽'}],duration:'1 ч',total:'2000 ₽'
}})}</div>
<div id="compact-card-test">${miniCard({title:'История',interactive:true,data:'data-card-open',compactAction:{
  label:'↻',data:'data-card-repeat',aria:'Повторить запись'
}})}</div>
<div id="compact-day-nav"></div><div id="compact-month-nav"></div>
<script type="module">
import { initRepeatedFields } from '/ui/repeated-fields/index.js';
import { initLinks } from '/ui/links/index.js';
import { initDateNavigator, initCalendar } from '/ui/calendar/calendar.js';
initRepeatedFields(document);
initLinks(document);
const day = initDateNavigator(document.querySelector('#compact-day-nav'),{
  date:new Date(2026,10,13),
  onChange: value => {window.__dayChange=[value.getFullYear(),value.getMonth()+1,value.getDate()].join('-');},
});
const month = initCalendar(document.querySelector('#compact-month-nav'),{
  month:new Date(2026,10,1),
  onMonthChange: value => {window.__monthChange=[value.getFullYear(),value.getMonth()+1].join('-');},
});
document.querySelector('[data-record-repeat]').addEventListener('click',()=>{window.__recordClicks=(window.__recordClicks||0)+1;});
document.querySelector('[data-record-settings]').addEventListener('click',()=>{window.__settingsClicks=(window.__settingsClicks||0)+1;});
document.querySelector('[data-card-repeat]').addEventListener('click',()=>{window.__repeatClicks=(window.__repeatClicks||0)+1;});
document.querySelector('[data-card-open]').addEventListener('click',()=>{window.__openClicks=(window.__openClicks||0)+1;});
window.__compactReady = true;
</script></body></html>`;

const server = createServer((req, res) => {
  const pathname = new URL(req.url || '/', 'http://localhost').pathname;
  if (pathname === '/') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(html);
    return;
  }
  const file = resolve(root, '.' + decodeURIComponent(pathname));
  if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  try {
    res.setHeader('Content-Type', extname(file) === '.js' ? 'text/javascript; charset=utf-8' : 'text/plain');
    res.end(readFileSync(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
let browser;
try {
  browser = await chromium.launch({ headless:true });
  const page = await browser.newPage({ viewport:{width:390,height:844} });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => window.__compactReady === true);

  const measure = async selector => page.locator(selector).first().evaluate(node => {
    const box = node.getBoundingClientRect();
    const css = getComputedStyle(node);
    return { width:box.width, height:box.height, bg:css.backgroundColor, border:css.borderTopWidth };
  });
  const add = await measure('[data-repeated-add="extraEmail"]');
  assert.equal(add.width, 28, 'Compact plus width must be 28px');
  assert.equal(add.height, 28, 'Compact plus height must be 28px');
  assert.equal(add.bg, 'rgba(0, 0, 0, 0)', 'Compact plus background must be invisible');
  assert.equal(add.border, '0px', 'Compact plus must not have a large-button border');

  const cross = await measure('[data-repeated-remove]');
  assert.equal(cross.width, 28, 'Compact cross must match the universal 28px width');
  assert.equal(cross.height, 28, 'Compact cross must match the universal 28px height');
  assert.equal(cross.bg, 'rgba(0, 0, 0, 0)', 'Compact cross background must be invisible');
  assert.equal(cross.border, '0px', 'Compact cross must not have a large-button border');

  const info = await measure('[aria-label="Информация"]');
  assert.equal(info.width, 28, 'Compact info must have the universal 28px width');
  assert.equal(info.height, 28, 'Compact info must have the universal 28px height');
  assert.equal(info.border, '0px', 'Compact info must have the same invisible border as + and ×');
  assert.equal(info.bg, 'rgba(0, 0, 0, 0)', 'Compact info background must be invisible');
  const copy = await measure('[data-copy-test]');
  assert.equal(copy.width, 28, 'Compact copy must have the universal 28px width');
  assert.equal(copy.height, 28, 'Compact copy must have the universal 28px height');
  assert.equal(copy.border, '0px', 'Compact copy must have the same invisible border');
  assert.equal(copy.bg, 'rgba(0, 0, 0, 0)', 'Compact copy background must be invisible');

  const oneCompactClass = await page.locator('.ui-compact-control').evaluateAll(nodes =>
    nodes.every(node => [...node.classList].every(name => !name.startsWith('ui-compact-control--'))));
  assert.ok(oneCompactClass, 'No icon may change the Compact geometry via variant CSS class');
  const crossColor = await page.locator('[data-repeated-remove] .ui-compact-control__remove').first()
    .evaluate(node => getComputedStyle(node).color);
  assert.equal(crossColor, 'rgb(255, 17, 17)', 'Delete icon retains the red semantic color');
  await page.locator('[data-copy-test]').evaluate(node => node.classList.add('is-copied'));
  const doneOpacity = await page.locator('[data-copy-test] [data-compact-copy-done]')
    .evaluate(node => getComputedStyle(node).opacity);
  assert.equal(doneOpacity, '1', 'Copy completion feedback must still be visible');

  // 28px is the button itself, while ::before gives it a 44px tap zone.
  for (const selector of ['[data-record-repeat]','[data-record-settings]',
    '[data-card-repeat]','[data-date-navigator-prev]','[data-date-navigator-next]',
    '[data-calendar-prev]','[data-calendar-next]']) {
    const box = await measure(selector);
    assert.equal(box.width, 28, selector + ': one Compact width');
    assert.equal(box.height, 28, selector + ': one Compact height');
    const hit = await page.locator(selector).evaluate(node => {
      const css = getComputedStyle(node, '::before');
      return { top:css.top, left:css.left, right:css.right, bottom:css.bottom };
    });
    assert.deepEqual(hit, { top:'-8px', left:'-8px', right:'-8px', bottom:'-8px' },
      selector + ': invisible 44px tap target');
  }

  const record = await page.locator('#compact-record-test .mini-card').evaluate(node => {
    const bounds=node.getBoundingClientRect();
    const action=node.querySelector('[data-record-repeat]').getBoundingClientRect();
    const top=node.querySelector('.mini-card__record-top').getBoundingClientRect();
    return {width:bounds.width,height:bounds.height,centerDelta:Math.abs(action.x+action.width/2-(top.right-22))};
  });
  assert.ok(Math.abs(record.width-290)<0.1 && Math.abs(record.height-200)<0.1,
    'The fixed MiniCard must retain its approved 290×200 geometry');
  assert.ok(record.centerDelta<0.1, 'Repeat remains centered in the existing right 44px header slot');
  assert.equal((await measure('[data-record-repeat]')).bg,'rgb(17, 17, 17)','Record repeat is still black');
  assert.equal((await measure('[data-record-settings]')).bg,'rgb(255, 255, 255)','Settings remains secondary');
  assert.equal((await measure('[data-calendar-prev]')).border,'1px','Date navigation keeps its outline');
  await page.locator('[data-record-repeat]').click();
  await page.locator('[data-record-settings]').click();
  assert.deepEqual(await page.evaluate(()=>[window.__recordClicks,window.__settingsClicks]),[1,1],
    'Record repeat/settings handlers must remain separate');
  await page.locator('[data-card-repeat]').click();
  assert.deepEqual(await page.evaluate(()=>[window.__repeatClicks,window.__openClicks||0]),[1,0],
    'MiniCard repeat may not accidentally open the card');
  await page.locator('[data-card-open]').click({position:{x:85,y:85}});
  assert.equal(await page.evaluate(()=>window.__openClicks),1,'MiniCard surface still opens');
  await page.locator('[data-date-navigator-prev]').click();
  assert.equal(await page.evaluate(()=>window.__dayChange),'2026-11-12',
    'The previous arrow changes the day');
  await page.locator('[data-date-navigator-next]').click();
  assert.equal(await page.evaluate(()=>window.__dayChange),'2026-11-13',
    'The next arrow restores the day');
  await page.locator('[data-calendar-prev]').click();
  assert.equal(await page.evaluate(()=>window.__monthChange),'2026-10',
    'The previous arrow changes the month');
  await page.locator('[data-calendar-next]').click();
  assert.equal(await page.evaluate(()=>window.__monthChange),'2026-11',
    'The next arrow restores the month');

  const full = await measure('.ui-button');
  assert.equal(full.height, 48, 'Full-size action must remain 48px');

  await page.locator('[data-repeated-add="extraEmail"]').click();
  assert.equal(await page.locator('[data-repeated-name="extraEmail"] [data-repeated-row]').count(), 1,
    'Compact Email plus must create one row');
  await page.locator('[data-repeated-name="extraEmail"] [data-repeated-remove]').click();
  assert.equal(await page.locator('[data-repeated-name="extraEmail"] [data-repeated-row]').count(), 0,
    'Compact Email cross must remove its own row');

  await page.locator('[data-repeated-add="extraTelegram"]').click();
  assert.equal(await page.locator('[data-repeated-name="extraTelegram"] [data-repeated-row]').count(), 2,
    'Compact Telegram plus must append another row');
  await page.locator('[data-repeated-name="extraTelegram"] [data-repeated-row]').last().locator('[data-repeated-remove]').click();
  assert.equal(await page.locator('[data-repeated-name="extraTelegram"] [data-repeated-row]').count(), 1,
    'Compact Telegram cross must remove the added row');

  await page.locator('[data-add-link="profileLinks"]').click();
  assert.equal(await page.locator('[data-links="profileLinks"] [data-link-row]').count(), 2,
    'Compact link plus must add one link');
  await page.locator('[data-links="profileLinks"] [data-link-row]').last().locator('[data-remove-link]').click();
  assert.equal(await page.locator('[data-links="profileLinks"] [data-link-row]').count(), 1,
    'Compact link cross must remove the added link');
  console.log('PASS: Chromium one Compact 28x28 for contact actions, MiniCard repeat/settings and date arrows; all handlers and card geometry preserved');
} finally {
  await browser?.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
