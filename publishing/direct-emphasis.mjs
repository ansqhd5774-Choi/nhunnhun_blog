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
