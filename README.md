# ChatterBox

Real-time chat rooms built with **Node.js, Express, Socket.io and MongoDB**.

> Portfolio reference implementation of a 2011 project, built in the CommonJS / callback-era style, running on current Node.

## Features

- Join any room by name; nicknames are unique per room (case-insensitive)
- Live messages, join/leave notices, an online-user list and "is typing..." indicators
- Last 50 messages are delivered on join, with "load older" paging backwards
- Token-bucket rate limiting per connection, input normalization and size limits; clients render text with `textContent`, never HTML
- Pluggable store: in-memory by default, MongoDB when `MONGO_URL` is set (compound `(room, createdAt)` index and a TTL index that expires messages after 30 days)
- `/healthz` and `/api/rooms/:room/users`

## Protocol

| Client → server | Ack |
|---|---|
| `join {room, nick}` | `{ok, room, nick, history, users}` or `{error}` |
| `message {text}` | `{ok, id}` or `{error}` |
| `history {before}` | `{history}` |
| `typing` | n/a |

Server → client: `message`, `presence {room, users}`, `system {text}`, `typing {nick}`.

## Run

```bash
npm install
npm start                                     # memory store
MONGO_URL=mongodb://localhost/chatterbox npm start
```

## Test

```bash
npm test     # node:test; spins up real Socket.io servers on random ports
```
