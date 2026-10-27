const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});
const rooms = {};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
socket.on('join_room', ({ roomId, username }) => {
socket.join(roomId);
  if (!rooms[roomId]) {
      rooms[roomId] = {
        participants: [],
        currentVideoId: 'jfKfPfyJRdk', 
      };
    }
const existingUser = rooms[roomId].participants.find(p => p.userId === socket.id);
    if (!existingUser) {
      const role = rooms[roomId].participants.length === 0 ? 'Host' : 'Participant';
      
      const newUser = {
        userId: socket.id,
        username: username,
        role: role
      };

      rooms[roomId].participants.push(newUser);
      console.log(`${username} joined ${roomId} as ${role}`);
    }
io.to(roomId).emit('update_participants', rooms[roomId].participants);
    socket.emit('video_changed', rooms[roomId].currentVideoId);
  });
socket.on('change_video', ({ roomId, videoId }) => {
    const room = rooms[roomId];
if (room) {
      const user = room.participants.find(p => p.userId === socket.id);
  if (user && (user.role === 'Host' || user.role === 'Moderator')) {
        room.currentVideoId = videoId;
        io.to(roomId).emit('video_changed', videoId);
        console.log(`Video changed in ${roomId} to ${videoId} by ${user.username}`);
      } else {
        console.log(`Unauthorized video change attempt by ${user?.username}`);
      }
    }
  });

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

socket.on('remove_participant', ({ roomId, targetUserId }) => {
  const room = rooms[roomId];
  const requester = room?.participants.find(p => p.userId === socket.id);
    
if (requester && requester.role === 'Host') {
      const userIndex = room.participants.findIndex(p => p.userId === targetUserId);
  if (userIndex !== -1) {
  io.to(targetUserId).emit('kicked');
  room.participants.splice(userIndex, 1);
  io.to(roomId).emit('update_participants', room.participants); 
}}});

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  for (const roomId in rooms) {
     const room = rooms[roomId];
      const userIndex = room.participants.findIndex(p => p.userId === socket.id);
      
      if (userIndex !== -1) {
        room.participants.splice(userIndex, 1);
         io.to(roomId).emit('update_participants', room.participants);
        
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