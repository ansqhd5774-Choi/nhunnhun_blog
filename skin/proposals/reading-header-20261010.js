(()=>{
  
  const meta=document.querySelector('.h-entry .meta-cate');
  if(meta&&!meta.dataset.nhDates){
   const pub=document.querySelector('meta[property="article:published_time"]')?.content;
   const mod=document.querySelector('meta[property="article:modified_time"]')?.content;
   const format=value=>{const m=/^(\d{4})-(\d{2})-(\d{2})T/.exec(value||'');return m?m[1]+'. '+Number(m[2])+'. '+Number(m[3])+'.':null};
   const published=format(pub),modified=format(mod);
   if(published){const category=meta.querySelector('.p-category');meta.replaceChildren();if(category)meta.append(category);meta.append(document.createTextNode(' · 최초 발행 '+published));if(modified&&mod!==pub)meta.append(document.createTextNode(' · 개정 '+modified));meta.dataset.nhDates='true';}
  }
const title=document.querySelector('h1.hd-heading');if(title&&!title.querySelector('.nh-clean-subtitle')){const text=title.textContent,split=text.indexOf('｜');if(split>0){title.textContent=text.slice(0,split);const sub=document.createElement('span');sub.className='nh-clean-subtitle';sub.textContent=text.slice(split+1);title.append(sub)}}})();
