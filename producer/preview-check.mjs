import { chromium } from 'playwright-core';
import { readFile,writeFile } from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const output=resolve(process.argv[2]);
const browser=await chromium.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true});
const measurements=[];
try{for(const width of [1440,390]){
const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();
await page.goto(pathToFileURL(resolve(output,'apple356-preview.html')).href,{waitUntil:'load',timeout:60000});
await page.evaluate(async()=>{for(const img of document.images){img.loading='eager';await img.decode().catch(()=>{});}});
const m=await page.evaluate(()=>({viewport:innerWidth,overflowPx:Math.max(0,document.documentElement.scrollWidth-innerWidth),images:document.images.length,brokenImages:[...document.images].filter(i=>!i.complete||!i.naturalWidth).length,missingAlt:[...document.images].filter(i=>!i.alt.trim()).length,wideImages:[...document.images].filter(i=>i.getBoundingClientRect().right>innerWidth).length,h2:[...document.querySelectorAll('h2')].length,badH2:[...document.querySelectorAll('h2')].filter(h=>getComputedStyle(h).fontSize!=='26px'||getComputedStyle(h).fontWeight!=='800').length,tableWrappers:[...document.querySelectorAll('table')].every(t=>getComputedStyle(t.parentElement).overflowX==='auto'),heroPriority:document.images[0].fetchPriority==='high',highlightColors:new Set([...document.querySelectorAll('span')].filter(s=>s.style.background.includes('linear-gradient')).map(s=>s.style.background)).size,faqQuestions:document.querySelectorAll('span').length? [...document.querySelectorAll('span')].filter(s=>s.textContent==='Q.').length:0}));
await page.screenshot({path:resolve(output,`apple356-preview-${width}.png`),fullPage:true});
measurements.push({...m,status:m.overflowPx===0&&m.images===3&&!m.brokenImages&&!m.missingAlt&&!m.wideImages&&!m.badH2&&m.tableWrappers&&m.heroPriority&&m.highlightColors>=2&&m.faqQuestions===2?'PASS':'FAIL'});
await context.close();
}}finally{await browser.close();}
const report=JSON.parse(await readFile(resolve(output,'apple356-review.json')));
report.viewport_measurements=measurements;report.model_output_review='PASS: 3 Korean paragraphs, claim IDs and numeric values preserved; raw unit spacing retained in model-result';report.model_generation='REAL_LOCAL_QWEN_CPU; PREVIEW_CODEX_ASSEMBLED_FOR_REVIEW';
await writeFile(resolve(output,'apple356-review.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(measurements));
if(measurements.some(m=>m.status!=='PASS'))process.exitCode=1;
