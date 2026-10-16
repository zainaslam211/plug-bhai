import {existsSync,readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));process.chdir(root);
if(Number(process.versions.node.split('.')[0])<24)throw new Error('Use Node.js 24 or newer for this export.');
if(!existsSync('node_modules/vinext'))throw new Error('Install dependencies first: npx pnpm@11.25.0 install --frozen-lockfile');
mkdirSync('.sites-runtime',{recursive:true});
writeFileSync('.sites-runtime/execution-profile.json',JSON.stringify({executionProfile:'portable'}));
if(!existsSync('.dev.vars'))writeFileSync('.dev.vars','# LOCAL DEVELOPMENT ONLY. Disable before any public hosting.\nBOOTSTRAP_ENABLED=true\nBOOTSTRAP_OWNER_EMAIL=seedy@sites.test\n');
function run(args){const r=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)process.exit(r.status||1)}
run(['scripts/run-framework.mjs','build']);
mkdirSync('.wrangler',{recursive:true});
const state='.wrangler/plug-bhai-migrations.json';
const done=existsSync(state)?JSON.parse(readFileSync(state,'utf8')):[];
for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort()){
 if(done.includes(file))continue;
 console.log('Applying local migration: '+file);
 run(['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','dist/server/wrangler.json','--persist-to','.wrangler/state','--file',path.join('drizzle',file)]);
 done.push(file);writeFileSync(state,JSON.stringify(done,null,2));
}
console.log('\nLocal setup complete. Run npm run dev, then open http://localhost:5173.');
console.log('For admin, open /admin and use the local development sign-in. See SETUP-GUIDE.md.');
