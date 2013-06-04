'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var ioClient = require('socket.io-client').io;
var createServer = require('../src/server');
var MemoryStore = require('../src/store/memoryStore');
var RateLimiter = require('../src/rateLimiter');

function start(options) {
  return new Promise(function (resolve) {
    var store = new MemoryStore();
    var server = createServer(store, options);
    server.httpServer.listen(0, function () {
      var url = 'http://localhost:' + server.httpServer.address().port;
      var clients = [];
      resolve({
        store: store,
        url: url,
        connect: function () {
          var c = ioClient(url, { transports: ['websocket'], forceNew: true });
          clients.push(c);
          return new Promise(function (res) { c.on('connect', function () { res(c); }); });
        },
        close: function () {
          clients.forEach(function (c) { c.close(); });
          return new Promise(function (res) { server.io.close(function () { res(); }); });
        }
      });
    });
  });
}

function emit(socket, event, payload) {
  return new Promise(function (resolve) { socket.emit(event, payload, resolve); });
}

function next(socket, event, predicate) {
  return new Promise(function (resolve) {
    socket.on(event, function handler(data) {
      if (predicate && !predicate(data)) return;
      socket.off(event, handler);
      resolve(data);
    });
  });
}

test('join, broadcast and history', async function (t) {
  var env = await start();
  t.after(env.close);
  var alice = await env.connect();
  var bob = await env.connect();

  var joined = await emit(alice, 'join', { room: 'General', nick: 'alice' });
  assert.equal(joined.ok, true);
  assert.equal(joined.room, 'general');
  assert.deepEqual(joined.history, []);

  var bobJoined = await emit(bob, 'join', { room: 'general', nick: 'bob' });
  assert.deepEqual(bobJoined.users, ['alice', 'bob']);

  var received = next(bob, 'message');
  var ack = await emit(alice, 'message', { text: '  hello <b>world</b>  ' });
  assert.equal(ack.ok, true);
  var msg = await received;
  assert.equal(msg.nick, 'alice');
  assert.equal(msg.text, 'hello <b>world</b>'); // stored raw; client renders with textContent

  var carol = await env.connect();
  var carolJoined = await emit(carol, 'join', { room: 'general', nick: 'carol' });
  assert.equal(carolJoined.history.length, 1);
  assert.equal(carolJoined.history[0].text, 'hello <b>world</b>');
});

test('messages stay inside their room', async function (t) {
  var env = await start();
  t.after(env.close);
  var a = await env.connect();
  var b = await env.connect();
  await emit(a, 'join', { room: 'room-a', nick: 'ann' });
  await emit(b, 'join', { room: 'room-b', nick: 'ben' });

  var leaked = false;
  b.on('message', function () { leaked = true; });
  await emit(a, 'message', { text: 'only for room a' });
  await new Promise(function (r) { setTimeout(r, 50); });
  assert.equal(leaked, false);
});

test('validation and duplicate nicknames', async function (t) {
  var env = await start();
  t.after(env.close);
  var a = await env.connect();
  var b = await env.connect();

  assert.match((await emit(a, 'message', { text: 'hi' })).error, /Join a room/);
  assert.match((await emit(a, 'join', { room: '!', nick: 'ann' })).error, /Room names/);
  assert.match((await emit(a, 'join', { room: 'lobby', nick: 'x' })).error, /Nicknames/);

  await emit(a, 'join', { room: 'lobby', nick: 'Ann' });
  assert.match((await emit(b, 'join', { room: 'lobby', nick: 'ann' })).error, /in use/);
  assert.match((await emit(a, 'message', { text: '   ' })).error, /1-1000/);
  assert.match((await emit(a, 'message', { text: 'x'.repeat(1001) })).error, /1-1000/);
});

test('rate limiting rejects bursts', async function (t) {
  var clock = 0;
  var env = await start({ limiter: new RateLimiter({ capacity: 2, refillPerSec: 1, now: function () { return clock; } }) });
  t.after(env.close);
  var a = await env.connect();
  await emit(a, 'join', { room: 'spam', nick: 'spammer' });

  assert.equal((await emit(a, 'message', { text: '1' })).ok, true);
  assert.equal((await emit(a, 'message', { text: '2' })).ok, true);
  assert.match((await emit(a, 'message', { text: '3' })).error, /Slow down/);
  clock += 1000;
  assert.equal((await emit(a, 'message', { text: '4' })).ok, true);
});

test('presence updates when users leave', async function (t) {
  var env = await start();
  t.after(env.close);
  var a = await env.connect();
  var b = await env.connect();
  await emit(a, 'join', { room: 'lobby', nick: 'ann' });
  await emit(b, 'join', { room: 'lobby', nick: 'ben' });

  var update = next(a, 'presence', function (p) { return p.users.length === 1; });
  b.close();
  assert.deepEqual((await update).users, ['ann']);

  var res = await fetch(env.url + '/api/rooms/lobby/users');
  assert.deepEqual((await res.json()).users, ['ann']);
});

test('history pages backwards', async function () {
  var store = new MemoryStore();
  for (var i = 0; i < 120; i++) {
    await store.save({ room: 'r', nick: 'n', text: 'm' + i, createdAt: new Date(Date.UTC(2011, 0, 1, 0, 0, i)).toISOString() });
  }
  var latest = await store.history('r', 50);
  assert.equal(latest[0].text, 'm70');
  assert.equal(latest[49].text, 'm119');
  var older = await store.history('r', 50, latest[0].createdAt);
  assert.equal(older[0].text, 'm20');
  assert.equal(older[49].text, 'm69');
});
