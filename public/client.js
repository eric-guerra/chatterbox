(function () {
  'use strict';

  var socket = io();
  var $ = function (id) { return document.getElementById(id); };
  var oldest = null;
  var typingTimer = null;
  var lastTypingSent = 0;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function renderMessage(m) {
    var li = el('li');
    var time = new Date(m.createdAt);
    li.appendChild(el('time', null, time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })));
    li.appendChild(el('strong', null, m.nick));
    li.appendChild(el('span', null, m.text));
    return li;
  }

  function append(m) {
    var list = $('messages');
    var atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
    list.appendChild(renderMessage(m));
    if (atBottom) list.scrollTop = list.scrollHeight;
  }

  function prepend(history) {
    var list = $('messages');
    var first = list.firstChild;
    history.forEach(function (m) { list.insertBefore(renderMessage(m), first); });
    if (history.length) oldest = history[0].createdAt;
    $('older').hidden = history.length < 50;
  }

  function renderUsers(users) {
    var ul = $('users');
    ul.innerHTML = '';
    users.forEach(function (u) { ul.appendChild(el('li', null, u)); });
  }

  $('join').addEventListener('submit', function (e) {
    e.preventDefault();
    var form = e.target;
    socket.emit('join', { nick: form.nick.value, room: form.room.value }, function (res) {
      if (res.error) { $('join-error').textContent = res.error; return; }
      $('join-error').textContent = '';
      $('join').hidden = true;
      $('chat').hidden = false;
      $('room-name').textContent = '#' + res.room;
      $('messages').innerHTML = '';
      oldest = null;
      res.history.forEach(append);
      if (res.history.length) oldest = res.history[0].createdAt;
      $('older').hidden = res.history.length < 50;
      renderUsers(res.users);
      $('send').text.focus();
    });
  });

  $('send').addEventListener('submit', function (e) {
    e.preventDefault();
    var input = e.target.text;
    if (!input.value.trim()) return;
    socket.emit('message', { text: input.value }, function (res) {
      $('send-error').textContent = res.error || '';
      if (res.ok) input.value = '';
    });
  });

  $('send').text.addEventListener('input', function () {
    var t = Date.now();
    if (t - lastTypingSent > 2000) { socket.emit('typing'); lastTypingSent = t; }
  });

  $('older').addEventListener('click', function () {
    socket.emit('history', { before: oldest }, function (res) {
      var list = $('messages');
      var prevHeight = list.scrollHeight;
      prepend(res.history);
      list.scrollTop = list.scrollHeight - prevHeight;
    });
  });

  $('leave').addEventListener('click', function () {
    $('chat').hidden = true;
    $('join').hidden = false;
  });

  socket.on('message', append);
  socket.on('presence', function (p) { renderUsers(p.users); });
  socket.on('system', function (s) { $('messages').appendChild(el('li', 'system', s.text)); });
  socket.on('typing', function (t) {
    $('typing').textContent = t.nick + ' is typing...';
    clearTimeout(typingTimer);
    typingTimer = setTimeout(function () { $('typing').textContent = ''; }, 3000);
  });
  socket.on('disconnect', function () { $('send-error').textContent = 'Disconnected. Reconnecting...'; });
  socket.on('connect', function () { $('send-error').textContent = ''; });
})();
