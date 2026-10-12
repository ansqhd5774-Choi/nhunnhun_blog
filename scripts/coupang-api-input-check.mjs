try{
  const [major,minor]=process.versions.node.split('.').map(Number);
  if(major<20||(major===20&&minor<15))throw Error('E_COUPANG_NODE_VERSION');
  const operation=process.env.COUPANG_OPERATION;
  if(operation==='search'){
    const keyword=String(process.env.COUPANG_SEARCH_KEYWORD||'').trim();
    if(!keyword||keyword.length>100||/[\r\n]/.test(keyword))throw Error('E_COUPANG_KEYWORD');
    if(process.env.COUPANG_PRODUCT_URLS?.trim())throw Error('E_COUPANG_UNEXPECTED_URLS');
  }else if(operation==='deeplink'){
    if(String(process.env.COUPANG_SEARCH_KEYWORD||'').trim())throw Error('E_COUPANG_UNEXPECTED_KEYWORD');
    const urls=String(process.env.COUPANG_PRODUCT_URLS||'').split(/\r?\n/).map(value=>value.trim()).filter(Boolean);
    if(urls.length<1||urls.length>3)throw Error('E_COUPANG_LINK_COUNT');
    for(const value of urls){let url;try{url=new URL(value);}catch{throw Error('E_COUPANG_PRODUCT_URL');}if(url.protocol!=='https:'||url.hostname!=='www.coupang.com'||url.username||url.password)throw Error('E_COUPANG_PRODUCT_URL');}
  }else throw Error('E_COUPANG_OPERATION');
  console.log(`PASS_COUPANG_INPUT: ${operation}`);
}catch(error){
  const code=/^E_COUPANG_[A-Z0-9_]+$/.test(error?.message||'')?error.message:'E_COUPANG_INPUT';
  console.error(code);process.exitCode=1;
}
