import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { createRequire } from 'node:module';
const { z } = createRequire(new URL('../apps/portal/package.json', import.meta.url))('zod');
const source = await readFile(new URL('../supabase/functions/api/patient-schema.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source.replace(/^import .*\n/, '').replace('export const patientSchema', 'const patientSchema'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const schema = new Function('z', `${js}; return patientSchema;`)(z);
const minimum = { primary_unit_id: 'e9000000-0000-4000-8000-000000000020', name: 'Artificial patient' };
test('patient creation accepts omitted, blank and null optional fields', () => {
  assert.equal(schema.parse(minimum).name, minimum.name);
  for (const field of ['cpf','birth_date','phone','email','notes']) {
    for (const value of [null, '', '   ']) assert.equal(schema.parse({...minimum,[field]:value})[field], null);
  }
});
test('patient edit distinguishes clearing fields from leaving them unchanged', () => {
  const edit = schema.partial();
  assert.deepEqual(edit.parse({email:null,birth_date:null,notes:''}), {email:null,birth_date:null,notes:null});
  assert.deepEqual(edit.parse({name:'  Artificial updated  '}), {name:'Artificial updated'});
});
test('invalid dates, email, short names and absent units are rejected with helpful messages', () => {
  for (const input of [{...minimum,birth_date:'2026-02-30'}, {...minimum,email:'invalid'}, {...minimum,name:' A '}, {...minimum,primary_unit_id:''}]) {
    const result = schema.safeParse(input);
    assert.equal(result.success,false);
    assert.match(result.error.issues[0].message,/Informe|Selecione/);
  }
});

const routeSource = await readFile(new URL('../supabase/functions/api/routes/pacientes.ts', import.meta.url), 'utf8');
const routeJs = ts.transpileModule(routeSource.replace(/^import .*\n/, '').replace('export function registerPacientesRoutes', 'function registerPacientesRoutes'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const register = new Function('z', `${routeJs}; return registerPacientesRoutes;`)(z);
async function patientRequest(method, input, {unitAccess=true, current={primary_unit_id:minimum.primary_unit_id}, dbError=null} = {}) {
  const handlers = new Map();
  let written;
  const query = {
    select() { return this; }, eq() { return this; }, is() { return this; },
    insert(value) { written=value; return this; }, update(value) { written=value; return this; },
    async maybeSingle() { return {data:current,error:null}; },
    async single() { return {data:{id:minimum.primary_unit_id,...written},error:dbError}; },
  };
  const app = Object.fromEntries(['get','post','patch','delete'].map(verb => [verb,(path,_guard,handler) => handlers.set(`${verb}:${path}`,handler)]));
  register(app, {
    patientSchema:schema,requireRoles:()=>()=>{},hasUnitAccess:async()=>unitAccess,
    fail:(_ctx,status,code,message)=>({status,code,message}),
    databaseResult:(_ctx,data,error,status=200)=>({status,data,error}),audit:async()=>{},
  });
  const context={req:{json:async()=>input,param:()=>minimum.primary_unit_id},get:key=>({profile:{clinic_id:minimum.primary_unit_id},db:{from:()=>query}}[key])};
  const result=await handlers.get(`${method}:${method==='post'?'/patients':'/patients/:id'}`)(context);
  return {result,written};
}
test('POST patient writes validated data under current clinic', async()=> {
  const {result,written}=await patientRequest('post',minimum);
  assert.equal(result.status,201);
  assert.equal(written.clinic_id,minimum.primary_unit_id);
});
test('PATCH patient clears fields in the actual handler', async()=> {
  const {written}=await patientRequest('patch',{email:'',birth_date:null,phone:null});
  assert.equal(written.email,null);
  assert.equal(written.birth_date,null);
  assert.equal(written.phone,null);
  assert.equal('name' in written,false);
});
test('patient writes reject inaccessible unit, missing patient and duplicate CPF', async()=> {
  for(const method of ['post','patch']) assert.equal((await patientRequest(method,minimum,{unitAccess:false})).result.status,403);
  assert.equal((await patientRequest('patch',{name:'Artificial change'},{current:null})).result.status,404);
  for(const method of ['post','patch']) assert.equal((await patientRequest(method,minimum,{dbError:{code:'23505'}})).result.code,'PATIENT_DUPLICATE');
});
