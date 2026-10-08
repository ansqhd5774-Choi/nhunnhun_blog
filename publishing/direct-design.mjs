// Called after strict source HTML security validation. No model or network requests.
export function renderDirectArticle(html){
  let index=0;
  let out=html.replace(/<h2>([\s\S]*?)<\/h2>/g,(_m,title)=>'<h2 id="direct-section-'+(++index)+'">'+index+'. '+title.replace(/^\d+[.)]\s*/,'')+'</h2>');
  out=out.replace(/(?:<(?:ol|ul)>[\s\S]*?<\/(?:ol|ul)>\s*)+/g,group=>{
    const cards=[...group.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(m=>{
      const text=m[1].replace(/^<strong>([\s\S]*?)<\/strong>/,(_n,label)=>'<strong>'+label.replace(/^\d+[.)]\s*/,'').replace(/[:：]\s*$/,'')+'</strong>');
      return '<div class="info-card">'+text+'</div>';
    });
    return '<div class="card-grid">'+cards.join('')+'</div>';
  });
  out=out.replace(/<table>([\s\S]*?)<\/table>/g,'<div class="table-wrap"><table>$1</table></div>');
  const headings=[...out.matchAll(/<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g)];
  const toc='<nav class="toc" aria-label="글 목차"><b>이 글에서 알아볼 내용</b>'+headings.map(x=>'<a href="#'+x[1]+'">'+x[2]+'</a>').join('')+'</nav>';
  out=out.replace(/^\s*<p>(<img\b[^>]*>)<\/p>/,(_m,img)=>'<figure class="hero">'+img.replace(/>$/,' loading="eager" fetchpriority="high">')+'</figure>');
  return '<div class="nh-direct">'+toc+out+'</div>';
}
