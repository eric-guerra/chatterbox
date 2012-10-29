'use strict';

/**
 * Token bucket per key. `capacity` messages burst, refilled at `refillPerSec`.
 * `now` is injectable for tests.
 */
function RateLimiter(options) {
  options = options || {};
  this.capacity = options.capacity || 5;
  this.refillPerSec = options.refillPerSec || 1;
  this.now = options.now || Date.now;
  this.buckets = new Map();
}

RateLimiter.prototype.take = function (key) {
  var t = this.now();
  var b = this.buckets.get(key);
  if (!b) {
    b = { tokens: this.capacity, at: t };
    this.buckets.set(key, b);
  }
  b.tokens = Math.min(this.capacity, b.tokens + ((t - b.at) / 1000) * this.refillPerSec);
  b.at = t;
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  return true;
};

RateLimiter.prototype.forget = function (key) {
  this.buckets.delete(key);
};

module.exports = RateLimiter;
