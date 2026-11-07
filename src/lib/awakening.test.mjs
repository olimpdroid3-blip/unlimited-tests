import test from 'node:test';
import assert from 'node:assert/strict';
import {parseScoutingPosition,awakeningLabel,formatScoutingReply,prepareAwakeningArchive,executeAwakeningReset} from './awakening.ts';
import {routeScoutingMessage} from './awakening-routing.ts';
import {TOWER_CHAT_ID,TOWER_WORK_THREAD_ID} from './tower-form.ts';

test('strict valid positions, whitespace, limits and unrelated prose',()=>{
  for(const s of ['1 1 1','1.1.1','1-1-1',' 1 . 1 . 1 ']) assert.equal(parseScoutingPosition(s),'1.1.1');
  for(const s of ['5.1.1','1.7.1','1.1.3','111','tower 1.1.1','1.1.1 more']) assert.equal(parseScoutingPosition(s),null);
});
test('unknown awakening stays unknown, literal player strings cannot add lines',()=>{
  assert.equal(awakeningLabel(null),'невідомо');assert.equal(awakeningLabel(0),'A0');
  const report={player_name:'<a>name</a>\nforged',total_bp:10,heroes:[{name:'*[name](url)',bp:2,awakening:null}],captured_at:null,received_at:null};
  const result=formatScoutingReply('1.1.1',report);
  assert.match(result,/<a>name<\/a> forged/);assert.match(result,/невідомо/);
  assert.equal((result.match(/^\d\./gm)||[]).length,5);
  assert.match(formatScoutingReply('1.1.1'),/ще немає/);
});
const message={chatId:TOWER_CHAT_ID,threadId:TOWER_WORK_THREAD_ID,userId:123,text:'1 1 1',formHandled:false};
test('other chats, topics, missing actor and handled forms perform no IO',async()=>{
  for(const patch of [{chatId:123},{threadId:4},{threadId:108},{userId:0},{formHandled:true},{text:'hello'}]) {
    let touched=false;const io={handleInteractive:async()=>{touched=true;return false;},read:async()=>{touched=true;},send:async()=>{touched=true;}};
    assert.equal(await routeScoutingMessage({...message,...patch},io),false);assert.equal(touched,false);
  }
});
test('active interactive form takes precedence over scouting DB reads',async()=>{
  const calls=[];assert.equal(await routeScoutingMessage(message,{handleInteractive:async()=>true,read:async()=>{calls.push('read');},send:async()=>{calls.push('send');}}),true);
  assert.deepEqual(calls,[]);
});
test('empty data and DB failures produce distinct replies',async()=>{
  for(const failure of [false,true]) {
    let reply;await routeScoutingMessage(message,{handleInteractive:async()=>false,read:async()=>{if(failure)throw new Error('private');return {reports:[]};},send:async s=>{reply=s;}});
    assert.match(reply,failure?/Не вдалося/:/ще немає/);assert.ok(!reply.includes('private'));
  }
});
const snapshot={match_id:'old',towers:[{tower_id:'1.1.1',nickname:'Alice',notes:'first',placed:true,do_not_attack:true,participants:[{nickname:'Alice',comment:'first'}]},{tower_id:'1.1.2',nickname:'Bob',notes:'second',placed:true},{tower_id:'M:1.1.1',nickname:'marker'}],variants:[{tower_id:'1.1.1',variant:1},{tower_id:'1.1.2',variant:1},{tower_id:'2.1.1',variant:2}]};
test('archive preserves grouped participants, variants, status and variant-only cells, excludes markers',()=>{
  const original=structuredClone(snapshot);const rows=prepareAwakeningArchive(snapshot);
  assert.equal(rows.length,3);assert.deepEqual(rows[0].participants,[{nickname:'Alice',comment:'first'},{nickname:'Bob',comment:'second'}]);
  assert.equal(rows[0].do_not_attack,true);assert.equal(rows[2].defense_variant,2);assert.equal(rows[2].placed,false);
  for(const row of rows){assert.equal(row.screenshot_url,null);assert.ok(!row.tower_id.startsWith('M:'));assert.equal(typeof row.destroyed,'boolean');}
  assert.deepEqual(snapshot,original);
});
test('atomic reset sends exact server snapshot; cleanup begins only after commit',async()=>{
  const calls=[];const result=await executeAwakeningReset(async(name,args)=>{
    calls.push(name);if(name==='awakening_tower_reset_snapshot')return snapshot;
    assert.strictEqual(args.p_snapshot,snapshot);assert.equal(args.p_archive_rows.length,3);
    return {ok:true,match_id:'new',screenshot_paths:['a.png']};
  },async paths=>{calls.push('cleanup');assert.deepEqual(paths,['a.png']);});
  assert.equal(result.match_id,'new');assert.equal(result.cleanupWarning,null);
  assert.deepEqual(calls,['awakening_tower_reset_snapshot','awakening_clear_towers','cleanup']);
});
test('transaction conflict never cleans storage; postcommit cleanup failure remains success',async()=>{
  let cleaned=false;await assert.rejects(executeAwakeningReset(async name=>{if(name==='awakening_tower_reset_snapshot')return snapshot;throw new Error('TOWERS_CHANGED');},async()=>{cleaned=true;}),/TOWERS_CHANGED/);
  assert.equal(cleaned,false);
  const result=await executeAwakeningReset(async name=>name==='awakening_tower_reset_snapshot'?snapshot:{ok:true,match_id:'new',screenshot_paths:['a']},async()=>{throw new Error('storage');});
  assert.equal(result.ok,true);assert.ok(result.cleanupWarning);
});
test('empty match still executes the reset RPC',async()=>{
  const calls=[];await executeAwakeningReset(async(name,args)=>{calls.push(name);return name==='awakening_tower_reset_snapshot'?{match_id:'old',towers:[],variants:[]}:{ok:true,match_id:'new',screenshot_paths:[]};},async()=>assert.fail());
  assert.equal(calls.length,2);
});
