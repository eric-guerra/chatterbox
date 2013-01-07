'use strict';

var MongoClient = require('mongodb').MongoClient;

/**
 * MongoDB-backed message store. A compound index on (room, createdAt) keeps
 * history queries fast; a TTL index expires messages after `ttlDays`.
 */
function MongoStore(client, db, options) {
  this.client = client;
  this.messages = db.collection('messages');
  this.ttlDays = (options && options.ttlDays) || 30;
}

MongoStore.connect = async function (url, options) {
  var client = new MongoClient(url);
  await client.connect();
  var store = new MongoStore(client, client.db(), options);
  await store.messages.createIndex({ room: 1, createdAt: -1 });
  await store.messages.createIndex({ createdAt: 1 }, { expireAfterSeconds: store.ttlDays * 86400 });
  return store;
};

MongoStore.prototype.save = async function (msg) {
  var doc = Object.assign({}, msg, { createdAt: new Date(msg.createdAt) });
  var result = await this.messages.insertOne(doc);
  return Object.assign({ id: String(result.insertedId) }, msg);
};

MongoStore.prototype.history = async function (room, limit, before) {
  var query = { room: room };
  if (before) query.createdAt = { $lt: new Date(before) };
  var docs = await this.messages.find(query).sort({ createdAt: -1 }).limit(limit).toArray();
  return docs.reverse().map(function (d) {
    return { id: String(d._id), room: d.room, nick: d.nick, text: d.text, createdAt: d.createdAt.toISOString() };
  });
};

MongoStore.prototype.close = function () {
  return this.client.close();
};

module.exports = MongoStore;
