'use strict';

/** In-process message store with the same async interface as MongoStore. */
function MemoryStore(options) {
  this.maxPerRoom = (options && options.maxPerRoom) || 500;
  this.rooms = new Map();
  this.seq = 0;
}

MemoryStore.prototype.save = async function (msg) {
  var list = this.rooms.get(msg.room) || [];
  var saved = Object.assign({ id: String(++this.seq) }, msg);
  list.push(saved);
  if (list.length > this.maxPerRoom) list.splice(0, list.length - this.maxPerRoom);
  this.rooms.set(msg.room, list);
  return saved;
};

/** Most recent `limit` messages, oldest first. `before` pages backwards by createdAt. */
MemoryStore.prototype.history = async function (room, limit, before) {
  var list = this.rooms.get(room) || [];
  if (before) list = list.filter(function (m) { return m.createdAt < before; });
  return list.slice(-limit);
};

MemoryStore.prototype.close = async function () {};

module.exports = MemoryStore;
