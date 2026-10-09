import {parseDocument} from 'htmlparser2';

// Structural omission guard only; the author still chooses meaningful phrases.
export function assertDirectEmphasis(source) {
  if(!source.id?.startsWith('direct-'))return;
  const contains=(node,name)=>(node.children??[]).some(child=>child.name===name||contains(child,name));
  let emphasized=false;
  const visit=node=>{
    if(node.name==='mark'&&contains(node,'strong'))emphasized=true;
    for(const child of node.children??[])visit(child);
  };
  visit(parseDocument(source.bodyHtml??''));
  if(!emphasized)throw Error('E_DIRECT_EMPHASIS_MISSING');
}

// New submission preparation only. Historical read-only loading keeps its existing guard.
export function assertDirectSubmissionEmphasis(source) {
  if(source.contentStandard!=='SP1'||!source.id?.startsWith('direct-'))return;
  assertDirectEmphasis(source);
  const visit=node=>{
    if(node.name==='mark') {
      const children=(node.children??[]).filter(n=>n.type!=='comment' && !(n.type==='text'&&!n.data.trim()));
      const inner=children[0];
      const underlined=inner?.name==='u';
      const boldChildren=underlined?(inner.children??[]).filter(n=>n.type!=='comment' && !(n.type==='text'&&!n.data.trim())):children;
      if(children.length!==1||boldChildren.length!==1||boldChildren[0].name!=='strong')throw Error('E_DIRECT_EMPHASIS_STRUCTURE');
    }
    for(const child of node.children??[])visit(child);
  };
  visit(parseDocument(source.bodyHtml??''));
}
