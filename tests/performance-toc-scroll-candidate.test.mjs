import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { repairTocScroll } from '../scripts/performance-toc-scroll-candidate.mjs';
const original = "heading.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'});\n        if (innerWidth < 768) details.open = false;";
const wrap = text => `<script id="nh-reader-tools-script">${text}</script>`;
function exercise(width,reduced) {
  const actions=[],frames=[]; const details={set open(v){actions.push(['close',v]);}};
  const code=repairTocScroll(wrap(original)).replace(/<\/?script[^>]*>/g,'');
  vm.runInNewContext(code,{innerWidth:width,details,requestAnimationFrame:fn=>frames.push(fn),heading:{scrollIntoView:opts=>actions.push(['scroll',opts.behavior,opts.block])},matchMedia:()=>({matches:reduced})});
  return {actions,frames};
}
test('mobile closes before deferred scroll',()=>{const r=exercise(390,false);assert.deepEqual(r.actions,[['close',false]]);assert.equal(r.frames.length,1);r.frames[0]();assert.deepEqual(r.actions,[['close',false],['scroll','smooth','start']]);});
test('desktop scrolls without closing',()=>{const r=exercise(1440,false);assert.equal(r.frames.length,0);assert.deepEqual(r.actions,[['scroll','smooth','start']]);});
test('reduced motion uses auto',()=>{const r=exercise(390,true);r.frames[0]();assert.equal(r.actions[1][1],'auto');});
test('surrounding source preserved and idempotent',()=>{const s='ads'+wrap(original)+'platform';const p=repairTocScroll(s);assert.ok(p.startsWith('ads'));assert.ok(p.endsWith('platform'));assert.equal(repairTocScroll(p),p);});
test('ambiguous source rejected',()=>{assert.throws(()=>repairTocScroll('REDACTED'),/REDACTED/);assert.throws(()=>repairTocScroll(wrap(original)+wrap(original)),/EXPECTED_ONE/);assert.throws(()=>repairTocScroll(wrap('changed')),/EXPECTED_ORIGINAL/);});
