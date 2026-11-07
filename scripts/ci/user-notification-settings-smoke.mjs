import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { chromium } from 'playwright';

// Load real Profile Q and CSS from this checkout, not the deployed User.
const root = process.cwd();
const html = await readFile('index.html', 'utf8');
const styles = [...html.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g)].map(x => x[1]);
const fixture = `<!doctype html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
${styles.map(x=>`<link rel="stylesheet" href="/${x}">`).join('')}
</head><body><div id="app" class="app-shell"></div></body></html>`;
const mime={'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const server=createServer(async(req,res)=>{
  const pathname=new URL(req.url||'/', 'http://127.0.0.1').pathname;
  if(pathname==='/__email_settings_smoke__'){
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.end(fixture);return;
  }
  const file=resolve(root,`.${decodeURIComponent(pathname)}`);
  if(!file.startsWith(root+sep)){res.writeHead(403).end();return}
  try{const data=await readFile(file);res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(data)}
  catch{res.writeHead(404).end()}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base=`http://127.0.0.1:${server.address().port}/__email_settings_smoke__`;
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
  const page=await browser.newPage({viewport:{width:320,height:730},serviceWorkers:'block'});
  const faults=[];
  page.on('pageerror',e=>faults.push(e.message));
  await page.goto(base,{waitUntil:'load',timeout:25000});
  await page.evaluate(()=>localStorage.setItem('user.account.token','test-session'));

  let enabled=true,verified=true,writes=0;
  await page.route('**/account/notification-settings',async(route)=>{
    if(route.request().method()==='PUT'){
      writes++;
      enabled=JSON.parse(route.request().postData()||'{}').email;
    }
    await route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({emailVerified:verified,emailEnabled:enabled})});
  });
  await page.route('**/account/platform-state',route=>route.fulfill({status:200,contentType:'application/json',body:'{"accepted":true,"document":{"title":"Условия","version":1}}'}));
  await page.route('**/account/push/config',route=>route.fulfill({status:200,contentType:'application/json',body:'{"enabled":false}'}));
  await page.evaluate(async()=>{
    const {renderGlobalAccount}=await import('/user/account-shell.js');
    const state={account:{id:'fixture',name:'Тест',email:'fixture@example.com',phone:'+79999999999',profileData:{}},accountTab:'profile',accountDeckActive:'profile'};
    const root=document.querySelector('#app');
    await renderGlobalAccount(root,state,{});
    root.querySelector('[data-account-profile-settings]')?.click();
  });
  await page.locator('[data-shared-profile-action="controls"]').click();
  const q=page.locator('.modal--account-controls');
  await q.waitFor({state:'visible'});
  await q.locator('[data-account-notification-email]').waitFor({state:'visible'});
  const title=await q.locator('.v2-q-title').evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth,height:el.getBoundingClientRect().height,line:getComputedStyle(el).lineHeight}));
  assert.ok(title.scroll<=title.client+1,'Title must fit within one line on 320px: '+JSON.stringify(title));
  assert.ok(title.height<=parseFloat(title.line)+1,'Title must render one line: '+JSON.stringify(title));
  assert.equal(await q.locator('[data-account-notification-email]').isChecked(),true,'Verified email is on by default');
  await q.locator('[data-account-notification-email]').uncheck();
  await q.locator('[data-notification-status]').getByText('Сохранено.').waitFor({timeout:10000});
  assert.equal(writes,1,'Email preference must persist via Core API');
  assert.equal(enabled,false,'Email disabled at server');
  assert.equal(await q.locator('[data-account-notification-email]').isChecked(),false);
  await q.locator('[data-account-notification-email]').check();
  await q.locator('[data-notification-status]').getByText('Сохранено.').waitFor({timeout:10000});
  assert.equal(writes,2,'Enabled again only when user acts');
  assert.equal(enabled,true);
  // The preference stays editable with an unverified address. Only actual
  // email delivery is deferred until the account confirms that address.
  verified=false;
  enabled=false;
  await q.evaluate(el=>el.v2Close?.());
  // The fixture does not run the full app controller. Restore its Profile
  // screen explicitly before re-opening the settings Q.
  await page.evaluate(async()=>{
    const {renderGlobalAccount}=await import('/user/account-shell.js');
    const state={account:{id:'fixture',name:'Тест',email:'fixture@example.com',phone:'+79999999999',profileData:{}},accountTab:'profile',accountDeckActive:'profile'};
    const root=document.querySelector('#app');
    await renderGlobalAccount(root,state,{});
    const settings=root.querySelector('[data-account-profile-settings]');
    if(!settings) throw new Error('Re-rendered Profile settings trigger missing');
    settings.click();
  });
  await page.locator('[data-shared-profile-action="controls"]').click();
  const pending=page.locator('.modal--account-controls');
  await pending.locator('[data-account-notification-email]').waitFor({state:'visible'});
  assert.equal(await pending.locator('[data-account-notification-email]').isEnabled(),true,
    'Unverified account must be allowed to configure Email');
  assert.equal(await pending.locator('[data-account-notification-email]').isChecked(),false);
  await pending.locator('[data-account-notification-email]').check();
  await pending.locator('[data-notification-status]').getByText('Сохранено.').waitFor({timeout:10000});
  assert.equal(writes,3,'Preference saved for unverified account');
  assert.equal(enabled,true,'Account preference is on independently of delivery eligibility');
  assert.equal(await pending.locator('[data-account-notification-email]').isChecked(),true);
  assert.deepEqual(faults,[],'No runtime errors');
  console.log('User notifications: Push + Email, editable before verification, persisted preference, 320px single-line Q title: PASS');
}finally{await browser.close();await new Promise(done=>server.close(done))}
