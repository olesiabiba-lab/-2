const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files from public directory
app.use(express.static('public'));

// Store connected users and campfire state
let connectedUsers = new Map(); // socketId -> {name, position}
let currentSelection = null;
let selectionInterval = null;
let intervalSettings = {
  min: 5000, // 5 seconds
  max: 10000 // 10 seconds
};

// Function to get random interval within range
function getRandomInterval() {
  return Math.floor(Math.random() * (intervalSettings.max - intervalSettings.min + 1)) + intervalSettings.min;
}

// Function to select random user
function selectRandomUser() {
  const users = Array.from(connectedUsers.values());
  if (users.length === 0) {
    currentSelection = { name: "Нияз", isDefault: true };
  } else {
    const randomUser = users[Math.floor(Math.random() * users.length)];
    currentSelection = { name: randomUser.name, isDefault: false, position: randomUser.position };
  }
  
  // Broadcast the selection to all clients
  io.emit('userSelected', currentSelection);
  
  console.log(`Selected user: ${currentSelection.name}`);
}

// Function to start the selection interval
function startSelectionInterval() {
  if (selectionInterval) {
    clearInterval(selectionInterval);
  }
  
  const interval = getRandomInterval();
  console.log(`Next selection in ${interval/1000} seconds`);
  
  selectionInterval = setTimeout(() => {
    selectRandomUser();
    startSelectionInterval(); // Schedule next selection
  }, interval);
}

// Function to calculate positions around the campfire
function calculateUserPositions() {
  const users = Array.from(connectedUsers.values());
  const totalUsers = users.length;
  
  users.forEach((user, index) => {
    const angle = (index / totalUsers) * 2 * Math.PI - Math.PI / 2; // Start from top
    const radius = 200; // Distance from campfire center
    
    user.position = {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      angle: angle
    };
  });
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);
  
  // Send current state to new user
  socket.emit('currentState', {
    users: Array.from(connectedUsers.values()),
    currentSelection: currentSelection,
    intervalSettings: intervalSettings
  });
  
  // Handle user joining with name
  socket.on('joinCampfire', (data) => {
    const { name, intervalMin, intervalMax } = data;
    
    // If this is the first user, they can set the interval
    if (connectedUsers.size === 0 && intervalMin && intervalMax) {
      intervalSettings.min = Math.max(3000, intervalMin * 1000); // Min 3 seconds
      intervalSettings.max = Math.min(30000, intervalMax * 1000); // Max 30 seconds
      console.log(`Interval settings updated: ${intervalSettings.min/1000}s - ${intervalSettings.max/1000}s`);
    }
    
    // Add user to connected users
    connectedUsers.set(socket.id, { 
      name: name,
      socketId: socket.id,
      position: { x: 0, y: 0, angle: 0 }
    });
    
    // Recalculate positions for all users
    calculateUserPositions();
    
    // Broadcast updated user list to all clients
    io.emit('usersUpdated', Array.from(connectedUsers.values()));
    
    console.log(`${name} joined the campfire`);
    
    // Start selection interval if this is the first user
    if (connectedUsers.size === 1) {
      console.log('Starting campfire selection interval...');
      startSelectionInterval();
    }
  });
  
  // Handle user leaving manually
  socket.on('leaveCampfire', () => {
    handleUserDisconnection(socket.id);
  });
  
  // Handle user disconnection
  socket.on('disconnect', () => {
    handleUserDisconnection(socket.id);
  });
  
  // Function to handle user leaving/disconnecting
  function handleUserDisconnection(socketId) {
    const user = connectedUsers.get(socketId);
    if (user) {
      console.log(`${user.name} left the campfire`);
      connectedUsers.delete(socketId);
      
      // Recalculate positions for remaining users
      calculateUserPositions();
      
      // Broadcast updated user list
      io.emit('usersUpdated', Array.from(connectedUsers.values()));
      
      // If no users left, clear the selection interval
      if (connectedUsers.size === 0) {
        if (selectionInterval) {
          clearTimeout(selectionInterval);
          selectionInterval = null;
        }
        currentSelection = null;
        console.log('All users left, stopping selection interval');
      }
      
      // If the disconnected user was selected, select a new one
      if (currentSelection && currentSelection.name === user.name && !currentSelection.isDefault) {
        selectRandomUser();
      }
    }
  }
});

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🔥 AI Костёр server running on http://localhost:${PORT}`);
  console.log('Open this URL in multiple browser tabs to test real-time sync!');
});