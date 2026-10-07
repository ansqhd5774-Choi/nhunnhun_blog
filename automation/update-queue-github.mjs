import { statePath } from './update-queue-core.mjs';
const REPO='ansqhd5774-Choi/nhunnhun_blog';
export class QueueRepository {
  constructor(env=process.env,{fetcher=fetch}={}) {
    if(env.GITHUB_REPOSITORY!==REPO || !env.GITHUB_TOKEN) throw new Error('E_QUEUE_GITHUB_CONFIGURATION');
    this.token=env.GITHUB_TOKEN;this.fetcher=fetcher;
  }
  async api(path,{method='GET',body,missing=false}={}) {
    const response=await this.fetcher(`https://api.github.com/repos/${REPO}/${path}`,{method,headers:{Authorization:`Bearer ${this.token}`,Accept:'application/vnd.github+json','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(45000)});
    if(missing && response.status===404) return null;
    if(!response.ok) throw new Error(`E_QUEUE_GITHUB_${response.status}`);
    return response.status===204?null:response.json();
  }
  async file(path,ref='main') {
    if(!/^(automation|updates|content-reviews|publishing\/update-state)\/[a-zA-Z0-9_./-]+\.json$/.test(path) || path.includes('..')) throw new Error('E_QUEUE_PATH');
    return this.api(`contents/${path}?ref=${encodeURIComponent(ref)}`,{missing:true});
  }
  async read(path,ref='main') {const file=await this.file(path,ref);return file?JSON.parse(Buffer.from(file.content,'base64').toString('utf8')):null;}
  async save(path,record) {
    const previous=await this.file(path);
    await this.api(`contents/${path}`,{method:'PUT',body:{message:`queue checkpoint: ${record.itemId}`,branch:'main',content:Buffer.from(JSON.stringify(record,null,2)+'\n').toString('base64'),...(previous?{sha:previous.sha}:{})}});
  }
  async updateRuns() {return (await this.api('actions/workflows/update-posts.yml/runs?per_page=100')).workflow_runs;}
  async submissionCommit(item) {return (await this.api(`commits?sha=main&path=${encodeURIComponent(statePath(item))}&per_page=1`))[0]?.sha;}
  async operationalSources() {
    const {object}=await this.api('git/ref/heads/main');
    this.operationalSha=object.sha;
    const {tree}=await this.api(`git/trees/${object.sha}?recursive=1`);
    const paths=tree.map(x=>x.path).filter(path=>/^updates\/[a-z0-9-]+\.json$/.test(path));
    const sources=await Promise.all(paths.map(path=>this.read(path,object.sha)));
    const records=await Promise.all(sources.map(source=>this.read(`publishing/update-state/${source.id}.json`,object.sha)));
    return {sources,ledgers:Object.fromEntries(sources.map((source,i)=>[source.id,records[i]]))};
  }
  async submit(item,bundle,previous,record) {
    const {object}=await this.api('git/ref/heads/main');
    if(object.sha!==this.operationalSha) throw new Error('E_QUEUE_SOURCE_DRIFT');
    const parent=await this.api(`git/commits/${object.sha}`);
    const changes=[];
    const add=(path,value)=>changes.push({path,mode:'100644',type:'blob',content:JSON.stringify(value,null,2)+'\n'});
    for(const source of previous) {
      if(source.id===bundle.source.id) throw new Error('E_QUEUE_EXISTING_SOURCE_REQUIRES_REVIEW');
      const current=await this.read(`updates/${source.id}.json`,object.sha);
      if(JSON.stringify(current)!==JSON.stringify(source)) throw new Error('E_QUEUE_SOURCE_DRIFT');
      add(`automation/update-source-archive/${source.id}.json`,source);
      changes.push({path:`updates/${source.id}.json`,mode:'100644',type:'blob',sha:null});
      const review=await this.read(`content-reviews/updates/${source.id}.json`,object.sha);
      if(review) {
        add(`automation/update-review-archive/${source.id}.json`,review);
        changes.push({path:`content-reviews/updates/${source.id}.json`,mode:'100644',type:'blob',sha:null});
      }
    }
    add(`updates/${bundle.source.id}.json`,bundle.source);
    add(`content-reviews/updates/${bundle.source.id}.json`,bundle.review);
    add(statePath(item),record);
    const tree=await this.api('git/trees',{method:'POST',body:{base_tree:parent.tree.sha,tree:changes}});
    const commit=await this.api('git/commits',{method:'POST',body:{message:`feat(content): queue ${item.id} 검토 완료 수정 원문 제출`,tree:tree.sha,parents:[object.sha]}});
    await this.api('git/refs/heads/main',{method:'PATCH',body:{sha:commit.sha,force:false}});
  }
  async dispatch() {await this.api('actions/workflows/update-posts.yml/dispatches',{method:'POST',body:{ref:'main',inputs:{update:'true'}}});}
}
