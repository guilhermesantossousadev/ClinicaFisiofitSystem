import {createHash} from 'node:crypto';
import {readdirSync,readFileSync} from 'node:fs';
import {resolve,relative} from 'node:path';
export function sourceDigest(root=process.cwd()){
 const files=[];function walk(dir){for(const f of readdirSync(dir,{withFileTypes:true})){const path=resolve(dir,f.name);if(f.isDirectory())walk(path);else if(/\.(tsx?|css)$/.test(f.name)&&!f.name.includes('.test.'))files.push(path);}}
 walk(resolve(root,'apps/portal/src'));walk(resolve(root,'packages/design-system/src'));files.push(resolve(root,'packages/design-system/package.json'));
 const hash=createHash('sha256');for(const path of files.sort()){hash.update(relative(root,path));hash.update('\0');hash.update(readFileSync(path));hash.update('\0');}return hash.digest('hex');
}
