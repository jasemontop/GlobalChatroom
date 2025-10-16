const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const server = http.createServer((req, res) => {
  const file = req.url === "/" ? "index.html" : req.url.slice(1);
  const ext = path.extname(file);
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
    } else {
      res.writeHead(200, { "Content-Type": types[ext] || "text/plain" });
      res.end(data);
    }
  });
});

const wss = new WebSocket.Server({ server });

const rooms = {};        // { roomName: { password, sockets:Set() } }
const socketInfo = new Map(); // socket → {username,color,roomName}

wss.on("connection", (socket) => {
  socket.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    // --- Join room ----------------------------------------------------------
    if (msg.type === "join") {
      const { username, color, roomName, password } = msg;
      if (!username || !roomName) return;

      // make room or verify password
      if (!rooms[roomName]) rooms[roomName] = { password: password || "", sockets: new Set() };
      const room = rooms[roomName];
      if (room.password && room.password !== password) {
        socket.send(JSON.stringify({ type: "error", text: "❌ Wrong password!" }));
        return;
      }

      room.sockets.add(socket);
      socketInfo.set(socket, { username, color, roomName });

      broadcast(roomName, {
        type: "system",
        text: `🟢 ${username} joined ${roomName}`
      });
      return;
    }

    // --- Normal chat --------------------------------------------------------
    if (msg.type === "chat") {
      const info = socketInfo.get(socket);
      if (!info) return;  // hasn’t joined a room yet
      broadcast(info.roomName, {
        type: "chat",
        user: info.username,
        color: info.color,
        text: msg.text
      });
    }
  });

  socket.on("close", () => {
    const info = socketInfo.get(socket);
    if (!info) return;
    const room = rooms[info.roomName];
    if (room) {
      room.sockets.delete(socket);
      broadcast(info.roomName, {
        type: "system",
        text: `🔴 ${info.username} left ${info.roomName}`
      });
    }
    socketInfo.delete(socket);
  });
});

function broadcast(roomName, message) {
  const room = rooms[roomName];
  if (!room) return;
  for (const s of room.sockets) {
    if (s.readyState === WebSocket.OPEN)
      s.send(JSON.stringify(message));
  }
}

server.listen(3000, () =>
  console.log("🌍 Global Chatroom running on http://localhost:3000")
);
