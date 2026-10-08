import {localRequest} from './ollama.mjs';
export async function chooseFoodEmphasis(article,{model,fetcher,cached=(_s,_i,fn)=>fn()}={}){
  const sections=article.sections.map(s=>({heading:s.heading,text:s.markdown}));
  const messages=[{role:'user',content:'6개 항목 각각에서 중요한 문구를 선택한다. 원문을 수정하지 않는다. 원문에 정확히 있는 짧은 구절 또는 중요한 문장만 선택한다. 중요도 1은 핵심 단어·성분·특징, 2는 제철·수치·핵심 효과·상호작용, 3은 중요한 섭취 조건·위험·보관 조건이다. 항목별 핵심 정보를 모두 살펴 선택한다. JSON {"sections":[{"phrases":[{"text":"원문 구절","level":2}]}]}만 반환한다.\n'+JSON.stringify(sections)}];
  const raw=await cached('food-emphasis',{messages,model},async()=>{
    const r=await localRequest({model,messages,stream:false,format:'json',keep_alive:'5m',options:{num_ctx:8192,num_predict:2200,temperature:0}},fetcher);
    return JSON.parse(r.message.content);
  });
  article.sections.forEach((s,i)=>{s.emphasis=(raw.sections?.[i]?.phrases??[]).filter(p=>typeof p.text==='string'&&p.text.trim()&&s.markdown.replace(/\*\*|==/g,'').includes(p.text)&&[1,2,3].includes(p.level));});
  return article;
}
export function applyChosenEmphasis(html,phrases=[]){
  const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  return html.split(/(<[^>]+>)/g).map(chunk=>{
    if(chunk.startsWith('<'))return chunk;
    const choices=[...phrases].sort((a,b)=>b.text.length-a.text.length);
    const byText=new Map(choices.map(p=>[esc(p.text),p]));
    if(!byText.size)return chunk;
    const pattern=[...byText.keys()].map(t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
    return chunk.replace(new RegExp(pattern,'g'),text=>{
      const p=byText.get(text),strong='<strong>'+text+'</strong>';
      return p.level===1?strong:'<mark>'+(p.level===3?'<u>'+strong+'</u>':strong)+'</mark>';
    });
  }).join('');
}
