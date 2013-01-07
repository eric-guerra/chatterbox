'use strict';

var v = require('./validation');
var RateLimiter = require('./rateLimiter');

var HISTORY_SIZE = 50;

/**
 * Wires chat events onto a Socket.io server.
 *
 * Client -> server: join {room, nick} (ack), message {text} (ack), typing, history {before} (ack)
 * Server -> client: message, presence {room, users}, system {text}, typing {nick}
 */
function attachChat(io, store, options) {
  options = options || {};
  var limiter = options.limiter || new RateLimiter({ capacity: 5, refillPerSec: 1 });
  var now = options.now || function () { return new Date().toISOString(); };

  // room -> Map(socketId -> nick)
  var presence = new Map();

  function usersIn(room) {
    var members = presence.get(room);
    return members ? Array.from(new Set(members.values())).sort() : [];
  }

  function broadcastPresence(room) {
    io.to(room).emit('presence', { room: room, users: usersIn(room) });
  }

  function leave(socket) {
    var room = socket.data.room;
    if (!room) return;
    var members = presence.get(room);
    if (members) {
      members.delete(socket.id);
      if (members.size === 0) presence.delete(room);
    }
    socket.leave(room);
    socket.to(room).emit('system', { text: socket.data.nick + ' left' });
    broadcastPresence(room);
    socket.data.room = null;
  }

  io.on('connection', function (socket) {
    socket.on('join', async function (payload, ack) {
      ack = typeof ack === 'function' ? ack : function () {};
      var room = v.normalizeRoom(payload && payload.room);
      var nick = v.normalizeNick(payload && payload.nick);
      if (!room) return ack({ error: 'Room names are 2-31 lowercase letters, digits or dashes.' });
      if (!nick) return ack({ error: 'Nicknames are 2-24 characters.' });

      var taken = Array.from((presence.get(room) || new Map()).entries())
        .some(function (e) { return e[1].toLowerCase() === nick.toLowerCase() && e[0] !== socket.id; });
      if (taken) return ack({ error: 'That nickname is in use in #' + room + '.' });

      leave(socket);
      socket.data.room = room;
      socket.data.nick = nick;
      socket.join(room);
      if (!presence.has(room)) presence.set(room, new Map());
      presence.get(room).set(socket.id, nick);

      var history = await store.history(room, HISTORY_SIZE);
      ack({ ok: true, room: room, nick: nick, history: history, users: usersIn(room) });
      socket.to(room).emit('system', { text: nick + ' joined' });
      broadcastPresence(room);
    });

    socket.on('message', async function (payload, ack) {
      ack = typeof ack === 'function' ? ack : function () {};
      if (!socket.data.room) return ack({ error: 'Join a room first.' });
      var text = v.normalizeText(payload && payload.text);
      if (!text) return ack({ error: 'Messages must be 1-' + v.MAX_MESSAGE + ' characters.' });
      if (!limiter.take(socket.id)) return ack({ error: 'Slow down: too many messages.' });

      var saved = await store.save({ room: socket.data.room, nick: socket.data.nick, text: text, createdAt: now() });
      io.to(socket.data.room).emit('message', saved);
      ack({ ok: true, id: saved.id });
    });

    socket.on('typing', function () {
      if (socket.data.room) socket.to(socket.data.room).emit('typing', { nick: socket.data.nick });
    });

    socket.on('history', async function (payload, ack) {
      if (typeof ack !== 'function' || !socket.data.room) return;
      var before = payload && typeof payload.before === 'string' ? payload.before : undefined;
      ack({ history: await store.history(socket.data.room, HISTORY_SIZE, before) });
    });

    socket.on('disconnect', function () {
      leave(socket);
      limiter.forget(socket.id);
    });
  });

  return { usersIn: usersIn };
}

module.exports = attachChat;
