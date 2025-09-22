const express = require('express');
const http = require('http');
const path = require('path');
const socketio = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Set static folder
app.use(express.static(path.join(__dirname, 'public')));

// Store users
const users = {};
const userSocketMap = {};

// Run when a client connects
io.on('connection', socket => {
  console.log('New connection established');
  
  // User joins
  socket.on('userJoin', ({username, profileColor}) => {
    users[socket.id] = {
      username,
      profileColor,
      lastSeen: new Date().toISOString(),
      online: true
    };
    userSocketMap[username] = socket.id;
    
    // Send existing users to the new user
    socket.emit('existingUsers', users);
    
    // Broadcast to all users that a new user has joined
    socket.broadcast.emit('userJoined', {
      id: socket.id,
      username,
      profileColor,
      lastSeen: users[socket.id].lastSeen,
      online: true
    });
    
    console.log(`${username} joined the chat`);
  });
  
  // Listen for chat messages
  socket.on('chatMessage', (messageData) => {
    const { to, message } = messageData;
    const from = users[socket.id].username;
    
    // Store message timestamp
    const timestamp = new Date().toISOString();
    
    // Send message to the recipient
    const recipientSocketId = userSocketMap[to];
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('message', {
        from,
        message,
        timestamp,
        profileColor: users[socket.id].profileColor
      });
    }
    
    // Send confirmation back to sender
    socket.emit('messageSent', {
      to,
      message,
      timestamp
    });
    
    console.log(`Message sent from ${from} to ${to}`);
  });
  
  // User typing
  socket.on('typing', ({to}) => {
    const from = users[socket.id].username;
    const recipientSocketId = userSocketMap[to];
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('userTyping', {
        from
      });
    }
  });
  
  // User stops typing
  socket.on('stopTyping', ({to}) => {
    const from = users[socket.id].username;
    const recipientSocketId = userSocketMap[to];
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('userStopTyping', {
        from
      });
    }
  });
  
  // User disconnect
  socket.on('disconnect', () => {
    if (users[socket.id]) {
      const username = users[socket.id].username;
      
      // Update user status
      users[socket.id].online = false;
      users[socket.id].lastSeen = new Date().toISOString();
      
      // Broadcast to all users that a user has left
      io.emit('userLeft', {
        id: socket.id,
        username,
        lastSeen: users[socket.id].lastSeen
      });
      
      console.log(`${username} left the chat`);
      
      // Clean up after some time
      setTimeout(() => {
        delete userSocketMap[username];
        delete users[socket.id];
      }, 3600000); // Keep offline users for 1 hour
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));