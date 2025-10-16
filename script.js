let ws;
let username = "";
let userColor = "";
let roomName = "";

const loginBox = document.getElementById("login-box");
const chatBox = document.getElementById("chat-box");
const messages = document.getElementById("messages");
const form = document.getElementById("form");
const input = document.getElementById("input");
const roomTitle = document.getElementById("room-title");

document.getElementById("join-btn").addEventListener("click", () => {
  username = document.getElementById("username").value.trim();
  userColor = document.getElementById("color").value;
  roomName = document.getElementById("room").value.trim() || "Global";
  const password = document.getElementById("password").value.trim();

  if (!username) return alert("Enter a username!");

  loginBox.style.display = "none";
  chatBox.style.display = "block";
  roomTitle.textContent = `Party: ${roomName}`;

  ws = new WebSocket(`ws://${window.location.host}`);

  ws.onopen = () => {
    ws.send(JSON.stringify({
      type: "join",
      username,
      color: userColor,
      roomName,
      password
    }));
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    if (msg.type === "error") {
      alert(msg.text);
      location.reload();
      return;
    }

    if (msg.type === "system") {
      addSystemMessage(msg.text);
    }

    if (msg.type === "chat") {
      addChatMessage(msg.user, msg.text, msg.color);
    }
  };

  ws.onclose = () => addSystemMessage("🔴 Disconnected from server.");
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;

  ws.send(JSON.stringify({ type: "chat", text }));
  input.value = "";
});

function addChatMessage(user, text, color) {
  const li = document.createElement("li");
  li.innerHTML = `<strong style="color:${color}">${user}</strong>: ${text}`;
  messages.appendChild(li);
  messages.scrollTop = messages.scrollHeight;
}

function addSystemMessage(text) {
  const li = document.createElement("li");
  li.classList.add("system-msg");
  li.textContent = text;
  messages.appendChild(li);
  messages.scrollTop = messages.scrollHeight;
}
