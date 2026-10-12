import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {CoupangPartnersClient} from '../publishing/coupang-partners.mjs';

function usage(){
  throw new Error('사용법: node scripts/coupang-partners.mjs search <검색어> | deeplink <쿠팡 상품 URL 1~3개>');
}

export async function runCli(args=process.argv.slice(2),env=process.env){
  const [argCommand,...argsValues]=args;
  const command=argCommand||env.COUPANG_OPERATION;
  const values=argsValues;
  const client=new CoupangPartnersClient({
    accessKey:env.COUPANG_ACCESS_KEY,
    secretKey:env.COUPANG_SECRET_KEY,
    rateStatePath:env.COUPANG_RATE_STATE_PATH,
  });
  if(command==='search'&&values.length){
    const result=await client.searchProducts(values.join(' '));
    const products=result.products.map(item=>({
      name:item.productName??null,
      price:item.productPrice??null,
      coupangUrl:item.productUrl??null,
      imageUrl:item.productImage??null,
    }));
    return {products,landingUrl:result.landingUrl};
  }
  if(command==='search'&&env.COUPANG_SEARCH_KEYWORD){
    const result=await client.searchProducts(env.COUPANG_SEARCH_KEYWORD);
    return {products:result.products.map(item=>({name:item.productName??null,price:item.productPrice??null,coupangUrl:item.productUrl??null,imageUrl:item.productImage??null})),landingUrl:result.landingUrl};
  }
  if(command==='deeplink'&&values.length>=1&&values.length<=3){
    return (await client.createDeeplinks(values)).map(item=>({landingUrl:item.landingUrl}));
  }
  if(command==='deeplink'&&env.COUPANG_PRODUCT_URLS){
    const urls=env.COUPANG_PRODUCT_URLS.split(/\r?\n/).map(value=>value.trim()).filter(Boolean);
    return (await client.createDeeplinks(urls)).map(item=>({landingUrl:item.landingUrl}));
  }
  usage();
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{process.stdout.write(JSON.stringify(await runCli(),null,2)+'\n');}
  catch(error){process.stderr.write(`${error instanceof Error?error.message:'E_COUPANG_UNKNOWN'}\n`);process.exitCode=1;}
}
