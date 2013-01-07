'use strict';

var ROOM_RE = /^[a-z0-9][a-z0-9-]{1,30}$/;
var NICK_RE = /^[\w .-]{2,24}$/;
var MAX_MESSAGE = 1000;

function normalizeRoom(room) {
  if (typeof room !== 'string') return null;
  var r = room.trim().toLowerCase();
  return ROOM_RE.test(r) ? r : null;
}

function normalizeNick(nick) {
  if (typeof nick !== 'string') return null;
  var n = nick.trim().replace(/\s+/g, ' ');
  return NICK_RE.test(n) ? n : null;
}

function normalizeText(text) {
  if (typeof text !== 'string') return null;
  // Strip control characters except newlines and tabs.
  var t = text.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').trim();
  if (!t || t.length > MAX_MESSAGE) return null;
  return t;
}

module.exports = { normalizeRoom: normalizeRoom, normalizeNick: normalizeNick, normalizeText: normalizeText, MAX_MESSAGE: MAX_MESSAGE };
