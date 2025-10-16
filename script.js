document.addEventListener("DOMContentLoaded", () => {
  // ===== Variables =====
  let username = "";
  let userColor = "#4caf50"; // default user color
  let currentParty = null;
  const users = []; // local list of users
  const parties = []; // local list of parties

  // ===== DOM Elements =====
  const usernameForm = document.getElementById("usernameForm");
  const usernameInput = document.getElementById("usernameInput");
  const userColorInput = document.getElementById("userColor");
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

  // Optional: color change button in chat (you can add it to HTML)
  const changeColorBtn = document.createElement("button");
  changeColorBtn.textContent = "Change Color";
  changeColorBtn.style.marginBottom = "8px";
  chatContainer.prepend(changeColorBtn);

  // ===== USER SETUP =====
  usernameForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = usernameInput.value.trim();
    if (!name) return alert("Enter a username!");
    username = name;
    userColor = userColorInput.value;

    usernameForm.style.display = "none";
    chatContainer.style.display = "block";

    addSystemMessage(`👋 ${username} joined the chat!`);
    users.push({ name: username, color: userColor });
    updateUserList();
  });

  // ===== SEND MESSAGE =====
  sendButton.addEventListener("click", () => {
    sendMessage();
  });

  messageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;
    if (!username) return alert("Set a username first!");

    addMessage(username, text, userColor, currentParty);
    messageInput.value = "";
  }

  // ===== CHANGE COLOR =====
  changeColorBtn.addEventListener("click", () => {
    const newColor = prompt("Enter a hex color code:", userColor);
    if (newColor) {
      userColor = newColor;
      // update local user list
      const userObj = users.find(u => u.name === username);
      if (userObj) userObj.color = newColor;
      updateUserList();
    }
  });

  // ===== CREATE / JOIN PARTY =====
  createPartyBtn.addEventListener("click", () => {
    const name = partyNameInput.value.trim();
    const password = partyPasswordInput.value.trim();
    if (!name) return alert("Party name required.");
    if (parties.find(p => p.name === name)) return alert("Party already exists.");
    parties.push({ name, password: password || null, users: [] });
    addSystemMessage(`🎉 Party "${name}" created`);
    updatePartiesList();
  });

  joinPartyBtn.addEventListener("click", () => {
    const name = partyNameInput.value.trim();
    const password = partyPasswordInput.value.trim();
    const party = parties.find(p => p.name === name);
    if (!party) return alert("Party not found.");
    if (party.password && party.password !== password) return alert("Wrong password.");

    currentParty = name;
    addSystemMessage(`✅ Joined party: ${name}`);
  });

  // ===== UPDATE USER LIST =====
  function updateUserList() {
    userList.innerHTML = "";
    users.forEach(u => {
      const li = document.createElement("li");
      li.textContent = u.name;
      li.style.color = u.color;
      userList.appendChild(li);
    });
  }

  // ===== UPDATE PARTY LIST =====
  function updatePartiesList() {
    partiesList.innerHTML = "";
    parties.forEach(p => {
      const li = document.createElement("li");
      li.innerHTML = `${p.name} • ${p.password ? "Private 🔒" : "Public 🌐"} • ${p.users.length} online`;
      li.style.cursor = "pointer";
      li.onclick = () => {
        partyNameInput.value = p.name;
        partyPasswordInput.value = ""; // user fills if private
      };
      partiesList.appendChild(li);
    });
  }

  // ===== MESSAGE HELPERS =====
  function addMessage(user, text, color = "#4caf50", party = null) {
    // if party filter: only show if current party matches
    if (party && party !== currentParty) return;

    const div = document.createElement("div");
    div.classList.add("message");
    div.innerHTML = `<strong style="color:${color}">${user}</strong>: ${escapeHtml(text)}`;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
  }

  function addSystemMessage(text) {
    const div = document.createElement("div");
    div.classList.add("system");
    div.textContent = text;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;', "'": "&#39;"
    }[c]));
  }
});
