import DOMPurify from "dompurify";

export default class Chat {
  constructor() {
    this.openedChats = new Map(); // Track multiple open chats
    this.chatWrapper = document.querySelector("#chat-wrapper");
    this.socket = null;
    this.currentUsername = null;
    this.friendsAvatars = {};
    this.setupChatButtons();
    this.connectToWebSocketServer();
  }

  setupChatButtons() {
    // Listen for chat button clicks
    document.addEventListener('click', (e) => {
      const chatBtn = e.target.closest('.start-chat-btn');
      if (chatBtn) {
        e.preventDefault();
        const friendUsername = chatBtn.dataset.username;
        const friendId = chatBtn.dataset.userid;
        if (friendUsername && friendId) {
          this.openChatWith(friendUsername, friendId);
        }
      }
    });
  }

  connectToWebSocketServer() {
    this.socket = io();
    window.socket = this.socket;

    // Fetch friends avatars for chat
    fetch('/chat/recent')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.friends) {
          this.friendsAvatars = {};
          data.friends.forEach(f => {
            this.friendsAvatars[f.username] = f.avatar ? f.avatar : `https://gravatar.com/avatar/${this.hashEmail(f.username)}?s=128`;
          });
        }
      });

    this.socket.on("welcome", (data) => {
      this.currentUsername = data.username;
      console.log("🔗 Connected to chat server as:", this.currentUsername);
    });

    this.socket.on("chatMessageFromServer", (data) => {
      this.displayMessageFromServer(data);
    });

    this.socket.on("previousMessages", (data) => {
      this.loadPreviousMessages(data);
    });
  }

  async refreshFriendsAvatars() {
    try {
      const res = await fetch('/chat/recent');
      const data = await res.json();
      if (data.success && data.friends) {
        this.friendsAvatars = {};
        data.friends.forEach(f => {
          this.friendsAvatars[f.username] = f.avatar ? f.avatar : `https://gravatar.com/avatar/${this.hashEmail(f.username)}?s=128`;
        });
      }
    } catch (e) {
      // fallback: do nothing
    }
  }

  async openChatWith(friendUsername, friendId) {
    // Always fetch latest avatar for this friend
    let avatar = `https://gravatar.com/avatar/${this.hashEmail(friendUsername)}?s=128`;
    try {
      const res = await fetch(`/api/user/avatar/${friendUsername}`);
      const data = await res.json();
      if (data.success && data.avatar) {
        avatar = data.avatar;
        this.friendsAvatars[friendUsername] = avatar;
      }
    } catch (e) {}

    if (this.openedChats.has(friendUsername)) {
      const existingChat = this.openedChats.get(friendUsername);
      existingChat.classList.add('chat--visible');
      existingChat.querySelector('.chat-field').focus();
      // Always update avatar in chat title bar
      const avatarImg = existingChat.querySelector('.chat-title-info .avatar-tiny');
      if (avatarImg) {
        avatarImg.src = avatar;
      }
      return;
    }
    // Create new chat window
    const chatWindow = this.createChatWindow(friendUsername, friendId);
    this.chatWrapper.appendChild(chatWindow);
    this.openedChats.set(friendUsername, chatWindow);
    // Request previous messages
    this.socket.emit("requestPreviousMessages", { friendUsername });
    // Position chat windows in a cascade
    this.repositionChatWindows();
  }

  createChatWindow(friendUsername, friendId) {
    const chatDiv = document.createElement('div');
    chatDiv.className = 'chat-window chat--visible';
    chatDiv.dataset.username = friendUsername;
    // Use the avatar URL from backend (uploaded profile picture)
    let avatar = this.friendsAvatars && this.friendsAvatars[friendUsername]
      ? this.friendsAvatars[friendUsername]
      : '/images/default-avatar.png'; // fallback only if no avatar
    chatDiv.innerHTML = DOMPurify.sanitize(`
      <div class="chat-title-bar">
        <div class="chat-title-info">
          <img class="avatar-tiny" src="${avatar}" onerror="this.src='/images/default-avatar.png'">
          <strong>${friendUsername}</strong>
        </div>
        <span class="chat-title-bar-close" data-username="${friendUsername}">
          <i class="fas fa-times-circle"></i>
        </span>
      </div>
      <div class="chat-log" id="chat-${friendUsername}"></div>
      <form class="chat-form border-top" data-username="${friendUsername}">
        <input type="text" class="chat-field" placeholder="Зурвас бичих..." autocomplete="off" data-username="${friendUsername}">
        <button type="submit" class="chat-send-btn">
          <i class="fas fa-paper-plane"></i>
        </button>
      </form>
    `);

    // Event listeners for this chat window
    const closeBtn = chatDiv.querySelector('.chat-title-bar-close');
    closeBtn.addEventListener('click', () => this.closeChat(friendUsername));

    const form = chatDiv.querySelector('.chat-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('.chat-field');
      if (input.value.trim()) {
        this.sendMessage(friendUsername, input.value.trim());
        input.value = '';
      }
    });

    return chatDiv;
  }

  sendMessage(toUsername, message) {
    this.socket.emit("chatMessageFromBrowser", {
      toUsername: toUsername,
      message: message
    });

    // Display message immediately
    const chatLog = document.getElementById(`chat-${toUsername}`);
    if (chatLog) {
      chatLog.insertAdjacentHTML(
        "beforeend",
        DOMPurify.sanitize(`
          <div class="chat-self">
            <div class="chat-message">
              <div class="chat-message-inner">${message}</div>
              <div class="chat-message-time">${this.getTimeString()}</div>
            </div>
            <img class="chat-avatar avatar-tiny" src="https://gravatar.com/avatar/${this.hashEmail(this.currentUsername)}?s=128">
          </div>
        `)
      );
      chatLog.scrollTop = chatLog.scrollHeight;
    }
  }

  displayMessageFromServer(data) {
    const fromUsername = data.username;
    // Open chat window if not already open
    if (!this.openedChats.has(fromUsername)) {
      this.openChatWith(fromUsername, data.userId);
    }
    const chatLog = document.getElementById(`chat-${fromUsername}`);
    if (chatLog) {
      // Use avatar from cache
      let avatar = this.friendsAvatars && this.friendsAvatars[fromUsername]
        ? this.friendsAvatars[fromUsername]
        : `https://gravatar.com/avatar/${this.hashEmail(fromUsername)}?s=128`;
      chatLog.insertAdjacentHTML(
        "beforeend",
        DOMPurify.sanitize(`
          <div class="chat-other">
            <img class="avatar-tiny" src="${avatar}">
            <div class="chat-message">
              <div class="chat-message-inner">
                <strong>${fromUsername}:</strong> ${data.message}
              </div>
              <div class="chat-message-time">${this.getTimeString()}</div>
            </div>
          </div>
        `)
      );
      chatLog.scrollTop = chatLog.scrollHeight;

      // Add notification if chat not visible
      const chatWindow = this.openedChats.get(fromUsername);
      if (!chatWindow.classList.contains('chat--visible')) {
        this.addUnreadBadge(chatWindow);
      }
    }
  }

  loadPreviousMessages(data) {
    const chatLog = document.getElementById(`chat-${data.friendUsername}`);
    if (!chatLog || !data.messages) return;

    chatLog.innerHTML = '';
    data.messages.forEach(msg => {
      const isSelf = msg.from === this.currentUsername;
      const messageHTML = isSelf ? `
        <div class="chat-self">
          <div class="chat-message">
            <div class="chat-message-inner">${msg.message}</div>
            <div class="chat-message-time">${this.formatTime(msg.timestamp)}</div>
          </div>
          <img class="chat-avatar avatar-tiny" src="https://gravatar.com/avatar/${this.hashEmail(msg.from)}?s=128">
        </div>
      ` : `
        <div class="chat-other">
          <img class="avatar-tiny" src="https://gravatar.com/avatar/${this.hashEmail(msg.from)}?s=128">
          <div class="chat-message">
            <div class="chat-message-inner">
              <strong>${msg.from}:</strong> ${msg.message}
            </div>
            <div class="chat-message-time">${this.formatTime(msg.timestamp)}</div>
          </div>
        </div>
      `;
      chatLog.insertAdjacentHTML("beforeend", DOMPurify.sanitize(messageHTML));
    });
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  closeChat(username) {
    const chatWindow = this.openedChats.get(username);
    if (chatWindow) {
      chatWindow.remove();
      this.openedChats.delete(username);
      this.repositionChatWindows();
    }
  }

  repositionChatWindows() {
    let index = 0;
    this.openedChats.forEach((chatWindow) => {
      chatWindow.style.right = `${20 + (index * 320)}px`;
      index++;
    });
  }

  addUnreadBadge(chatWindow) {
    // Add visual indicator for unread message
    const titleBar = chatWindow.querySelector('.chat-title-bar');
    if (!titleBar.querySelector('.unread-badge')) {
      titleBar.insertAdjacentHTML('afterbegin', '<span class="unread-badge"></span>');
    }
  }

  hashEmail(str) {
    // Simple hash for gravatar (in real app, use actual email hash)
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash).toString(16);
  }

  getTimeString() {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
}
