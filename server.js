// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname)));

const users = {};                 // socket.id -> username
const parties = {};               // roomName -> { password?: string, sockets:Set<string> }

function sendPartyList() {
  const list = Object.entries(parties).map(([name, r]) => ({
    name,
    isPrivate: !!r.password,
    users: r.sockets.size
  }));
  io.emit("updateParties", list);
}

io.on("connection", (socket) => {
  // Set username first
  socket.on("setUsername", (username) => {
    const clean = (username || "").trim();
    if (!clean) return;
    users[socket.id] = clean;
    io.emit("systemMessage", `🟢 ${clean} joined the chat`);
    io.emit("updateUsers", Object.values(users));
    // send current parties to the new user
    sendPartyList();
  });

  // Create party
  socket.on("createParty", ({ name, password }) => {
    const room = (name || "").trim();
    if (!room) return socket.emit("partyError", "Party name required.");
    if (parties[room]) return socket.emit("partyError", "Party already exists.");
    parties[room] = { password: (password || "").trim() || null, sockets: new Set() };
    sendPartyList();
    socket.emit("partyCreated", room);
  });

  // Join party
  socket.on("joinParty", ({ name, password }) => {
    const room = (name || "").trim();
    if (!room || !parties[room]) return socket.emit("partyError", "Party not found.");
    const needs = parties[room].password;
    if (needs && needs !== (password || "")) return socket.emit("partyError", "Wrong password.");

    // leave previous party rooms (except the personal room)
    for (const r of socket.rooms) {
      if (r !== socket.id) socket.leave(r);
    }
    socket.join(room);
    parties[room].sockets.add(socket.id);

    const uname = users[socket.id] || "Anonymous";
    io.to(room).emit("systemMessage", `🟢 ${uname} joined ${room}`);
    socket.emit("partyJoined", room);
    sendPartyList();
  });

  // Send message (global or current party)
  socket.on("sendMessage", ({ message, party }) => {
    const text = (message || "").trim();
    if (!text) return;
    const uname = users[socket.id] || "Anonymous";

    if (party && parties[party]) {
      io.to(party).emit("chatMessage", { username: uname, message: text });
    } else {
      io.emit("chatMessage", { username: uname, message: text });
    }
  });

  socket.on("disconnect", () => {
    const uname = users[socket.id];
    if (uname) {
      io.emit("systemMessage", `🔴 ${uname} left the chat`);
      delete users[socket.id];
      io.emit("updateUsers", Object.values(users));
    }
    // remove from any parties
    for (const [room, info] of Object.entries(parties)) {
      if (info.sockets.has(socket.id)) {
        info.sockets.delete(socket.id);
        if (info.sockets.size === 0) delete parties[room];
      }
    }
    sendPartyList();
  });
});

const PORT = process.env.PORT || 3000; // works locally and on Render
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
