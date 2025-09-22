// Global variables
let socket;
let currentUsername;
let selectedUser = null;
let typingTimer;
let usersList = {};

// DOM elements for login page
const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username');
const profileColorInput = document.getElementById('profile-color');

// DOM elements for chat page
const chatForm = document.getElementById('chat-form');
const msgInput = document.getElementById('msg');
const chatMessages = document.getElementById('chat-messages');
const usersList_DOM = document.getElementById('users-list');
const currentUserAvatar = document.getElementById('current-user-avatar');
const currentUserName = document.getElementById('current-user-name');
const chatUserAvatar = document.getElementById('chat-user-avatar');
const chatUserName = document.getElementById('chat-user-name');
const chatUserStatus = document.getElementById('chat-user-status');
const typingIndicator = document.getElementById('typing-indicator');
const userSearchInput = document.getElementById('user-search');

// Check if we're on the login page
if (loginForm) {
  // Login event handler
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const username = usernameInput.value.trim();
    const profileColor = profileColorInput.value;
    
    if (!username) return;
    
    // Save username and color to session storage
    sessionStorage.setItem('duoconnectify-username', username);
    sessionStorage.setItem('duoconnectify-color', profileColor);
    
    // Redirect to chat page
    window.location.href = 'chat.html';
  });
}
// Check if we're on the chat page
else if (chatForm) {
  // Get username and color from session storage
  currentUsername = sessionStorage.getItem('duoconnectify-username');
  const profileColor = sessionStorage.getItem('duoconnectify-color');
  
  // If no username is set, redirect to login page
  if (!currentUsername) {
    window.location.href = 'index.html';
   
  }
  
  // Initialize socket connection
  socket = io();
  
  // Join chat event
  socket.emit('userJoin', {
    username: currentUsername,
    profileColor
  });
  
  // Set current user's avatar and name
  currentUserAvatar.style.backgroundColor = profileColor;
  currentUserAvatar.textContent = getInitials(currentUsername);
  currentUserName.textContent = currentUsername;
  
  // Listen for existing users
  socket.on('existingUsers', (users) => {
    usersList = users;
    updateUsersList();
  });
  
  // User joined event
  socket.on('userJoined', (user) => {
    usersList[user.id] = user;
    updateUsersList();
  });
  
  // User left event
  socket.on('userLeft', (userData) => {
    if (usersList[userData.id]) {
      usersList[userData.id].online = false;
      usersList[userData.id].lastSeen = userData.lastSeen;
      updateUsersList();
      
      // Update chat header if the left user is currently selected
      if (selectedUser === userData.username) {
        updateChatHeader();
      }
    }
  });
  
  // Message received event
  socket.on('message', (message) => {
    addMessage(message, 'received');
    
    // If the message is from the selected user, mark as read
    if (message.from === selectedUser) {
      // Clear typing indicator
      typingIndicator.textContent = '';
    }
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
  
  // Message sent confirmation
  socket.on('messageSent', (data) => {
    // Add message to UI
    addMessage({
      from: currentUsername,
      message: data.message,
      timestamp: data.timestamp
    }, 'sent');
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
  
  // User typing event
  socket.on('userTyping', (data) => {
    if (data.from === selectedUser) {
      typingIndicator.textContent = `${selectedUser} is typing...`;
    }
  });
  
  // User stopped typing event
  socket.on('userStopTyping', (data) => {
    if (data.from === selectedUser) {
      typingIndicator.textContent = '';
    }
  });
  
  // Message submit event
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const message = msgInput.value.trim();
    
    if (!message || !selectedUser) return;
    
    // Send message to server
    socket.emit('chatMessage', {
      to: selectedUser,
      message
    });
    
    // Clear input
    msgInput.value = '';
    msgInput.focus();
    
    // Clear typing indicator
    clearTimeout(typingTimer);
    socket.emit('stopTyping', { to: selectedUser });
  });
  
  // Input event for typing indicator
  msgInput.addEventListener('input', () => {
    if (!selectedUser) return;
    
    // Send typing event
    socket.emit('typing', { to: selectedUser });
    
    // Clear previous timer
    clearTimeout(typingTimer);
    
    // Set timer to stop typing
    typingTimer = setTimeout(() => {
      socket.emit('stopTyping', { to: selectedUser });
    }, 2000);
  });
  
  // User search event
  userSearchInput.addEventListener('input', () => {
    updateUsersList();
  });
}

// Helper function to get initials from username
function getInitials(name) {
  return name.charAt(0).toUpperCase();
}

// Helper function to format date
function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  
  // Check if the date is today
  if (date.toDateString() === now.toDateString()) {
    return `Today at ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
  }
  
  // Check if the date is yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday at ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
  }
  
  // Otherwise return the full date
  return `${date.toLocaleDateString()} at ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
}

// Helper function to update users list
function updateUsersList() {
  usersList_DOM.innerHTML = '';
  
  // Get search term
  const searchTerm = userSearchInput.value.trim().toLowerCase();
  
  // Convert users object to array for sorting
  const usersArray = Object.values(usersList);
  
  // Filter out current user and apply search filter
  const filteredUsers = usersArray.filter(user => {
    return user.username !== currentUsername && 
           user.username.toLowerCase().includes(searchTerm);
  });
  
  // Sort users: online first, then by username
  filteredUsers.sort((a, b) => {
    if (a.online && !b.online) return -1;
    if (!a.online && b.online) return 1;
    return a.username.localeCompare(b.username);
  });
  
  // Add users to the list
  filteredUsers.forEach(user => {
    const userItem = document.createElement('div');
    userItem.classList.add('user-item');
    
    if (user.username === selectedUser) {
      userItem.classList.add('active');
    }
    
    userItem.innerHTML = `
      <div class="user-avatar" style="background-color: ${user.profileColor}">
        ${getInitials(user.username)}
      </div>
      <div class="user-item-details">
        <div class="user-item-name">${user.username}</div>
        <div class="user-item-status">
          <span class="online-indicator ${user.online ? 'online' : 'offline'}"></span>
          ${user.online ? 'Online' : 'Last seen ' + formatDate(user.lastSeen)}
        </div>
      </div>
    `;
    
    // Add click event
    userItem.addEventListener('click', () => {
      selectUser(user.username, user.profileColor, user.online, user.lastSeen);
    });
    
    usersList_DOM.appendChild(userItem);
  });
}

// Helper function to select a user
function selectUser(username, profileColor, online, lastSeen) {
  // Update selected user
  selectedUser = username;
  
  // Update active class in users list
  const userItems = document.querySelectorAll('.user-item');
  userItems.forEach(item => {
    item.classList.remove('active');
    if (item.querySelector('.user-item-name').textContent === username) {
      item.classList.add('active');
    }
  });
  
  // Update chat header
  chatUserAvatar.style.backgroundColor = profileColor;
  chatUserAvatar.textContent = getInitials(username);
  chatUserName.textContent = username;
  
  // Update status
  chatUserStatus.innerHTML = `
    <span class="online-indicator ${online ? 'online' : 'offline'}"></span>
    ${online ? 'Online' : 'Last seen ' + formatDate(lastSeen)}
  `;
  
  // Clear chat messages
  chatMessages.innerHTML = '';
  
  // Enable chat form
  msgInput.disabled = false;
  chatForm.querySelector('button').disabled = false;
  
  // Focus on message input
  msgInput.focus();
}

// Helper function to update chat header
function updateChatHeader() {
  if (selectedUser) {
    // Find user in users list
    const user = Object.values(usersList).find(u => u.username === selectedUser);
    
    if (user) {
      chatUserStatus.innerHTML = `
        <span class="online-indicator ${user.online ? 'online' : 'offline'}"></span>
        ${user.online ? 'Online' : 'Last seen ' + formatDate(user.lastSeen)}
      `;
    }
  }
}

// Helper function to add message to UI
function addMessage(message, type) {
  const div = document.createElement('div');
  div.classList.add('message', type);
  
  let profileColor = '';
  if (type === 'received') {
    // Find the sender in usersList
    const sender = Object.values(usersList).find(u => u.username === message.from);
    if (sender) {
      profileColor = sender.profileColor;
    }
  } else {
    profileColor = sessionStorage.getItem('duoconnectify-color');
  }
  
  div.innerHTML = `
    <div class="message-content">
      <div class="message-text">${message.message}</div>
      <div class="message-timestamp">${formatDate(message.timestamp)}</div>
    </div>
  `;
  
  chatMessages.appendChild(div);
}
