'use strict';

var createServer = require('./server');
var MemoryStore = require('./store/memoryStore');
var MongoStore = require('./store/mongoStore');

async function main() {
  var store = process.env.MONGO_URL
    ? await MongoStore.connect(process.env.MONGO_URL)
    : new MemoryStore();
  var server = createServer(store);
  var port = Number(process.env.PORT) || 3000;

  server.httpServer.listen(port, function () {
    console.log('ChatterBox on http://localhost:' + port + (process.env.MONGO_URL ? ' (mongo)' : ' (memory)'));
  });

  function shutdown() {
    server.io.close();
    store.close().finally(function () { process.exit(0); });
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
