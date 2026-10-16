import assert from 'node:assert/strict';
const base=process.argv[2];
if(!base)throw new Error('Usage: node scripts/http-check.mjs ACTUAL_ORIGIN');
const origin='https://wang-xijun.github.io';
async function call(path,options={}) { const t=performance.now();const response=await fetch(base+path,{...options,signal:AbortSignal.timeout(15000)});console.log(options.method||'GET',path,response.status,Math.round(performance.now()-t)+'ms');return response; }
const home=await call('/');assert.equal(home.status,200);assert.match(await home.text(),/课堂网络/);
const id=crypto.randomUUID(),marker=crypto.randomUUID();
const ping=await call('/api/ping?nonce='+id,{headers:{Origin:origin}});assert.equal(ping.status,200);assert.equal((await ping.json()).nonce,id);
const preflight=await call('/api/probes',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),origin);
const inserted=await call('/api/probes',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({id,marker})});assert.equal(inserted.status,201);
const read=await call('/api/probes/'+id,{headers:{Origin:origin}});assert.equal(read.status,200);const data=await read.json();assert.equal(data.probe.marker,marker);assert.equal(data.probe.id,id);
const denied=await call('/api/ping?nonce='+id,{headers:{Origin:'https://unapproved.example'}});assert.equal(denied.status,403);assert.equal(denied.headers.get('Access-Control-Allow-Origin'),null);
console.log('HTTP page/API/CORS and separate database write/read checks passed.');
