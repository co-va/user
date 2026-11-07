import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { chromium } from 'playwright';

// Real User Q and CSS from this checkout; the API responses are controlled.
const root=process.cwd();
const html=await readFile('index.html','utf8');
const styles=[...html.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g)].map(x=>x[1]);
const fixture=`<!doctype html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
${styles.map(x=>`<link rel="stylesheet" href="/${x}">`).join('')}
</head><body><div id="app" class="app-shell"></div></body></html>`;
const mime={'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const server=createServer(async(req,res)=>{
  const pathname=new URL(req.url||'/','http://127.0.0.1').pathname;
  if(pathname==='/__email_settings_smoke__'){
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.end(fixture);return;
  }
  const file=resolve(root,`.${decodeURIComponent(pathname)}`);
  if(!file.startsWith(root+sep)){res.writeHead(403).end();return}
  try{
    const data=await readFile(file);
    res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');
    res.end(data);
  }catch{res.writeHead(404).end()}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base=`http://127.0.0.1:${server.address().port}/__email_settings_smoke__`;
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});

try{
  for(const verified of [true,false]){
    const page=await browser.newPage({viewport:{width:320,height:730},serviceWorkers:'block'});
    const errors=[];
    let verificationCalls=0;
    let emailPreferenceCalls=0;
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base,{waitUntil:'load',timeout:25000});
    await page.evaluate(()=>localStorage.setItem('user.account.token','test-session'));
    await page.route('**/account/email-verification/status',async(route)=>{
      verificationCalls++;
      await route.fulfill({status:200,contentType:'application/json',
        body:JSON.stringify({email:'fixture@example.com',verified})});
    });
    await page.route('**/account/notification-settings',async(route)=>{
      emailPreferenceCalls++;
      await route.fulfill({status:500,contentType:'application/json',body:'{"error":"obsolete API"}'});
    });
    await page.route('**/account/platform-state',route=>route.fulfill({
      status:200,contentType:'application/json',
      body:'{"accepted":true,"document":{"title":"Условия","version":1}}'}));
    await page.route('**/account/push/config',route=>route.fulfill({
      status:200,contentType:'application/json',body:'{"enabled":false}'}));
    await page.evaluate(async()=>{
      const {renderGlobalAccount}=await import('/user/account-shell.js');
      const state={account:{id:'fixture',name:'Тест',email:'fixture@example.com',
        phone:'+79999999999',profileData:{}},accountTab:'profile',accountDeckActive:'profile'};
      const root=document.querySelector('#app');
      await renderGlobalAccount(root,state,{});
      root.querySelector('[data-account-profile-settings]')?.click();
    });
    await page.locator('[data-shared-profile-action="controls"]').click();
    const q=page.locator('.modal--account-controls');
    await q.waitFor({state:'visible'});
    const email=q.locator('[data-account-notification-email-status]');
    await email.waitFor({state:'visible'});
    assert.equal(await email.isChecked(),verified,'Email check must mirror verification state');
    assert.equal(await email.isDisabled(),true,'Email check must never be editable');
    assert.equal(await q.locator('[data-account-notification-push]').count(),1,'Push still present');
    assert.equal(await q.locator('[data-account-notification-email]').count(),0,'No actionable Email toggle');
    const title=await q.locator('.v2-q-title').evaluate(el=>({
      scroll:el.scrollWidth,client:el.clientWidth,
      height:el.getBoundingClientRect().height,line:getComputedStyle(el).lineHeight,
    }));
    assert.ok(title.scroll<=title.client+1,'Q title overflows 320px: '+JSON.stringify(title));
    assert.ok(title.height<=parseFloat(title.line)+1,'Q title must be one line: '+JSON.stringify(title));
    await email.evaluate(el=>el.click());
    assert.equal(await email.isChecked(),verified,'Disabled checkbox cannot change');
    assert.equal(verificationCalls,1,'Status fetched once from canonical account API');
    assert.equal(emailPreferenceCalls,0,'User must not call removed preference API');
    assert.deepEqual(errors,[],'No JS errors');
    await page.close();
  }
  console.log('User notifications: verified checked + unverified empty, both read-only, Push preserved, no preference API, 320px Q title: PASS');
}finally{
  await browser.close();
  await new Promise(done=>server.close(done));
}
