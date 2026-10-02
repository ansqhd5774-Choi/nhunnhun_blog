const ACCENT='<div aria-hidden="true" style="width:34px;height:4px;background:#2563eb;border-radius:999px;margin:48px 0 10px;"></div>';
const H2='<h2 style="margin:0 0 18px;padding:0;font-size:26px;line-height:1.4;font-weight:800;letter-spacing:-0.02em;color:#111827;border:0;background:none;">';
const H3='<h3 style="margin:30px 0 10px;padding:0;font-size:20px;line-height:1.45;font-weight:800;letter-spacing:-0.01em;color:#1f2937;border:0;background:none;">';
const SOURCE='margin:8px 0 24px;padding-top:8px;border-top:1px solid #eef1f4;font-size:12px;line-height:1.6;color:#6b7280;';

function styleTable(inner){
  let t=inner;
  t=t.replace(/<thead><tr>/g,'<thead><tr style="background:#f5f6f8;">');
  t=t.replace(/<th>/g,'<th style="padding:11px 12px;border-bottom:1px solid #dfe4ea;text-align:left;font-weight:700;">');
  t=t.replace(/<td>/g,'<td style="padding:10px 12px;border-top:1px solid #eef1f4;vertical-align:top;">');
  return '<div style="overflow-x:auto;margin:14px 0 10px;border:1px solid #e5e7eb;border-radius:8px;"><table style="width:100%;min-width:520px;border-collapse:collapse;margin:0;background:#fff;font-size:14px;line-height:1.55;">'+t+'</table></div>';
}

export function applyEditorialTemplate(html){
  let out=html;

  // Hero and lead.
  out=out.replace(
    /<p>\s*(<img\b[^>]*>)\s*<\/p>\s*<p>/i,
    (_m,img)=>'<p>'+img.replace(/>$/, ' loading="eager" fetchpriority="high" decoding="async" style="width:100%;max-width:720px;height:auto;display:block;margin:18px auto 24px;">')+'</p><p style="margin:0 0 20px;font-size:16px;line-height:1.8;color:#374151;">'
  );

  // Remaining plain image paragraphs get responsive treatment without changing visible text.
  out=out.replace(/<p>\s*(<img\b[^>]*>)\s*<\/p>/gi,(_m,img)=>{
    if(/style=/.test(img)) return '<p>'+img+'</p>';
    return '<p>'+img.replace(/>$/, ' loading="lazy" decoding="async" style="width:100%;max-width:720px;height:auto;display:block;margin:18px auto 24px;">')+'</p>';
  });

  // Latest-evidence section is an aside rather than another major numbered section.
  out=out.replace(
    /<h2>(최신 근거\s*·?\s*\d{4})<\/h2>\s*<blockquote>([\s\S]*?)<\/blockquote>/g,
    '<aside style="margin:28px 0 32px;padding:16px 18px;border:1px solid #dfe5ec;border-radius:8px;background:#fbfcfe;"><div style="margin:0 0 10px;font-size:12px;font-weight:800;letter-spacing:.04em;color:#2563eb;">$1</div>$2</aside>'
  );

  // Major/minor hierarchy.
  out=out.replace(/<h2>/g,ACCENT+H2);
  out=out.replace(/<h3>/g,H3);

  // Tables.
  out=out.replace(/<table>\s*([\s\S]*?)\s*<\/table>/g,(_m,inner)=>styleTable(inner));

  // Existing blockquotes become restrained editorial callouts.
  out=out.replace(/<blockquote>/g,'<blockquote style="margin:18px 0 28px;padding:16px 18px;background:#f8fafc;border-left:4px solid #334155;color:#1f2937;">');

  // External evidence links at paragraph end are separated from prose.
  out=out.replace(
    /<p>([\s\S]*?)\s+(<a href="https:\/\/(?!nhunnhun\.tistory\.com)[^"]+"[^>]*>[^<]+<\/a>)<\/p>/g,
    '<p>$1</p><p style="'+SOURCE+'">근거: $2</p>'
  );

  // FAQ cards, preserving question text while adding explicit answer label.
  out=out.replace(
    /<p><strong>Q\.\s*([^<]+)<\/strong><br\/?>([\s\S]*?)<\/p>/g,
    '<div style="margin:0 0 24px;padding:16px 18px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;"><p style="margin:0 0 8px;font-size:16px;font-weight:800;color:#111827;"><span style="display:inline-block;margin-right:6px;color:#2563eb;">Q.</span>$1</p><p style="margin:0;color:#374151;line-height:1.75;"><span style="font-weight:700;color:#6b7280;margin-right:6px;">A.</span>$2</p></div>'
  );

  // End summary.
  out=out.replace(
    /(<h2[^>]*>핵심 정리<\/h2>)\s*<ul>([\s\S]*?)<\/ul>/,
    '$1<div style="margin:0 0 12px;padding:16px 18px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;"><ul style="margin:0;padding-left:20px;line-height:1.85;">$2</ul></div>'
  );

  // Related links.
  out=out.replace(
    /(<h2[^>]*>함께 보면 좋은 글<\/h2>)((?:\s*<p><a href="https:\/\/nhunnhun\.tistory\.com\/[^"]+"><strong>[^<]+<\/strong><\/a><\/p>)+)/,
    (_m,head,block)=>{
      const cards=[...block.matchAll(/<p><a href="([^"]+)"><strong>([^<]+)<\/strong><\/a><\/p>/g)]
        .map(x=>'<div style="margin:0 0 10px;padding:14px 16px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;"><a href="'+x[1]+'" style="font-weight:800;text-decoration:none;">'+x[2]+' →</a></div>')
        .join('');
      return head+cards;
    }
  );

  // Sources are deliberately quieter.
  out=out.replace(
    /(<h2[^>]*>자료 출처<\/h2>)\s*<ul>/,
    '$1<ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.75;color:#4b5563;">'
  );

  return out;
}
