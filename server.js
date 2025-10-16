// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname)));

// Store users and parties
let users = {};
let parties = {};

// Handle socket connections
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('setUsername', (username) => {
    users[socket.id] = username;
    io.emit('updateUsers', Object.values(users));
    console.log(`${username} joined`);
  });

  socket.on('sendMessage', ({ message, party }) => {
    const username = users[socket.id] || 'Anonymous';
    if (party && parties[party]) {
      io.to(party).emit('chatMessage', { username, message });
    } else {
      io.emit('chatMessage', { username, message });
    }
  });

  socket.on('createParty', ({ name, isPrivate, password }) => {
    if (parties[name]) {
      socket.emit('partyError', 'Party already exists!');
      return;
    }
    parties[name] = { name, isPrivate, password, users: [] };
    io.emit('updateParties', Object.values(parties));
    socket.emit('partyCreated', name);
    console.log(`Party created: ${name} (${isPrivate ? 'Private' : 'Public'})`);
  });

  socket.on('joinParty', ({ name, password }) => {
    const party = parties[name];
    if (!party) {
      socket.emit('partyError', 'Party not found.');
      return;
    }
    if (party.isPrivate && party.password !== password) {
      socket.emit('partyError', 'Wrong password.');
      return;
    }
    socket.join(name);
    party.users.push(users[socket.id]);
    io.to(name).emit('chatMessage', { username: 'System', message: `${users[socket.id]} joined ${name}` });
    socket.emit('partyJoined', name);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    const username = users[socket.id];
    delete users[socket.id];
    io.emit('updateUsers', Object.values(users));
  });
});

// ✅ This line makes it work on both local & Render
const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`Server running on port ${port}`));
