import { readFileSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const kind = process.argv[2];
if (!['posts','updates'].includes(kind)) throw new Error('E_MUTATION_GATE_KIND');

const eventName = process.env.GITHUB_EVENT_NAME || '';
const eventPath = process.env.GITHUB_EVENT_PATH;
const sha = process.env.GITHUB_SHA || '';
const requested = String(process.env.MUTATION_REQUESTED || '').toLowerCase() === 'true';

let shouldMutate = false;

if (eventName === 'workflow_dispatch') {
  shouldMutate = requested;
} else if (eventName === 'push' && kind !== 'updates') {
  const event = eventPath ? JSON.parse(readFileSync(eventPath,'utf8')) : {};
  const before = event.before || '';
  let changed = '';
  if (/^[0-9a-f]{40}$/i.test(before) && !/^0{40}$/.test(before)) {
    changed = execFileSync('git',['diff','--name-only',before,sha],{encoding:'utf8'});
  } else {
    changed = execFileSync('git',['diff-tree','--no-commit-id','--name-only','-r',sha],{encoding:'utf8'});
  }
  const pattern = kind === 'posts' ? /^posts\/[^/]+\.json$/ : /^updates\/[^/]+\.json$/;
  shouldMutate = changed.split(/\r?\n/).some(path => pattern.test(path.trim()));
}

const value = shouldMutate ? 'true' : 'false';
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `should_mutate=${value}\n`);
console.log(`MUTATION_GATE_${kind.toUpperCase()}=${value}`);
