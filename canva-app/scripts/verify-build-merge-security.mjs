import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const req=createRequire(resolve('package.json'));
const merge=createRequire(req.resolve('@svgr/plugin-svgo'))('deepmerge');
const payload=()=>JSON.parse('{"safe":{"value":1},"__proto__":{"auditProbe":true}}');
const cases=[()=>merge(Object.create(null),payload()),()=>merge(payload(),{}),()=>merge({nested:null},{nested:payload()}).nested,()=>merge({}, {nested:payload()}).nested];
const lock=JSON.parse(readFileSync('package-lock.json'));
const nodes=Object.entries(lock.packages).filter(([key])=>key.endsWith('/deepmerge'));
assert(nodes.length>0);
for(const [key,pkg] of nodes){assert.equal(pkg.name,'@stackline/deepmerge',key);assert.equal(pkg.version,'1.1.0',key);assert.equal(pkg.integrity,'sha512-bEQ1EpXrlu9PTTgKD9z85MWYGjDMv79fF2qn2LYdmukpuj6onkn5kZlRAu0PaZvUv9ZQerwtDVgIEn2LYtsE7w==',key);}
for(const run of cases){const result=run();assert.equal(result.auditProbe,undefined);assert.equal(Object.hasOwn(result,'__proto__'),false);assert.equal(Object.getPrototypeOf(result),Object.prototype);assert.deepEqual(result.safe,{value:1});}
let reads=0;const hostile={safe:true};Object.defineProperty(hostile,'__proto__',{enumerable:true,get(){reads++;throw Error('unsafe getter read');}});merge(hostile,{});merge(Object.create(null),hostile);assert.equal(reads,0);
assert.equal({}.auditProbe,undefined);
const target={items:[{a:1}],nested:{left:true}},source={items:[{b:2}],nested:{right:true}};
assert.deepEqual(merge(target,source),{items:[{a:1},{b:2}],nested:{left:true,right:true}});
assert.deepEqual(merge(target,source,{arrayMerge:(_a,b)=>b}),{items:[{b:2}],nested:{left:true,right:true}});
assert.deepEqual(merge.all([{a:1},{b:2}]),{a:1,b:2});
assert.deepEqual(merge({x:{a:1}},{x:{b:2}},{customMerge:key=>key==='x'?()=>({custom:true}):undefined}),{x:{custom:true}});
assert.deepEqual(target,{items:[{a:1}],nested:{left:true}});assert.deepEqual(source,{items:[{b:2}],nested:{right:true}});
const date=new Date(0),regexp=/safe/,symbol=Symbol('safe');assert.equal(merge({},{date}).date,date);assert.equal(merge({},{regexp}).regexp,regexp);assert.equal(merge({},{[symbol]:1})[symbol],1);
for(const consumer of ['@svgr/plugin-svgo','@rsbuild/plugin-svgr']) {const consumerRequire=createRequire(req.resolve(consumer));const consumerMerge=consumerRequire('deepmerge');for(const result of [consumerMerge(Object.create(null),payload()),consumerMerge(payload(),{})]){assert.equal(result.auditProbe,undefined,consumer);assert.equal(Object.getPrototypeOf(result),Object.prototype,consumer);}}
const {transform}=req('@svgr/core');
const svgo=req('@svgr/plugin-svgo'),jsx=req('@svgr/plugin-jsx');
const output=await transform('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M2 2h20v20H2z"/></svg>',{plugins:[svgo.default??svgo,jsx.default??jsx],svgoConfig:{plugins:[{name:'preset-default',params:{overrides:{removeViewBox:false}}}]},typescript:true},{componentName:'AuditSvg'});
assert.match(output,/viewBox="0 0 24 24"/);assert.match(output,/<path/);assert.match(output,/AuditSvg/);
console.log('GREEN: prototype attacks, unsafe getters, API compatibility, all installed merge copies and real SVGR transform passed');
