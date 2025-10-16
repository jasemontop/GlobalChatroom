.js
const socket = io();

let username = "";
let currentParty = null;

// DOM
const usernameForm = document.getElementById("usernameForm");
const usernameInput = document.getElementById("usernameInput");
const chatContainer = document.getElementById("chatContainer");
const chat = document.getElementById("chat");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const userList = document.getElementById("userList");
const partiesList = document.getElementById("partiesList");
const partyNameInput = document.getElementById("partyNameInput");
const partyPasswordInput = document.getElementById("partyPasswordInput");
const createPartyBtn = document.getElementById("createPartyBtn");
const joinPartyBtn = document.getElementById("joinPartyBtn");

// 1) Set username FIRST (prevents "undefined")
usernameForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = (usernameInput.value || "").trim();
  if (!name) return;
  username = name;
  socket.emit("setUsername", username);
  usernameForm.style.display = "none";
  chatContainer.style.display = "block";
});

// 2) Send message (global or current party)
sendButton.addEventListener("click", () => {
  const text = (messageInput.value || "").trim();
  if (!text) return;
  // guard: must have username set
  if (!username) {
    alert("Set a username first!");
    return;
  }
  socket.emit("sendMessage", { message: text, party: currentParty });
  messageInput.value = "";
});

// 3) Create / Join party
createPartyBtn.addEventListener("click", () => {
  const name = (partyNameInput.value || "").trim();
  const password = (partyPasswordInput.value || "").trim();
  if (!name) return alert("Party name required.");
  socket.emit("createParty", { name, password });
});

joinPartyBtn.addEventListener("click", () => {
  const name = (partyNameInput.value || "").trim();
  const password = (partyPasswordInput.value || "").trim();
  if (!name) return alert("Enter a party name to join.");
  socket.emit("joinParty", { name, password });
});

socket.on("partyCreated", (room) => {
  toast(`✅ Party "${room}" created`);
});

socket.on("partyJoined", (room) => {
  currentParty = room;
  systemLine(`Joined party: ${room}`);
});

socket.on("partyError", (msg) => alert(msg));

// 4) Incoming messages
socket.on("chatMessage", ({ username, message }) => {
  const div = document.createElement("div");
  div.classList.add("message");
  // gold names
  div.innerHTML = `<strong style="color:#ffd700">${escapeHtml(username)}</strong>: ${escapeHtml(message)}`;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
});

socket.on("systemMessage", (text) => {
  systemLine(text);
});

socket.on("updateUsers", (users) => {
  userList.innerHTML = "";
  users.forEach((u) => {
    const li = document.createElement("li");
    li.textContent = u;
    userList.appendChild(li);
  });
});

socket.on("updateParties", (list) => {
  partiesList.innerHTML = "";
  list.forEach((p) => {
    const row = document.createElement("li");
    row.innerHTML = `${p.name} • ${p.isPrivate ? "Private 🔒" : "Public 🌐"} • ${p.users} online`;
    // quick-join on click
    row.style.cursor = "pointer";
    row.onclick = () => {
      partyNameInput.value = p.name;
      partyPasswordInput.value = ""; // user fills if private
    };
    partiesList.appendChild(row);
  });
});

// helpers
function systemLine(text) {
  const div = document.createElement("div");
  div.classList.add("system");
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function toast(msg) {
  // simple inline toast via system line (keeps OG vibe)
  systemLine(msg);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
