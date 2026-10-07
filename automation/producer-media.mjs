import {localRequest} from '../authoring/ollama.mjs';
export const textOnly=value=>String(value??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
export function licensedPhotos(data) {
  return Object.values(data?.query?.pages??{}).flatMap(page=>{
    const info=page.imageinfo?.[0],meta=info?.extmetadata;
    const license=textOnly(meta?.LicenseShortName?.value),author=textOnly(meta?.Artist?.value);
    if(!info || !/^image\/(jpeg|png)$/.test(info.mime??'') || !/^(CC0|CC BY(?:-SA)? [1-9](?:\.\d)?|Public domain)$/i.test(license) || !author || !info.thumburl || !info.descriptionurl) return [];
    const src=new URL(info.thumburl),sourcePage=new URL(info.descriptionurl);
    if(!['upload.wikimedia.org','thumb.wikimedia.org'].includes(src.hostname) || src.protocol!=='https:' || src.username || src.password || sourcePage.username || sourcePage.password || sourcePage.hostname!=='commons.wikimedia.org' || !sourcePage.pathname.startsWith('/wiki/File:')) return [];
    src.search='';
    return [{src:src.href,sourcePage:sourcePage.href,author,license,title:page.title}];
  });
}
export async function selectImages(keyword,englishQuery,{fetcher=fetch,onProgress=async()=>{}}={}) {
  const url=new URL('https://commons.wikimedia.org/w/api.php');
  for(const [key,value] of Object.entries({action:'query',format:'json',generator:'search',gsrnamespace:'6',gsrsearch:`${englishQuery} filetype:bitmap`,gsrlimit:'8',prop:'imageinfo',iiprop:'url|extmetadata|mime',iiurlwidth:'800'})) url.searchParams.set(key,value);
  const response=await fetcher(url,{headers:{'User-Agent':'NHUNNHUN-ContentProducer/1.0 (https://nhunnhun.tistory.com)'},signal:AbortSignal.timeout(45000)});
  if(!response.ok) throw new Error('E_PRODUCER_COMMONS');
  const photos=licensedPhotos(await response.json()),selected=[];
  const schema={type:'object',required:['matches','composition','alt','reason'],properties:{matches:{type:'boolean'},composition:{type:'string',enum:['closeup','cross-section','context','process','diagram']},alt:{type:'string'},reason:{type:'string'}}};
  for(const photo of photos) {
    const imageResponse=await fetcher(photo.src,{signal:AbortSignal.timeout(45000)});
    if(!imageResponse.ok) continue;
    const bytes=Buffer.from(await imageResponse.arrayBuffer());
    if(bytes.length>4*1024*1024) continue;
    const result=await localRequest({model:'gemma3:4b',stream:true,format:schema,keep_alive:'0',options:{temperature:0,num_ctx:4096,num_predict:600},messages:[{role:'user',content:`사진 픽셀을 실제로 보고 판단한다. 주제 '${keyword}' (${englishQuery})와 사진 대상이 일치하는지, closeup/cross-section/context/process/diagram 구도를 판별하고 구체적 한국어 alt를 적는다. 파일명만으로 판단하지 말고 불분명하거나 혼동되는 종이면 matches=false. JSON만 출력.`,images:[bytes.toString('base64')]}]},fetcher);
    let vision;try{vision=JSON.parse(result.message.content);}catch{throw new Error('E_PRODUCER_VISION_JSON');}
    await onProgress({photo,vision,model:'gemma3:4b',pixelBytes:bytes.length,checkedAt:new Date().toISOString()});
    if(vision.matches!==true || !schema.properties.composition.enum.includes(vision.composition) || typeof vision.alt!=='string' || vision.alt.trim().length<6) continue;
    if(!selected.length && vision.composition!=='closeup') continue;
    if(selected.some(p=>p.sourcePage===photo.sourcePage)) continue;
    selected.push({src:photo.src,alt:vision.alt.trim(),role:selected.length?'detail':'hero',composition:vision.composition,sourcePage:photo.sourcePage,author:photo.author,license:photo.license,visualChecked:true});
    if(selected.length===3) return selected;
  }
  throw new Error('E_PRODUCER_IMAGES_INSUFFICIENT');
}
