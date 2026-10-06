# Temporary, branch-scoped integration only; never edits articles or main.
from pathlib import Path
import hashlib,json,subprocess,sys
root=Path.cwd()
checks=json.loads((root/'.content-install-checks.json').read_text())
allowed={r['path']:r['sha256'] for r in checks}
assert len(allowed)==47
for p in allowed:
 assert not p.startswith(('posts/','updates/','publishing/state/','publishing/update-state/','skin/','css/','js/'))
 assert '..' not in Path(p).parts and not Path(p).is_absolute()
sha=lambda b:hashlib.sha256(b).hexdigest()
if sys.argv[1]=='apply':
 for group in ['docs','code']:
  for item in json.loads((root/f'.content-install-{group}.json').read_text()):
   p=item['path'];assert p in allowed and not p.startswith('.github/')
   target=root/p;raw=target.read_bytes()
   if sha(raw)==item['after']:continue
   assert sha(raw)==item['before'],f'BASE_HASH_MISMATCH {p}'
   lines=raw.decode('utf-8').splitlines(True)
   for start,end,replacement in reversed(item['edits']):lines[start:end]=replacement.splitlines(True)
   new=''.join(lines).encode('utf-8')
   assert sha(new)==item['after']==allowed[p],f'PATCH_HASH_MISMATCH {p}'
   target.write_bytes(new)
 print('PATCH_APPLY_PASS')
elif sys.argv[1] in ['verify','commit']:
 errors=[]
 for p,expected in allowed.items():
  actual=sha((root/p).read_bytes()) if (root/p).exists() else 'MISSING'
  if actual!=expected:errors.append((p,actual,expected))
 assert not errors,repr(errors)
 paths=subprocess.check_output(['git','diff','--name-only'],text=True).splitlines()+subprocess.check_output(['git','ls-files','--others','--exclude-standard'],text=True).splitlines()
 assert all(p in allowed and not p.startswith('.github/') for p in paths),repr(paths)
 print('FINAL_HASHES_PASS',len(allowed),'LOCAL_CHANGE_SCOPE_PASS',len(paths))
 if sys.argv[1]=='commit':
  assert subprocess.check_output(['git','branch','--show-current'],text=True).strip()=='work/content-standard-r1-20261007'
  subprocess.run(['git','add','--',*paths],check=True)
  subprocess.run(['git','config','user.name','github-actions[bot]'],check=True)
  subprocess.run(['git','config','user.email','41898282+github-actions[bot]@users.noreply.github.com'],check=True)
  subprocess.run(['git','commit','-m','feat(content): integrate verified R1 gates and preserve R3 articles'],check=True)
  subprocess.run(['git','push','origin','HEAD:refs/heads/work/content-standard-r1-20261007'],check=True)
else:raise SystemExit('unsupported mode')
