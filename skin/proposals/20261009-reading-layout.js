/* Apply after existing reader-tools init; no manuscript changes. */
(() => {
 function enhance(){
  if(document.body.id!=='tt-body-page'&&!document.body.classList.contains('tt-body-page'))return;

  document.querySelectorAll('.text-length, #popupContainer').forEach(el=>el.remove());
  const meta=document.querySelector('.h-entry .meta-cate');
  if(meta&&!meta.dataset.nhDates){
   const pub=document.querySelector('meta[property="article:published_time"]')?.content;
   const mod=document.querySelector('meta[property="article:modified_time"]')?.content;
   const format=value=>{const m=/^(\d{4})-(\d{2})-(\d{2})T/.exec(value||'');return m?m[1]+'. '+Number(m[2])+'. '+Number(m[3])+'.':null};
   const published=format(pub),modified=format(mod);
   if(published){const category=meta.querySelector('.p-category');meta.replaceChildren();if(category)meta.append(category);meta.append(document.createTextNode(' · 최초 발행 '+published));if(modified&&mod!==pub)meta.append(document.createTextNode(' · 개정 '+modified));meta.dataset.nhDates='true';}
  }
  if(!document.querySelector('#nh-back-top')){
   const top=document.createElement('button');top.id='nh-back-top';top.type='button';top.setAttribute('aria-label','맨 위로 이동');top.title='맨 위로';top.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 11 6-6 6 6M12 5v14"/></svg>';top.hidden=true;
   const dock=document.createElement('div');dock.id='nh-reading-dock';
   const panel=document.createElement('nav');panel.id='nh-floating-toc';panel.setAttribute('aria-label','빠른 목차');panel.setAttribute('aria-hidden','true');
   const label=document.createElement('strong');label.textContent='이 글의 목차';const list=document.createElement('ol');panel.append(label,list);
   top.setAttribute('aria-controls',panel.id);top.setAttribute('aria-expanded','false');dock.append(panel,top);document.body.append(dock);
   const touch=()=>matchMedia('(hover: none), (pointer: coarse)').matches;
   const fill=()=>{list.replaceChildren();document.querySelectorAll('#nh-reader-tools ol a').forEach(source=>{const li=document.createElement('li');const a=document.createElement('a');a.href=source.getAttribute('href');a.textContent=source.textContent;a.addEventListener('click',()=>setOpen(false));li.append(a);list.append(li)})};
   const setOpen=open=>{if(open&&!dock.classList.contains('is-open')){fill();if(!list.children.length)return}dock.classList.toggle('is-open',open);panel.setAttribute('aria-hidden',String(!open));panel.inert=!open;top.setAttribute('aria-expanded',String(open));top.setAttribute('aria-label',touch()?(open?'맨 위로 이동':'목차 열기'):'맨 위로 이동');top.title=touch()&&open?'맨 위로':'목차 · 맨 위로'};
   panel.inert=true;
   const update=()=>{const hide=window.scrollY<500;dock.hidden=hide;top.hidden=hide;if(hide)setOpen(false)};window.addEventListener('scroll',update,{passive:true});update();
   let closeTimer;
   const keepOpen=()=>{clearTimeout(closeTimer);if(!touch())setOpen(true)};
   const delayedClose=()=>{clearTimeout(closeTimer);if(!touch())closeTimer=setTimeout(()=>{if(!dock.matches(':hover')&&!dock.contains(document.activeElement))setOpen(false)},220)};
   dock.addEventListener('pointerenter',keepOpen);dock.addEventListener('pointerleave',delayedClose);panel.addEventListener('pointerenter',keepOpen);panel.addEventListener('pointerleave',delayedClose);
   dock.addEventListener('focusin',e=>{if(!touch()&&e.target===top)setOpen(true)});dock.addEventListener('focusout',e=>{if(!dock.contains(e.relatedTarget))setOpen(false)});
   document.addEventListener('pointerdown',e=>{if(!dock.contains(e.target))setOpen(false)});
   dock.addEventListener('keydown',e=>{if(e.key==='Escape'){setOpen(false);top.focus()}});
   top.addEventListener('click',()=>{if(touch()&&!dock.classList.contains('is-open')){setOpen(true);return}setOpen(false);window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})});
  }
  const header=document.querySelector('#header_gnb');
  if(header&&!header.querySelector('.nh-clean-nav')){
   const nav=document.createElement('nav');nav.className='nh-clean-nav';nav.setAttribute('aria-label','주요 카테고리');
   for(const [label,path] of [['음식','음식'],['영양소','영양소'],['약학','약약'],['질병','질병']]){const a=document.createElement('a');a.textContent=label;a.href='/category/Healthy%20Life/'+encodeURIComponent(path);nav.append(a)}
   header.querySelector('#header-title')?.after(nav);
  }
  const title=document.querySelector('h1.hd-heading');
  const search=document.querySelector('#search-bar');
  const searchButton=search?.querySelector('button');
  const input=search?.querySelector('input');
  if(searchButton&&input&&!searchButton.hasAttribute('onclick')&&!search.classList.contains('nh-icon-search')){
   search.classList.add('nh-icon-search');
   searchButton.setAttribute('aria-label','검색 열기');searchButton.setAttribute('aria-expanded','false');
   searchButton.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>';
   searchButton.addEventListener('click',event=>{if(!search.classList.contains('is-open')){event.preventDefault();search.classList.add('is-open');searchButton.setAttribute('aria-expanded','true');searchButton.setAttribute('aria-label','검색 실행');input.focus()}});
   input.addEventListener('keydown',event=>{if(event.key==='Escape'){search.classList.remove('is-open');searchButton.setAttribute('aria-expanded','false');searchButton.setAttribute('aria-label','검색 열기');searchButton.focus()}});
  }
  const menu=document.querySelector('#menu-toggle');
  if(menu&&!menu.querySelector('svg'))menu.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3 5h18M3 12h18M3 19h18"/></svg>';
  if(title&&!title.querySelector('.nh-clean-subtitle')){const text=title.textContent;const split=text.indexOf('｜');if(split>0){title.textContent=text.slice(0,split);const sub=document.createElement('span');sub.className='nh-clean-subtitle';sub.textContent=text.slice(split+1);title.append(sub)}}
  const links=document.querySelectorAll('#nh-reader-tools ol a');
  links.forEach(a=>{if(!a.dataset.fullTitle)a.dataset.fullTitle=a.textContent;const text=a.dataset.fullTitle;a.title=text;a.textContent=text.split('｜')[0].replace(/^\s*\d+[.\s]+/,'').trim()});
 }
 enhance();
 const observer=new MutationObserver(enhance);observer.observe(document.body,{childList:true});setTimeout(()=>observer.disconnect(),10000);
})();
