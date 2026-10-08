const clean=value=>String(value??'').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').trim();
async function imageDecision(messages,{model,fetcher}){
  const response=await fetcher('http://127.0.0.1:11434/api/chat',{
    method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(120000),
    body:JSON.stringify({model,stream:false,format:'json',messages,keep_alive:'5m',options:{num_ctx:8192,num_predict:700,temperature:0}})
  });
  if(!response.ok)throw Error('E_IMAGE_MODEL_RESPONSE');
  const result=await response.json();return JSON.parse(result.message.content);
}
export async function collectSectionImages(item,article,{subject=item.keyword,model='gemma3:4b',fetcher=fetch,representativeRetry=0}={}){
  const sections=article.sections.map(s=>({heading:s.heading,text:clean(s.markdown??(s.paragraphs??[]).join(' ')).slice(0,350)}));
  const plan=await imageDecision([{role:'user',content:'각 항목에 필요한 실제 사진의 피사체를 영어 검색어로 작성한다. Commons는 검색어의 모든 단어를 함께 찾는다. 기본 검색어는 영문 주제명 자체이며, 구체 장면이 필요할 때만 명사 한 단어를 추가한다. 검색어는 2~4단어다. best quality, health benefits, how to 같은 검색 질문 대신 사진에 보이는 물건이나 장면을 쓴다. 항목당 검색어 하나. 사진의 설명 가치가 없으면 빈 문자열. JSON {"queries":["검색어",...]}만 반환한다.\n'+JSON.stringify({subject,keyword:item.keyword,sections})+'\n영어 검색어만 사용한다. 모든 검색어는 '+subject+'로 시작한다. 항목과 연결할 사진이 없으면 빈 문자열. queries 배열을 반환한다.'}],{model,fetcher});
  const images=[],used=new Set(),descriptions=[];
  for(const [sectionIndex,section] of sections.entries()){
    const query=representativeRetry?subject:String(plan.queries?.[sectionIndex]??'').trim()||subject;
    let result='omitted';
    try{
      if(query){
        const url=new URL('https://commons.wikimedia.org/w/api.php');
        url.search=new URLSearchParams({action:'query',format:'json',generator:'search',gsrsearch:query,gsrnamespace:'6',gsrlimit:representativeRetry?'9':'3',prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:'1000'});
        const response=await fetcher(url,{signal:AbortSignal.timeout(12000)});
        if(!response.ok)throw Object.assign(Error('E_IMAGE_SEARCH'),{status:response.status});
        const data=await response.json(),candidates=[];
        for(const page of Object.values(data.query?.pages??{})){
          const info=page.imageinfo?.[0];
          if(!info?.url||used.has(info.url)||!/\.(?:jpe?g|png|webp)$/i.test(page.title))continue;
          const src=info.thumburl??info.url;
          const preview=src;
          const picture=await fetcher(preview,{signal:AbortSignal.timeout(12000)});
          if(!picture.ok||!picture.headers.get('content-type')?.startsWith('image/'))continue;
          const bytes=Buffer.from(await picture.arrayBuffer());
          if(bytes.length>3*1024*1024)continue;
          candidates.push({info,src,image:bytes.toString('base64')});
        }
        console.log('QUEUE_IMAGE_CANDIDATES '+JSON.stringify({section:sectionIndex+1,count:candidates.length}));
        if(candidates.length){
          const decision=await imageDecision([{role:'user',images:candidates.map(x=>x.image),content:'첨부 사진의 index는 순서대로 0, 1, 2다. 주제가 사진의 중심이며 해당 항목의 실제 내용을 설명하는 사진 한 장을 선택한다. 설명 가치가 없으면 suitable을 false로 반환한다. 이미 사용한 사진과 비슷한 구도도 반복하지 않는다. 사진에 실제 보이는 내용을 한국어로 설명한다. JSON {"suitable":true,"index":0,"description":"실제 사진 설명"}만 반환한다.\n'+JSON.stringify({subject,section,alreadyUsed:descriptions})}],{model,fetcher});
          const index=decision.index;
          console.log('QUEUE_IMAGE_DECISION '+JSON.stringify({section:sectionIndex+1,suitable:decision.suitable,index,description:decision.description}));
          if(decision.suitable===true&&Number.isInteger(index)&&index>=0&&index<candidates.length&&String(decision.description??'').trim()){
            const {info,src}=candidates[index],meta=info.extmetadata??{};
            images.push({src,sourcePage:info.descriptionurl??info.url,author:clean(meta.Artist?.value),license:clean(meta.LicenseShortName?.value),licenseUrl:meta.LicenseUrl?.value??'',alt:clean(decision.description),sectionIndex,searchQuery:query});
            used.add(info.url);descriptions.push(clean(decision.description));result='visually-selected';
          }
        }
      }
    }catch(error){result='unavailable';console.log('QUEUE_IMAGE_ERROR '+JSON.stringify({articleId:item.articleId,section:sectionIndex+1,code:error.message,status:error.status??null}));}
    console.log('QUEUE_IMAGE_SECTION '+JSON.stringify({articleId:item.articleId,section:sectionIndex+1,query,result}));
  }
  if(!images.length){
    if(representativeRetry<1)return collectSectionImages(item,article,{subject,model,fetcher,representativeRetry:representativeRetry+1});
    throw Error('E_IMAGE_REPRESENTATIVE_REQUIRED');
  }
  images[0].representative=true;
  return images;
}
