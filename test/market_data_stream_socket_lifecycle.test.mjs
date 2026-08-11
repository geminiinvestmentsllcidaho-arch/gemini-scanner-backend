import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { startMarketDataStream } from '../src/market_data_stream.js';
class FakeWS extends EventEmitter {
  static OPEN=1; static instances=[];
  constructor(){ super(); this.readyState=0; this.sent=[]; this.closeCalls=0; FakeWS.instances.push(this); }
  send(v){ this.sent.push(JSON.parse(v)); }
  open(){ this.readyState=1; this.emit('open'); }
  close(){ this.closeCalls++; this.readyState=3; this.emit('close',1000,Buffer.from('closed')); }
}
function runtime(){
  const timeouts=[], intervals=[];
  return { timeouts, intervals, api:{ WebSocketImpl:FakeWS, skipInitialFetches:true, nowFn:()=>Date.parse('2026-07-17T15:00:00Z'), setTimeoutFn:(fn,delay)=>(timeouts.push({fn,delay,cleared:false}),timeouts.at(-1)), clearTimeoutFn:t=>{t.cleared=true}, setIntervalFn:(fn,delay)=>(intervals.push({fn,delay,cleared:false}),intervals.at(-1)), clearIntervalFn:t=>{t.cleared=true} } };
}
test('close schedules one reconnect and reconnects', async()=>{
  FakeWS.instances.length=0; const r=runtime();
  const stream=await startMarketDataStream({runtime:r.api}); const ws=FakeWS.instances[0]; ws.open();
  ws.emit('close',1006,Buffer.from('network')); ws.emit('close',1006,Buffer.from('duplicate'));
  assert.equal(r.timeouts.length,1); assert.equal(r.timeouts[0].delay,1000);
  r.timeouts[0].fn(); assert.equal(FakeWS.instances.length,2); stream.stop();
});
test('error closes socket and close event schedules reconnect', async()=>{
  FakeWS.instances.length=0; const r=runtime();
  const stream=await startMarketDataStream({runtime:r.api}); const ws=FakeWS.instances[0]; ws.open(); ws.emit('error',new Error('boom'));
  assert.equal(ws.closeCalls,1); assert.equal(r.timeouts.length,1); stream.stop();
});
test('manual stop clears timers and suppresses reconnect', async()=>{
  FakeWS.instances.length=0; const r=runtime();
  const stream=await startMarketDataStream({runtime:r.api}); const ws=FakeWS.instances[0]; ws.open(); stream.stop();
  assert.equal(r.intervals.length,1); assert.equal(r.intervals[0].cleared,true); assert.equal(r.timeouts.length,0); assert.equal(ws.closeCalls,1);
});

test('authoritative market clock refresh updates exposed session state and clears its timer on stop', async () => {
  FakeWS.instances.length = 0;
  const timeouts = [];
  const intervals = [];
  const marketStates = [false, true];

  const runtime = {
    WebSocketImpl: FakeWS,
    nowFn: () => Date.parse('2026-11-27T18:30:00.000Z'),
    marketOpenFn: async () => marketStates.shift(),
    marketClockEveryMs: 60_000,
    setTimeoutFn(fn, delay) {
      const token = { fn, delay, cleared: false };
      timeouts.push(token);
      return token;
    },
    clearTimeoutFn(token) {
      if (token) token.cleared = true;
    },
    setIntervalFn(fn, delay) {
      const token = { fn, delay, cleared: false };
      intervals.push(token);
      return token;
    },
    clearIntervalFn(token) {
      if (token) token.cleared = true;
    },
  };

  const stream = await startMarketDataStream({ symbols: ['AAPL'], runtime });
  assert.equal(stream.open, false);
  assert.equal(intervals.length, 2);

  const marketClockTimer = intervals.find((token) => token.delay === 60_000);
  assert.ok(marketClockTimer);

  await marketClockTimer.fn();
  assert.equal(stream.open, true);

  stream.stop();
  assert.equal(marketClockTimer.cleared, true);
  assert.equal(intervals.every((token) => token.cleared), true);
  assert.equal(timeouts.length, 0);
});


test('dynamically subscribes newly requested symbols without reconnecting', async () => {
  FakeWS.instances.length=0; const r=runtime()
  const stream=await startMarketDataStream({symbols:['AAPL'],runtime:r.api})
  const ws=FakeWS.instances.at(-1)
  ws.open()
  ws.emit('message',JSON.stringify([{T:'success',msg:'authenticated'}]))
  const before=ws.sent.length
  const result=stream.addSymbols(['BTG','AAPL'])
  assert.deepEqual(result.added,['BTG'])
  assert.equal(ws.sent.length,before+1)
  assert.deepEqual(ws.sent.at(-1),{action:'subscribe',quotes:['BTG'],bars:['BTG']})
  stream.stop()
})
