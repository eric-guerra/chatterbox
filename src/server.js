'use strict';

var http = require('http');
var path = require('path');
var express = require('express');
var Server = require('socket.io').Server;
var attachChat = require('./chat');

function createServer(store, options) {
  var app = express();
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/healthz', function (req, res) {
    res.json({ ok: true });
  });

  var httpServer = http.createServer(app);
  var io = new Server(httpServer, { maxHttpBufferSize: 16 * 1024 });
  var chat = attachChat(io, store, options);

  app.get('/api/rooms/:room/users', function (req, res) {
    res.json({ users: chat.usersIn(String(req.params.room).toLowerCase()) });
  });

  return { app: app, httpServer: httpServer, io: io };
}

module.exports = createServer;
