// script.js
const socket = io();

// --- Load saved username from localStorage ---
let username = localStorage.getItem("chatUsername") || "";
let savedColor = localStorage.getItem("chatColor") || "#ffd700";
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
const leavePartyBtn = document.getElementById("leavePartyBtn");

// --- New DOM elements for color button ---
const changeColorContainer = document.getElementById("changeColorContainer");
const changeColorBtn = document.getElementById("changeColorBtn");
const nameColorPicker = document.getElementById("nameColorPicker");

// --- Universal sound system ---
const playSound = (file) => {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  fetch(file)
    .then(res => res.arrayBuffer())
    .then(buf => ctx.decodeAudioData(buf))
    .then(audioBuf => {
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      src.buffer = audioBuf;
      src.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.value = 0.40;

      const duration = audioBuf.duration * 0.35;
      const endTime = ctx.currentTime + duration;

      gain.gain.setValueAtTime(0.35, endTime - 0.03);
      gain.gain.linearRampToValueAtTime(0, endTime);

      src.start(0, 0, duration);
      src.stop(endTime);
    })
    .catch(err => console.warn("Sound error:", err));
};

// --- Paste image but send only on Enter/Send ---
let pastedImageData = null;

document.addEventListener("paste", (event) => {
  const items = event.clipboardData?.items;
  if (!items) return;

  for (const item of items) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      const reader = new FileReader();
      reader.onload = (e) => {
        pastedImageData = e.target.result;

        let preview = document.getElementById("imagePreview");
        if (!preview) {
          preview = document.createElement("div");
          preview.id = "imagePreview";
          preview.style.display = "flex";
          preview.style.alignItems = "center";
          preview.style.gap = "8px";
          preview.style.margin = "6px 0";

          const img = document.createElement("img");
          img.style.maxWidth = "120px";
          img.style.borderRadius = "8px";
          img.style.display = "block";
          img.alt = "Pasted preview";

          const cancel = document.createElement("button");
          cancel.textContent = "✕";
          cancel.title = "Remove image";
          cancel.style.padding = "6px 10px";
          cancel.style.border = "0";
          cancel.style.borderRadius = "8px";
          cancel.style.cursor = "pointer";
          cancel.style.background = "#2a2f36";
          cancel.style.color = "#eee";
          cancel.onclick = () => { preview.remove(); pastedImageData = null; };

          preview.appendChild(img);
          preview.appendChild(cancel);
          messageInput.parentNode.insertBefore(preview, messageInput);
        }

        preview.querySelector("img").src = pastedImageData;
      };
      reader.readAsDataURL(file);
      break;
    }
  }
});

// --- Unlock Chrome audio ---
const sndSend = document.getElementById("sndSend");
const sndRecv = document.getElementById("sndRecv");

const unlockAudio = () => {
  const silent = document.createElement("video");
  silent.src = "data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAAAAG1wNDFtcDQxaXNvbQAAAAhmcmVlAAAAA3ZtZAAAAANtb292AAAAAG1kYXQhEA==";
  silent.muted = true;
  silent.play().catch(()=>{});
  setTimeout(() => silent.remove(), 2000);

  [sndSend, sndRecv].forEach(snd => {
    if (!snd) return;
    playSound("rec.mp3");
  });
  console.log("✅ Chrome audio fully unlocked");
};

window.addEventListener("click", unlockAudio, { once: true });

// --- Username form submission ---
usernameForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = (usernameInput.value || "").trim();
  const color = document.getElementById("usernameColor").value || "#ffd700";
  if (!name) return;

  username = name;
  savedColor = color;

  // Save in localStorage
  localStorage.setItem("chatUsername", username);
  localStorage.setItem("chatColor", color);

  socket.emit("setUsername", { username, color });

  usernameForm.style.display = "none";
  chatContainer.style.display = "block";

  // Show change color button after username
  changeColorContainer.style.display = "block";
});

// --- If username is saved, auto-set it ---
if (username) {
  socket.emit("setUsername", { username, color: savedColor });
  usernameForm.style.display = "none";
  chatContainer.style.display = "block";

  // Show change color button
  changeColorContainer.style.display = "block";
}

// --- Send message ---
sendButton.addEventListener("click", () => {
  if (pastedImageData) {
    if (sendButton.disabled) return;
    sendButton.disabled = true;

    socket.emit("sendImage", { image: pastedImageData, party: currentParty });

    const preview = document.getElementById("imagePreview");
    if (preview) preview.remove();
    pastedImageData = null;

    setTimeout(() => (sendButton.disabled = false), 600);
    return;
  }

  const text = (messageInput.value || "").trim();
  if (!text) return;
  if (!username) return alert("Set a username first!");

  socket.emit("sendMessage", { message: text, party: currentParty });
  playSound("send.mp3");
  messageInput.value = "";
});

messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendButton.click();
  }
});

let typingTimeout;
messageInput.addEventListener("input", () => {
  if (!currentParty) return;
  socket.emit("typing", { party: currentParty, isTyping: true });
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit("typing", { party: currentParty, isTyping: false });
  }, 1000);
});

messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) return;
    if (messageInput.value.trim() === "") return;
    sendButton.click();
  }
});

// --- Typing indicator ---
socket.on("typing", ({ username, isTyping, party }) => {
  const indicator = document.getElementById("typingIndicator");
  if (!indicator || party !== currentParty) return;
  if (isTyping) {
    indicator.style.display = "block";
    indicator.textContent = `${username} is typing…`;
  } else {
    indicator.style.display = "none";
  }
});

// --- Party buttons ---
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

leavePartyBtn.addEventListener("click", () => {
  if (!currentParty) return alert("You’re not in a party!");
  socket.emit("leaveParty", { party: currentParty });
  systemLine(`You left ${currentParty}`);
  currentParty = null;
});

// --- Auto-join after creating a party ---
socket.on("partyCreated", (room) => {
  toast(`✅ Party "${room}" created`);
  socket.emit("joinParty", { name: room, password: "" });
});

socket.on("partyJoined", (room) => {
  currentParty = room;
  systemLine(`Joined party: ${room}`);
});

socket.on("partyError", (msg) => alert(msg));

// --- Chat messages ---
socket.on("chatMessage", ({ username, message, color }) => {
  playSound("rec.mp3");
  const div = document.createElement("div");
  div.classList.add("message");
  div.innerHTML = `<strong style="color:${color || "#ffd700"}">${escapeHtml(username)}</strong>: ${escapeHtml(message)}`;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
});

socket.on("chatImage", ({ username, image, color }) => {
  playSound("rec.mp3");
  const div = document.createElement("div");
  div.classList.add("message");

  const img = document.createElement("img");
  img.src = image;
  img.style.maxWidth = "200px";
  img.style.borderRadius = "10px";
  img.style.marginTop = "6px";
  img.style.display = "block";

  div.innerHTML = `<strong style="color:${color || "#ffd700"}">${escapeHtml(username)}</strong>:`;
  div.appendChild(img);

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
});

// --- System and user updates ---
socket.on("systemMessage", (text) => systemLine(text));

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
    row.style.cursor = "pointer";
    row.onclick = () => {
      partyNameInput.value = p.name;
      partyPasswordInput.value = "";
      if (!p.isPrivate) {
        socket.emit("joinParty", { name: p.name, password: "" });
      }
    };
    partiesList.appendChild(row);
  });
});

// --- Name color change button ---
changeColorBtn.addEventListener("click", () => {
  nameColorPicker.click();
});

nameColorPicker.addEventListener("input", (e) => {
  savedColor = e.target.value;
  localStorage.setItem("chatColor", savedColor);

  if (username) {
    socket.emit("setUsername", { username, color: savedColor });
    systemLine(`✅ Your name color was changed!`);
  }
});

// --- Helpers ---
function systemLine(text) {
  const div = document.createElement("div");
  div.classList.add("system");
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function toast(msg) {
  systemLine(msg);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
