"""Play the self-contained HTML in real Chromium. Solver routes are test-only input."""
from pathlib import Path
import json, os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
trace=json.loads((ROOT/'validation/browser-trace.json').read_text())
report={'success':False,'checks':[],'pageErrors':[],'httpRequests':[]}
hashjs="""() => {const c=document.getElementById('board');let h=2166136261;for(const b of c.getContext('2d').getImageData(0,0,64,64).data)h=Math.imul(h^b,16777619)>>>0;return String(h);}"""
with sync_playwright() as pw:
 try:
  browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 except Exception as exc:
  report.update(status='blocked',stage='browser-launch',error=str(exc))
  (ROOT/'validation/browser-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
  raise
 page=browser.new_page(viewport={'width':1280,'height':1050})
 page.on('pageerror',lambda error:report['pageErrors'].append(str(error)))
 page.on('request',lambda req:report['httpRequests'].append(req.url) if req.url.startswith(('http:','https:')) else None)
 try:
  report['loadMode']='exact standalone HTML via set_content'
  page.set_content((ROOT/'dist/SS02-demo.html').read_text(),wait_until='load')
  board=page.locator('#board')
  page.wait_for_function("document.getElementById('board').dataset.busy === 'false'")
  assert board.get_attribute('data-level')=='1'
  assert page.locator('#tutorial').is_visible() and page.locator('#tutorial').get_attribute('open') is not None
  assert page.evaluate(hashjs)==trace['initial']
  page.screenshot(path=str(ROOT/'validation/ss02-tutorial.png'),full_page=True)
  report['checks'].append('Standalone load; level 1 selected and tutorial expanded; first frame matches engine')
  assert page.locator('[data-action]').count()==4
  assert page.locator('[data-action="5"]').count()==0
  moves=page.locator('#moves').inner_text()
  board.press('Space')
  assert page.evaluate(hashjs)==trace['initial'] and page.locator('#moves').inner_text()==moves
  report['checks'].append('Only four direction buttons; Space does not act')
  board.press('ArrowRight')
  before=page.evaluate(hashjs)
  board.press('ArrowRight');page.locator('#undo').click();page.wait_for_timeout(240)
  assert page.evaluate(hashjs)==before
  board.press('ArrowRight');page.locator('#reset').click();page.wait_for_timeout(240)
  assert page.evaluate(hashjs)==trace['initial']
  report['checks'].append('Undo and Reset interrupt a chain-push animation without stale frames')
  seen=set()
  for index,step in enumerate(trace['steps']):
   page.wait_for_function("document.getElementById('board').dataset.busy === 'false'")
   board.press({1:'ArrowUp',2:'ArrowDown',3:'ArrowLeft',4:'ArrowRight'}[step['action']])
   page.wait_for_function("document.getElementById('board').dataset.busy === 'false'")
   assert page.evaluate(hashjs)==step['hash'],f"pixel mismatch after {index+1}"
   assert board.get_attribute('data-level')==str(step['level'])
   assert board.get_attribute('data-completed')==str(step['completed'])
   assert board.get_attribute('data-state')==step['state']
   if index==1:
    assert 'done' in page.locator('[data-lesson="chain"]').get_attribute('class')
   if step['completed'] not in seen:
    seen.add(step['completed']);print('completed:',step['completed'],flush=True)
  assert page.locator('#victory').is_visible()
  assert page.locator('#victory strong').inner_text()=='VICTORY'
  page.screenshot(path=str(ROOT/'validation/ss02-victory.png'),full_page=True)
  report['checks'].append(f"All eight levels completed by keyboard; {len(trace['steps'])} public frames match reference")
  page.locator('#undo').click();assert not page.locator('#victory').is_visible()
  page.locator('#restart').click();assert board.get_attribute('data-level')=='1'
  page.locator('#level').select_option('8');assert board.get_attribute('data-level')=='8';assert not page.locator('#tutorial').is_visible()
  page.locator('#level').select_option('1');assert page.locator('#tutorial').is_visible()
  page.locator('[data-action="4"]').click();board.press('z');assert page.evaluate(hashjs)==trace['initial']
  page.set_viewport_size({'width':390,'height':844})
  assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1')
  page.screenshot(path=str(ROOT/'validation/ss02-mobile.png'),full_page=True)
  report['checks'].append('Victory undo; restart; direct level navigation; buttons; 390px mobile layout without horizontal overflow')
  assert not report['pageErrors'];assert not report['httpRequests']
  report['success']=True;report['totalActions']=len(trace['steps'])
 except Exception as exc:
  report['error']=str(exc)
  page.screenshot(path=str(ROOT/'validation/ss02-failure.png'),full_page=True)
  raise
 finally:
  (ROOT/'validation/browser-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
  browser.close()
print(json.dumps(report,ensure_ascii=False,indent=2))
