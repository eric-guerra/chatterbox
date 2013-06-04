'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var v = require('../src/validation');
var RateLimiter = require('../src/rateLimiter');

test('room names are normalized', function () {
  assert.equal(v.normalizeRoom('  General '), 'general');
  assert.equal(v.normalizeRoom('cs-3320'), 'cs-3320');
  assert.equal(v.normalizeRoom('-bad'), null);
  assert.equal(v.normalizeRoom('a'), null);
  assert.equal(v.normalizeRoom('has space'), null);
  assert.equal(v.normalizeRoom(42), null);
});

test('nicknames collapse whitespace', function () {
  assert.equal(v.normalizeNick('  Ada   Lovelace '), 'Ada Lovelace');
  assert.equal(v.normalizeNick('<script>'), null);
});

test('message text strips control characters', function () {
  assert.equal(v.normalizeText('hi\u0007 there\nfriend'), 'hi there\nfriend');
  assert.equal(v.normalizeText('\u0000'), null);
});

test('token bucket refills over time', function () {
  var t = 0;
  var rl = new RateLimiter({ capacity: 3, refillPerSec: 2, now: function () { return t; } });
  assert.equal(rl.take('a'), true);
  assert.equal(rl.take('a'), true);
  assert.equal(rl.take('a'), true);
  assert.equal(rl.take('a'), false);
  t = 500; // +1 token
  assert.equal(rl.take('a'), true);
  assert.equal(rl.take('a'), false);
  assert.equal(rl.take('b'), true, 'buckets are per key');
});
