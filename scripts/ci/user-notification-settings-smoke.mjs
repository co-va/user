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
    const title=await q.locator('.v2-q-title').evaluate(el=>{
      const textRange=document.createRange();
      textRange.selectNodeContents(el);
      const textLines=[...textRange.getClientRects()].filter(rect=>rect.width>0 && rect.height>0);
      return {
        scroll:el.scrollWidth,client:el.clientWidth,
        height:el.getBoundingClientRect().height,line:getComputedStyle(el).lineHeight,
        textLines:textLines.length,
      };
    });
    assert.ok(title.scroll<=title.client+1,'Q title overflows 320px: '+JSON.stringify(title));
    assert.equal(title.textLines,1,'Q title text must stay on one line: '+JSON.stringify(title));
    assert.ok(Math.abs(title.height-46)<0.5,'Q title row must be exactly 46px: '+JSON.stringify(title));

    // Strict 12/12/12 empty Header contract for both Z and Q.
    // The 24px arrow is absolutely positioned; it must not set row height.
    const headerGeometry=await page.evaluate(async()=>{
      const {v2ZHeader,v2QHeader}=await import('/ui/v2/z-layout.js');
      const probe=document.createElement('div');
      probe.style.cssText='position:absolute;visibility:hidden;pointer-events:none;width:320px;top:0;left:0';
      document.body.append(probe);
      const measure=html=>{
        const wrapper=document.createElement('div');
        wrapper.innerHTML=html;
        probe.append(wrapper);
        const head=wrapper.firstElementChild;
        const middle=head.querySelector('[data-v2-z-header-content],[data-v2-q-header-content]');
        const arrow=head.querySelector('[data-v2-z-dismiss]');
        const box=()=>head.getBoundingClientRect();
        const empty=box().height;
        const arrowCenter=(arrow.getBoundingClientRect().top+arrow.getBoundingClientRect().bottom)/2-box().top;
        middle.innerHTML='<div style="height:46px"></div>';
        const one=box().height;
        middle.innerHTML='<div style="height:46px"></div><div style="height:46px"></div>';
        const two=box().height;
        wrapper.remove();
        return {empty,one,two,arrowCenter};
      };
      const result={z:measure(v2ZHeader()),q:measure(v2QHeader())};
      probe.remove();
      return result;
    });
    for(const [kind,sizes] of Object.entries(headerGeometry)){
      assert.ok(Math.abs(sizes.empty-36)<0.5,kind+' empty Header must be 12+12+12: '+JSON.stringify(sizes));
      assert.ok(Math.abs(sizes.one-70)<0.5,kind+' one 46px insertion must yield 12+46+12: '+JSON.stringify(sizes));
      assert.ok(Math.abs(sizes.two-128)<0.5,kind+' two 46px insertions need 12px between: '+JSON.stringify(sizes));
      assert.ok(Math.abs(sizes.arrowCenter-18)<0.5,kind+' arrow must be centered in the 12px empty middle: '+JSON.stringify(sizes));
    }

    // Rendered shared UI baseline (not just CSS token inspection).
    const baseline=await q.evaluate(sheet=>{
      const header=sheet.querySelector('[data-v2-q-header]');
      const content=sheet.querySelector('[data-v2-q-header-content]');
      const before=header.getBoundingClientRect().height;
      const inserted=document.createElement('div');
      inserted.style.height='46px';
      inserted.textContent='Вторая строка Header';
      content.append(inserted);
      const after=header.getBoundingClientRect().height;
      inserted.remove();

      const sample=document.createElement('div');
      sample.style.cssText='position:absolute;top:0;left:0;width:220px;visibility:hidden;pointer-events:none';
      sample.innerHTML='<label class="field"><input type="text" value="Текст"></label>'+
        '<button class="ui-select__control"><span class="ui-select__selection"><span class="ui-select__text"><span class="ui-select__value">Длинное значение селектора для двух строк</span></span></span></button>'+
        '<input class="ui-selector__search" type="search">'+
        '<button class="ui-selector__option">Двухстрочное значение для выбора</button>'+
        '<h2 class="v2-q-title">Тест</h2>';
      sheet.append(sample);
      const height=selector=>sample.querySelector(selector).getBoundingClientRect().height;
      const originalSurface=sheet.classList.contains('modal--surface-app');
      sheet.classList.add('modal--surface-app');
      const warmSurface=getComputedStyle(sheet).backgroundColor;
      if(!originalSurface)sheet.classList.remove('modal--surface-app');
      const result={
        top:getComputedStyle(header).paddingTop,
        bottom:getComputedStyle(header).paddingBottom,
        gap:getComputedStyle(content).rowGap,
        growth:after-before,
        warmSurface,
        fieldFill:getComputedStyle(sample.querySelector('.field input')).backgroundColor,
        selectorFill:getComputedStyle(sample.querySelector('.ui-select__control')).backgroundColor,
        field:height('.field input'),
        selector:height('.ui-select__control'),
        search:height('.ui-selector__search'),
        option:height('.ui-selector__option'),
        textTitle:height('.v2-q-title'),
      };
      sample.remove();
      return result;
    });
    assert.equal(baseline.warmSurface,'rgb(245, 245, 243)','Q must be warm #F5F5F3: '+JSON.stringify(baseline));
    const internalLayers=await q.evaluate(sheet=>{
      const probe=document.createElement('div');
      probe.style.cssText='position:absolute;visibility:hidden;pointer-events:none';
      probe.innerHTML='<div class="v2-layer v2-layer--top modal-sheet modal--top"></div>'+
        '<div class="v2-layer v2-layer--bottom modal-sheet modal--bottom modal--consent-sheet"><div class="modal-actions">Действие</div></div>'+
        '<div class="v2-layer v2-layer--technical modal-sheet modal--technical"></div>';
      sheet.append(probe);
      const result={
        s:getComputedStyle(probe.children[0]).backgroundColor,
        x:getComputedStyle(probe.children[1]).backgroundColor,
        xFooter:getComputedStyle(probe.children[1].firstElementChild).backgroundColor,
        technical:getComputedStyle(probe.children[2]).backgroundColor,
      };
      probe.remove();
      return result;
    });
    assert.deepEqual(internalLayers,{
      s:'rgb(245, 245, 243)',x:'rgb(245, 245, 243)',
      xFooter:'rgb(245, 245, 243)',technical:'rgb(255, 255, 255)',
    },'X, S and Q share warm background; technical modal remains white');
    assert.equal(baseline.fieldFill,'rgb(255, 255, 255)','Input must remain white on warm Q');
    assert.equal(baseline.selectorFill,'rgb(255, 255, 255)','Selector must remain white on warm Q');
    assert.equal(baseline.top,'12px','Q Header top must be 12px');
    assert.equal(baseline.bottom,'12px','Q Header bottom must be 12px');
    assert.equal(baseline.gap,'12px','Q Header control rows must have 12px gap');
    assert.ok(Math.abs(baseline.growth-58)<1,'A 46px inserted row must grow Header by 46+12px: '+JSON.stringify(baseline));
    for(const key of ['field','selector','search','option','textTitle'])
      assert.ok(Math.abs(baseline[key]-46)<1,'Shared '+key+' must be 46px: '+JSON.stringify(baseline));

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
