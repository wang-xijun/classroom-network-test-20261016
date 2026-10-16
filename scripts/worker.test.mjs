import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../worker/index.js';
const ORIGIN='https://wang-xijun.github.io';
const ROOT='https://test.workers.dev';
function fixture() {
  const sql=new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../migrations/0001_init.sql',import.meta.url),'utf8'));
  const db={prepare(query){return {bind(...values){return {async run(){return sql.prepare(query).run(...values)},async first(){return sql.prepare(query).get(...values)}}}}},withSession(){return this}};
  return {sql,env:{DB:db,ALLOWED_ORIGINS:ORIGIN,RATE_LIMITER:{limit:async()=>({success:true})},ASSETS:{fetch:async()=>new Response('static')}}};
}
function call(env,path,options={}) {return worker.fetch(new Request(ROOT+path,options),env)}
function post(env,data,origin=ORIGIN) {return call(env,'/api/probes',{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:typeof data==='string'?data:JSON.stringify(data)})}
test('real SQLite migration, separate insert/read, nonce and CORS',async()=>{
 const {sql,env}=fixture();const id=crypto.randomUUID(),marker=crypto.randomUUID();
 const ping=await call(env,'/api/ping?nonce='+id,{headers:{Origin:ORIGIN}});
 assert.equal(ping.status,200);assert.equal((await ping.json()).nonce,id);
 assert.equal(ping.headers.get('Access-Control-Allow-Origin'),ORIGIN);
 assert.equal((await post(env,{id,marker})).status,201);
 const read=await call(env,'/api/probes/'+id,{headers:{Origin:ORIGIN}});const data=await read.json();
 assert.equal(data.probe.marker,marker);assert.equal(read.headers.get('Cache-Control'),'no-store');
 assert.equal(sql.prepare('SELECT used FROM budget').get().used,1);sql.close();
});
test('forbidden browser origins, no-Origin writes and preflight headers',async()=>{
 const {sql,env}=fixture();
 assert.equal((await post(env,{id:crypto.randomUUID(),marker:crypto.randomUUID()},'https://other.example')).status,403);
 assert.equal((await post(env,{id:crypto.randomUUID(),marker:crypto.randomUUID()},null)).status,403);
 const preflight=await call(env,'/api/probes',{method:'OPTIONS',headers:{Origin:ORIGIN,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});
 assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),ORIGIN);
 assert.equal((await call(env,'/api/probes',{method:'OPTIONS',headers:{Origin:ORIGIN,'Access-Control-Request-Method':'DELETE'}})).status,403);sql.close();
});
test('body limit, invalid JSON and extra student-like fields are rejected',async()=>{
 const {sql,env}=fixture();
 assert.equal((await post(env,'x'.repeat(257))).status,413);
 assert.equal((await post(env,'{')).status,400);
 assert.equal((await post(env,{id:crypto.randomUUID(),marker:crypto.randomUUID(),name:'not accepted'})).status,400);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM probes').get().n,0);sql.close();
});
test('500 lifetime record cap is enforced in SQLite trigger',async()=>{
 const {sql,env}=fixture();const stmt=sql.prepare('INSERT INTO probes VALUES (?,?,?)');
 for(let i=0;i<500;i++)stmt.run(crypto.randomUUID(),crypto.randomUUID(),Date.now());
 const response=await post(env,{id:crypto.randomUUID(),marker:crypto.randomUUID()});
 assert.equal(response.status,429);assert.equal((await response.json()).error,'test_budget_exhausted');
 assert.equal(sql.prepare('SELECT count(*) AS n FROM probes').get().n,500);sql.close();
});
test('records expire from public read after 24 hours; unknown IDs are 404',async()=>{
 const {sql,env}=fixture();const id=crypto.randomUUID();sql.prepare('INSERT INTO probes VALUES (?,?,?)').run(id,crypto.randomUUID(),Date.now()-86400001);
 assert.equal((await call(env,'/api/probes/'+id)).status,404);
 assert.equal((await call(env,'/api/probes/'+crypto.randomUUID())).status,404);sql.close();
});
test('rate limiter and missing binding fail closed',async()=>{
 const {sql,env}=fixture();env.RATE_LIMITER.limit=async()=>({success:false});
 assert.equal((await call(env,'/api/ping?nonce='+crypto.randomUUID())).status,429);
 delete env.RATE_LIMITER;assert.equal((await call(env,'/api/ping?nonce='+crypto.randomUUID())).status,503);sql.close();
});
test('same-origin direct page and static assets work',async()=>{
 const {sql,env}=fixture();assert.equal(await (await call(env,'/')).text(),'static');
 assert.equal((await post(env,{id:crypto.randomUUID(),marker:crypto.randomUUID()},ROOT)).status,201);sql.close();
});
