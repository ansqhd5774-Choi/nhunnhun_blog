import { localRequest } from './ollama.mjs';
import { modelMetrics } from './queue-ollama.mjs';

export const FOOD_SECTIONS = [
  {question:'소개',targetChars:250,format:'서술형',include:'한국 제철 정보, 특징'},
  {question:'영양소와 핵심 성분',targetChars:400,format:'서술형, 기본표, 핵심표, 효과',include:'표(성분,일일영양소)'},
  {question:'꾸준히 먹으면 신체 변화는?',targetChars:400,format:'서술형, 핵심 효과(요약형)',include:'구체적이고 논리적인 효과'},
  {question:'궁합이 잘 맞는 음식과 시너지 효과',targetChars:400,format:'서술형, 핵심 효과',include:'구체적이고 논리적인 효과'},
  {question:'섭취 시 주의사항',targetChars:400,format:'서술형, 요약형',include:'구체적이고 논리적인 효과'},
  {question:'좋은 {keyword} 고르는 방법과 보관',targetChars:400,format:'서술형, 요약형',include:'구체적이고 논리적인 효과'}
];

export function foodSectionInstructions(keyword='가지') {
  return FOOD_SECTIONS.map(s=>({...s,question:s.question.replace('{keyword}',keyword)}));
}
export function foodSectionPrompt(spec,index,subject) {
  return `${index+1} ${spec.question}\n주제: ${subject}\n제목: ${spec.question}\n언어: 한국어 약 ${spec.targetChars}자\n형식: ${spec.format}\n내용: ${spec.include}`;
}
export async function writeFoodSections(item,evidence,{cached=(_stage,_input,action)=>action(),onCacheHit,onMetrics=()=>{},model,fetcher=fetch}={}) {
  const subject=evidence.query&&evidence.query!==item.keyword?`${item.keyword}(${evidence.query})`:item.keyword;
  const sections=[];
  for(const [index,spec] of foodSectionInstructions(item.keyword).entries()) {
    const materials=(evidence.sources??[]).map(s=>({title:s.title,url:s.url,text:s.notes??s.text??s.abstract??s.excerpt??s.summary??''})).filter(s=>s.text).slice(0,6);
    const messages=[{role:'user',content:foodSectionPrompt(spec,index,subject)+(materials.length?'\n참고 자료 — 해당 항목과 관련된 정보를 사용:\n'+JSON.stringify(materials).slice(0,12000):'')}];
    const raw=await cached(`food-section-${index+1}`,{messages,model},async()=>{
      const started=Date.now();
      const result=await localRequest({model,stream:false,messages,keep_alive:'5m',options:{num_ctx:8192,num_predict:4000}},fetcher);
      const metrics=modelMetrics(result,{purpose:'draft',model,elapsedMs:Date.now()-started});
      onMetrics(metrics);
      console.log('QUEUE_MODEL_COMPLETE '+JSON.stringify({...metrics,section:index+1}));
      return result.message.content;
    },onCacheHit);
    sections.push({id:`section-${index}`,heading:spec.question,paragraphs:[raw],markdown:raw,modules:[],sourceIds:[],strongPhrase:''});
  }
  const introduction=sections[0].markdown.replace(/^#{1,6}[^\n]*\n+/,'').trim();
  const lead=introduction.split(/\n\s*\n/)[0].replace(/\*\*|==/g,'').replace(/<\/?mark>/g,'');
  return {title:`${item.keyword} 영양소·효과·궁합·주의사항·보관`,lead,summary:lead,sections,plan:{scope:'food-sections'}};
}

const escape=text=>String(text).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const inline=text=>escape(text).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\*([^*\n]+)\*/g,'<em>$1</em>').replace(/==([^=\n]+)==/g,'<u>$1</u>').replace(/&lt;mark&gt;([\s\S]*?)&lt;\/mark&gt;/g,'<u>$1</u>');
export function renderFoodMarkdown(markdown) {
  const lines=markdown.replace(/^#{1,6}[^\n]*\n+/,'').split(/\r?\n/);
  let html='',paragraph=[],list=false;
  const flush=()=>{if(paragraph.length){html+='<p>'+inline(paragraph.join(' '))+'</p>';paragraph=[];}if(list){html+='</ul>';list=false;}};
  for(let i=0;i<lines.length;i++) {
    const line=lines[i].trim();
    if(line.startsWith('|')&&/^\s*\|?\s*:?-{3,}/.test(lines[i+1]??'')) {
      flush();const cells=row=>row.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(s=>s.trim());
      html+='<table><thead><tr>'+cells(line).map(c=>'<th>'+inline(c)+'</th>').join('')+'</tr></thead><tbody>';i++;
      while(lines[i+1]?.trim().startsWith('|')){i++;html+='<tr>'+cells(lines[i]).map(c=>'<td>'+inline(c)+'</td>').join('')+'</tr>';}
      html+='</tbody></table>';continue;
    }
    if(/^\d+[.)]\s+/.test(line)){flush();html+='<ol start="'+line.match(/^\d+/)[0]+'"><li>'+inline(line.replace(/^\d+[.)]\s+/,''))+'</li></ol>';continue;}
    if(/^[-*]\s+/.test(line)){if(paragraph.length)flush();if(!list){html+='<ul>';list=true;}html+='<li>'+inline(line.replace(/^[-*]\s+/,''))+'</li>';continue;}
    if(!line||/^---+$/.test(line)){flush();continue;}
    if(list)flush();
    if(/^#{1,6}\s/.test(line)){flush();html+='<h3>'+inline(line.replace(/^#{1,6}\s+/,''))+'</h3>';continue;}
    paragraph.push(line);
  }
  flush();return html;
}
