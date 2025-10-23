// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require('fs').promises;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Temporary in-memory review storage
let privateReviews = [];

app.use(express.static(path.join(__dirname)));

// Simple reviews storage. Note: many PaaS providers (including Render) have ephemeral filesystems
// so this is fine for quick testing but for durable storage use a DB or external storage service.
const REVIEWS_FILE = path.join(__dirname, 'reviews.json');

app.get('/reviews.json', async (req, res) => {
  try {
    const txt = await fs.readFile(REVIEWS_FILE, 'utf8');
    res.setHeader('Content-Type', 'application/json');
    return res.send(txt);
  } catch (e) {
    return res.json([]);
  }
});

const users = {}; // socket.id -> username
const parties = {}; // roomName -> { password?: string, sockets:Set<string> }

function sendPartyList() {
  const list = Object.entries(parties).map(([name, r]) => ({
    name,
    isPrivate: !!r.password,
    users: r.sockets.size,
  }));
  io.emit("updateParties", list);
}

io.on("connection", (socket) => {
  // === Set username ===
socket.on("setUsername", ({ username, color }) => {
  const clean = (username || "").trim();
  const safeColor = color || "#ffd700";
  if (!clean) return;
  users[socket.id] = { name: clean, color: safeColor };
  io.emit("systemMessage", `🟢 ${clean} joined the chat`);
  io.emit("updateUsers", Object.values(users).map(u => u.name));
  sendPartyList();
  // === Receive review from clients privately ===
let privateReviews = [];
socket.on("submitReview", (review) => {
  review.timestamp = Date.now();
  privateReviews.push(review);
  console.log("📩 New review:", review);
});
});

  // === Party Invite ===
socket.on("sendInvite", ({ targetUsername }) => {
  const sender = users[socket.id]?.name || "Anonymous";

  // Find the target socket ID
  const targetSocketId = Object.entries(users)
    .find(([id, u]) => u.name === targetUsername)?.[0];

  if (!targetSocketId) {
    socket.emit("systemMessage", `❌ User ${targetUsername} not found or offline.`);
    return;
  }

  // Send the invite to the target user
  io.to(targetSocketId).emit("receiveInvite", { from: sender });
});


  // === Create party ===
  socket.on("createParty", ({ name, password }) => {
    const room = (name || "").trim();
    if (!room) return socket.emit("partyError", "Party name required.");
    if (parties[room]) return socket.emit("partyError", "Party already exists.");
    parties[room] = { password: (password || "").trim() || null, sockets: new Set() };
    sendPartyList();
    socket.emit("partyCreated", room);
  });

  // === Join party ===
  socket.on("joinParty", ({ name, password }) => {
    const room = (name || "").trim();
    if (!room || !parties[room]) return socket.emit("partyError", "Party not found.");
    const needs = parties[room].password;
    if (needs && needs !== (password || "")) return socket.emit("partyError", "Wrong password.");

    // leave all other rooms except personal one
    for (const r of socket.rooms) {
      if (r !== socket.id) {
        socket.leave(r);
        if (parties[r]) parties[r].sockets.delete(socket.id);
      }
    }

    socket.join(room);
    parties[room].sockets.add(socket.id);

    const user = users[socket.id];
const uname = user?.name || "Anonymous";
    io.to(room).emit("systemMessage", `🟢 ${uname} joined ${room}`);
    socket.emit("partyJoined", room);
    sendPartyList();
  });

  // === Leave party ===
  socket.on("leaveParty", ({ party }) => {
    if (!party || !parties[party]) return;
    if (socket.rooms.has(party)) socket.leave(party);
    parties[party].sockets.delete(socket.id);
    const user = users[socket.id];
const uname = user?.name || "Anonymous";
    io.to(party).emit("systemMessage", `🔴 ${uname} left ${party}`);

    // clean up empty parties
    if (parties[party].sockets.size === 0) delete parties[party];
    sendPartyList();
  });

  // === Send message ===
  socket.on("sendMessage", ({ message, party }) => {
    const text = (message || "").trim();
    if (!text) return;
    const user = users[socket.id];
const uname = user?.name || "Anonymous";
const color = user?.color || "#ffd700";


    // ✅ Only send messages to people in the same party
    if (party && parties[party]) {
      io.to(party).emit("chatMessage", { username: uname, message: text, color });
    } else {
      // 👇 If not in a party, only show to themselves
      socket.emit("systemMessage", "Join a party to chat with others!");
    }
  });

  // --- Typing indicator ---
socket.on("typing", ({ party, isTyping }) => {
  const user = users[socket.id];
  const uname = user?.name || "Anonymous";
  if (!party || !parties[party]) return;
  socket.to(party).emit("typing", { username: uname, isTyping, party });
});

  // === Disconnect ===
  socket.on("disconnect", () => {
  const user = users[socket.id];
if (user) {
  io.emit("systemMessage", `🔴 ${user.name} left the chat`);
  delete users[socket.id];
  io.emit("updateUsers", Object.values(users).map(u => u.name));
}

    // remove user from any parties
    for (const [room, info] of Object.entries(parties)) {
      if (info.sockets.has(socket.id)) {
        info.sockets.delete(socket.id);
        if (info.sockets.size === 0) delete parties[room];
      }
    }

    sendPartyList();
  });

    // === Receive review from client and persist ===
  socket.on("submitReview", async (review) => {
    const filePath = path.join(__dirname, "reviews.json");

    try {
      // Read existing reviews
      let reviews = [];
      try {
        const data = await fs.readFile(filePath, "utf8");
        reviews = JSON.parse(data || "[]");
      } catch {
        console.log("Creating new reviews.json...");
      }

      // Add new review and save it
      reviews.push(review);
      await fs.writeFile(filePath, JSON.stringify(reviews, null, 2), "utf8");
      console.log("✅ Review saved:", review);

      // Broadcast to all users
      io.emit("newReview", review);
    } catch (err) {
      console.error("❌ Failed to save review:", err);
    }
  });
}); // <-- closes the only io.on("connection") block

// 🔒 Admin-only route (place it here)
app.get("/admin/reviews", (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) {
    return res.status(403).send("Forbidden");
  }
  res.json(privateReviews);
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
