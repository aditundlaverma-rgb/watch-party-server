const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

// Initialize Socket.IO and allow connections from the Vite frontend
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", 
    methods: ["GET", "POST"]
  }
});

// In-memory storage for rooms (MVP database)
const rooms = {};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // 1. Join Room & Assign Roles
  socket.on('join_room', ({ roomId, username }) => {
    socket.join(roomId);
    
    // If the room doesn't exist yet, create it
    if (!rooms[roomId]) {
      rooms[roomId] = {
        participants: [],
        currentVideoId: 'jfKfPfyJRdk', // Default video
      };
    }

    // Assign 'Host' if they are the first person, otherwise 'Participant'
    const role = rooms[roomId].participants.length === 0 ? 'Host' : 'Participant';
    
    const newUser = {
      userId: socket.id,
      username: username,
      role: role
    };

    rooms[roomId].participants.push(newUser);
    console.log(`${username} joined ${roomId} as ${role}`);

    // Broadcast updated participant list to EVERYONE in the room
    io.to(roomId).emit('update_participants', rooms[roomId].participants);
    
    // Sync the new user with whatever video is currently playing
    socket.emit('video_changed', rooms[roomId].currentVideoId);
  });

  // 2. Change Video
  socket.on('change_video', ({ roomId, videoId }) => {
    const room = rooms[roomId];
    if (room) {
      const user = room.participants.find(p => p.userId === socket.id);
      
      // Validate permissions: Only Host/Moderator can change the video
      if (user && (user.role === 'Host' || user.role === 'Moderator')) {
        room.currentVideoId = videoId;
        io.to(roomId).emit('video_changed', videoId);
        console.log(`Video changed in ${roomId} to ${videoId} by ${user.username}`);
      } else {
        console.log(`Unauthorized video change attempt by ${user?.username}`);
      }
    }
  });

  // 3. Playback Synchronization
  socket.on('play', ({ roomId }) => {
    const room = rooms[roomId];
    const user = room?.participants.find(p => p.userId === socket.id);
    if (user && (user.role === 'Host' || user.role === 'Moderator')) {
      socket.to(roomId).emit('play');
    }
  });

  socket.on('pause', ({ roomId }) => {
    const room = rooms[roomId];
    const user = room?.participants.find(p => p.userId === socket.id);
    if (user && (user.role === 'Host' || user.role === 'Moderator')) {
      socket.to(roomId).emit('pause');
    }
  });

  socket.on('seek', ({ roomId, time }) => {
    const room = rooms[roomId];
    const user = room?.participants.find(p => p.userId === socket.id);
    if (user && (user.role === 'Host' || user.role === 'Moderator')) {
      socket.to(roomId).emit('seek', time);
    }
  });

  // 4. Role Management: Promote to Moderator (Host only)
  socket.on('assign_role', ({ roomId, targetUserId, newRole }) => {
    const room = rooms[roomId];
    const requester = room?.participants.find(p => p.userId === socket.id);
    
    if (requester && requester.role === 'Host') {
      const targetUser = room.participants.find(p => p.userId === targetUserId);
      if (targetUser) {
        targetUser.role = newRole;
        io.to(roomId).emit('update_participants', room.participants);
        console.log(`${targetUser.username} was promoted to ${newRole}`);
      }
    }
  });

  // 5. Role Management: Kick Participant (Host only)
  socket.on('remove_participant', ({ roomId, targetUserId }) => {
    const room = rooms[roomId];
    const requester = room?.participants.find(p => p.userId === socket.id);
    
    if (requester && requester.role === 'Host') {
      const userIndex = room.participants.findIndex(p => p.userId === targetUserId);
      if (userIndex !== -1) {
        // Tell the specific user they have been kicked
        io.to(targetUserId).emit('kicked');
        
        // Remove them from the server array
        room.participants.splice(userIndex, 1);
        
        // Update everyone else's UI
        io.to(roomId).emit('update_participants', room.participants);
      }
    }
  });

  // 6. Handle Disconnections
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const userIndex = room.participants.findIndex(p => p.userId === socket.id);
      
      if (userIndex !== -1) {
        room.participants.splice(userIndex, 1);
        
        // Tell everyone left in the room that the list changed
        io.to(roomId).emit('update_participants', room.participants);
        
        // Cleanup empty rooms to free up memory
        if (room.participants.length === 0) {
          delete rooms[roomId];
        }
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});