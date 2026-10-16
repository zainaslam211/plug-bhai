import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const dir=mkdtempSync(path.join(tmpdir(),'plug-bhai-tests-'));
const sql=new DatabaseSync(path.join(dir,'test.db'));sql.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+f,'utf8'));
class Statement{constructor(query,args=[]){this.query=query;this.args=args}bind(...args){return new Statement(this.query,args)}async first(){return sql.prepare(this.query).get(...this.args)||null}async all(){return {results:sql.prepare(this.query).all(...this.args)}}async run(){return {meta:sql.prepare(this.query).run(...this.args)}}}
globalThis.__testEnv={DB:{prepare:q=>new Statement(q),batch:async stmts=>{sql.exec('BEGIN IMMEDIATE');try{const results=[];for(const s of stmts)results.push(await s.run());sql.exec('COMMIT');return results}catch(e){sql.exec('ROLLBACK');throw e}}},BOOTSTRAP_ENABLED:'true',BOOTSTRAP_OWNER_EMAIL:'owner@example.test'};
await build({entryPoints:['app/api/[...path]/route.ts'],bundle:true,platform:'node',format:'esm',outfile:path.join(dir,'route.mjs'),plugins:[{name:'test-env',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'test-env',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const env=globalThis.__testEnv;',loader:'js'}))}}]});
const route=await import(path.join(dir,'route.mjs'));
await build({entryPoints:['lib/cart.ts'],bundle:true,platform:'node',format:'esm',outfile:path.join(dir,'cart.mjs')});
const {changeQuantity}=await import(path.join(dir,'cart.mjs'));
let checks=0;
async function req(endpoint,method='GET',body,who='owner'){const r=new Request('https://test.local/api/'+endpoint,{method,headers:{origin:'https://test.local','content-type':'application/json',...(who?{'oai-authenticated-user-id':who,'oai-authenticated-user-email':who+'@example.test'}:{})},body:body?JSON.stringify(body):undefined});const res=await route[method](r);return{status:res.status,data:await res.json()}}
function ok(value,msg){assert.ok(value,msg);checks++;console.log('PASS',msg)}
try{
 const bag=[{productId:'one',quantity:3},{productId:'two',quantity:2}];
 const reduced=changeQuantity(bag,0,-1);ok(reduced[0].quantity===2&&reduced[1].quantity===2,'Minus removes one unit and preserves other bag items');
 ok(bag[0].quantity===3,'Bag update does not mutate previous state');
 ok(changeQuantity([{productId:'one',quantity:1}],0,-1).length===0,'Minus on the last unit removes only that line');
 ok(changeQuantity([{productId:'one',quantity:99}],0,1)[0].quantity===99,'Plus respects maximum bag quantity');
 const store=await req('store');ok(store.data.products.length===8,'Demo catalog stored in SQL');
 ok((await req('admin/products')).status===403,'Unprovisioned identity denied admin access');
 ok((await req('bootstrap','POST',{},'attacker')).status===403,'Other identity cannot claim the first owner on a public Site');
 ok((await req('store','GET',undefined,'attacker')).data.setup===false,'Owner setup hidden from other visitors');
 ok((await req('bootstrap','POST',{})).status===200,'Private first-owner setup');
 ok((await req('bootstrap','POST',{},'attacker')).status===403,'Second account cannot claim owner');
 ok((await req('admin/products')).data.length===8,'Owner can read catalog');
 ok(!('cost' in store.data.products[0]),'Purchase cost excluded from public catalog');
 const cart={items:[{productId:'compact-30w-charger',quantity:2}],name:'Test Customer',phone:'03001234567',email:'test@example.test',city:'Lahore',address:'123 Test Street, Lahore',payment:'cod',key:crypto.randomUUID()};
 const quote=await req('quote','POST',cart,null);ok(quote.data.subtotal===499800,'Server prices ignore client price input');
 const created=await req('checkout','POST',{...cart,total:1,price:1},null);ok(created.status===201,'Guest COD checkout creates an order');
 const oid=created.data.id,token=created.data.access_token;
 ok(sql.prepare('SELECT stock FROM products WHERE id=?').get('compact-30w-charger').stock===18,'Order atomically decrements stock');
 const again=await req('checkout','POST',cart,null);ok(again.data.id===oid&&sql.prepare('SELECT count(*) n FROM orders').get().n===1,'Duplicate checkout does not duplicate order or stock use');
 ok((await req('orders/'+oid,'GET',undefined,null)).status===404,'Guest order inaccessible without token');
 ok((await req('orders/'+oid+'?token='+token,'GET',undefined,null)).data.total===quote.data.total,'Private tracking token returns correct order');
 const before=sql.prepare('SELECT count(*) n FROM orders').get().n;
 const oversell=await req('checkout','POST',{...cart,key:crypto.randomUUID(),items:[{productId:'compact-30w-charger',quantity:99}]},null);
 ok(oversell.status===400&&sql.prepare('SELECT count(*) n FROM orders').get().n===before,'Insufficient stock creates no order');
 let blocked=false;try{await globalThis.__testEnv.DB.batch([new Statement('UPDATE products SET stock=stock-99 WHERE id=?').bind('compact-30w-charger')])}catch{blocked=true}ok(blocked&&sql.prepare('SELECT stock FROM products WHERE id=?').get('compact-30w-charger').stock===18,'Database constraint prevents stale-read overselling and rolls back');
 const upd={status:'Cancelled',note:'Cancelled in test',courier:'',tracking:'',tracking_url:'',payment_status:'pending',cod_collected:0};
 ok((await req('admin/orders/'+oid,'POST',upd,'attacker')).status===403,'Unauthorized order and payment updates denied');
 ok((await req('admin/orders/'+oid,'POST',upd)).status===200,'Owner cancellation succeeds');
 ok(sql.prepare('SELECT stock FROM products WHERE id=?').get('compact-30w-charger').stock===20,'Cancellation restores inventory');
 await req('admin/orders/'+oid,'POST',upd);ok(sql.prepare('SELECT stock FROM products WHERE id=?').get('compact-30w-charger').stock===20,'Repeated cancellation does not restore stock twice');
 await req('admin/staff','POST',{id:'inventory',email:'inventory@example.test',role:'inventory'});
 ok((await req('admin/orders','GET',undefined,'inventory')).status===403,'Inventory role cannot read orders');
 ok(!(await req('admin/products','GET',undefined,'inventory')).data[0].cost,'Inventory role cannot read purchase costs');
 const coupon={code:'TEST10',kind:'percent',value:10,minimum:10000,usage_limit:1,expires:new Date(Date.now()+86400000).toISOString(),active:1};await req('admin/coupons','POST',coupon);
 const discounted=await req('checkout','POST',{...cart,key:crypto.randomUUID(),coupon:'TEST10'},null);ok(discounted.status===201,'Valid coupon used during checkout');
 ok((await req('quote','POST',{...cart,coupon:'TEST10'},null)).status===400,'Coupon usage limit enforced');
 ok((await req('checkout','POST',{...cart,key:crypto.randomUUID(),payment:'bank'},null)).status===400,'Unconfigured bank payment is rejected');
 ok((await req('checkout','POST',{...cart,key:crypto.randomUUID(),payment:'card'},null)).status===400,'Unsupported card payment cannot simulate success');
 for(const payment of ['jazzcash','easypaisa']){const response=await req('checkout','POST',{...cart,key:crypto.randomUUID(),payment},null);ok(response.status===400&&response.data.error.includes('not configured'),payment+' cannot create an unpaid fake-success order');}
 const proposal={requestKey:crypto.randomUUID(),company:'Example Accessories',contact:'Test Supplier',email:'supplier@example.test',phone:'+923001234567',city:'Lahore',website:'https://example.test',catalog:'',products:'USB-C charging accessories and cases',commissionType:'percentage',commissionValue:12.5,fulfillment:'supplier-ships',message:'Delivery and returns to be agreed.',consent:true};
 const inquiry=await req('suppliers','POST',proposal,null);ok(inquiry.status===201&&inquiry.data.reference.startsWith('SUP-'),'Supplier proposal is saved with a reference');
 ok(sql.prepare('SELECT commission_value FROM supplier_enquiries WHERE id=?').get(inquiry.data.reference).commission_value===1250,'Supplier percentage retains decimal precision');
 const retry=await req('suppliers','POST',proposal,null);ok(retry.data.reference===inquiry.data.reference&&sql.prepare('SELECT count(*) n FROM supplier_enquiries').get().n===1,'Supplier form retry does not duplicate proposal');
 ok((await req('suppliers','POST',{...proposal,requestKey:crypto.randomUUID(),commissionValue:101},null)).status===400,'Invalid commission percentage rejected');
 ok((await req('suppliers','POST',{...proposal,requestKey:crypto.randomUUID(),consent:false},null)).status===400,'Supplier contact consent required');
 ok((await req('admin/suppliers','GET',undefined,'inventory')).status===403,'Inventory staff cannot read supplier proposals');
 ok((await req('suppliers','GET',undefined,null)).status===404,'Supplier proposals are not publicly listed');
 ok((await req('admin/suppliers','GET')).data.length===1,'Owner can review supplier proposals');
 ok((await req('admin/suppliers/'+inquiry.data.reference,'POST',{status:'Reviewing',notes:'Arrange a sample inspection.'})).status===200,'Owner can update supplier review and private notes');
 ok(sql.prepare('SELECT status,notes FROM supplier_enquiries WHERE id=?').get(inquiry.data.reference).status==='Reviewing','Supplier review persists in database');
 const s=sql.prepare('SELECT count(*) n FROM orders').get().n;sql.close();const reopened=new DatabaseSync(path.join(dir,'test.db'));ok(reopened.prepare('SELECT count(*) n FROM orders').get().n===s,'Orders persist across database restart');reopened.close();
 console.log(`\n${checks} checks passed.`)
}finally{rmSync(dir,{recursive:true,force:true})}
