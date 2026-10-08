// Commons supplies the original file page and explicit reuse metadata.
const clean=value=>String(value??'').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').trim();
const terms=['','nutrition','food','cooking','label','bottle'];
export async function collectSectionImages(item,article,{subject=item.keyword,fetcher=fetch}={}){
  const images=[],used=new Set();
  for(const [sectionIndex,section] of article.sections.entries()){
    const query=`"${subject}" ${terms[sectionIndex]??''}`.trim();
    let reason='no-licensed-match';
    try{
      const url=new URL('https://commons.wikimedia.org/w/api.php');
      url.search=new URLSearchParams({action:'query',format:'json',generator:'search',gsrsearch:query,gsrnamespace:'6',gsrlimit:'5',prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:'1000'});
      const response=await fetcher(url,{signal:AbortSignal.timeout(12000)});
      if(!response.ok)throw Error('HTTP_'+response.status);
      const data=await response.json();
      for(const page of Object.values(data.query?.pages??{})){
        // Search can match descriptions of an unrelated refrigerator or meal.
        // Use only files whose own title identifies the current subject.
        const title=String(page.title??'').replaceAll('_',' ').toLowerCase();
        if(![subject,item.keyword].some(name=>name&&title.includes(String(name).toLowerCase())))continue;
        const info=page.imageinfo?.[0],meta=info?.extmetadata??{};
        const license=clean(meta.LicenseShortName?.value),author=clean(meta.Artist?.value);
        const src=info?.thumburl??info?.url;
        if(!src||!info.descriptionurl||!author||!/^CC (?:BY|BY-SA|0)\b|^Public domain$/i.test(license)||used.has(info.url))continue;
        if(!/\.(?:jpe?g|png|webp)$/i.test(page.title))continue;
        images.push({src,sourcePage:info.descriptionurl,author,license,licenseUrl:meta.LicenseUrl?.value??'',alt:`${item.keyword} — ${section.heading}`,sectionIndex,searchQuery:query});
        used.add(info.url);reason='selected';break;
      }
    }catch(error){reason=error.name==='TimeoutError'?'search-timeout':'search-unavailable';}
    console.log('QUEUE_IMAGE_SECTION '+JSON.stringify({articleId:item.articleId,section:sectionIndex+1,query,result:reason}));
  }
  return images;
}
