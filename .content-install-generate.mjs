import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=process.cwd();
const base='2071cb47077a0555ae79e65a2cb08dbc704af975';
const old=execFileSync('git',['show',base+':publishing/editorial.mjs'],{encoding:'utf8'});
const {renderEditorialPost}=await import('data:text/javascript;base64,'+Buffer.from(old).toString('base64'));
const hash=s=>createHash('sha256').update(s).digest('hex');
const rows=[];
for(const kind of ['posts','updates'])for(const n of readdirSync(kind).filter(n=>n.endsWith('.json')).sort()){
 const path=kind+'/'+n,raw=readFileSync(path,'utf8'),entry={path,sourceSha256:hash(raw)};
 try{entry.renderSha256=hash(renderEditorialPost(JSON.parse(raw)));}catch(error){entry.error=error.message;}
 rows.push(entry);
}
writeFileSync('tests/fixtures/content-r1/legacy-render-hashes.json',JSON.stringify(rows,null,2)+'\n');
const {MODULES,EXTENSIONS}=await import('file://'+root+'/publishing/standards/common.mjs');
const {DOMAIN_RULES}=await import('file://'+root+'/publishing/content-standards.mjs');
let out='# 질문 모듈 목록 R1\n\n모듈은 소제목 개수 규정이 아니다. 관련 질문을 한 섹션에서 함께 설명하고 실제 답변·출처를 연결한다. Core는 필수, 확장은 적용 검토 후 선택한다.\n\n';
out+='| ID | 독자에게 답할 내용 | Core 적용 분야 |\n| --- | --- | --- |\n';
for(const [id,label]of Object.entries(MODULES))out+=`| ${id} | ${label} | ${Object.values(DOMAIN_RULES).filter(rule=>rule.core.includes(id)).map(rule=>rule.domain).join(', ')||'조건부'} |\n`;
out+='\n## 매 글에서 적용 여부와 이유를 기록할 확장\n\n| 확장 ID | 적용 시 요구되는 질문 |\n| --- | --- |\n';
for(const [id,modules]of Object.entries(EXTENSIONS))out+=`| ${id} | ${modules.join(', ')} |\n`;
out+='\n알려진 종합 안내 프로필은 `publishing/standards/common.mjs`의 TOPIC_EXTENSIONS를 따른다. 새 프로필·모듈 변경 시 이 목록과 테스트를 함께 갱신한다. 모든 false 또는 무의미한 이유로 범위를 줄이지 않는다. 관련 없다고 검토한 질문을 본문에 억지로 작성하지도 않는다.\n';
writeFileSync('docs/content/MODULE_CATALOG_R1.md',out);
console.log('GENERATED',rows.length,'legacy fixtures',Object.keys(MODULES).length,'modules');
