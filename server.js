require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const Room = require('./models/Room');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});


mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('Connected to MongoDB successfully!');
    
 
    await Room.deleteMany({});
    console.log('Cleared old ghost rooms from DB.');
    
  })
  .catch((err) => console.error('MongoDB connection error:', err));

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);


  socket.on('join_room', async ({ roomId, username }) => {
    socket.join(roomId);
    
    try {
      let room = await Room.findOne({ roomId: roomId });
      
      if (!room) {
        room = new Room({
          roomId: roomId,
          participants: [],
          currentVideoId: 'jfKfPfyJRdk'
        });
      }

      const existingUser = room.participants.find(p => p.userId === socket.id);
      
      if (!existingUser) {
     
        const hasHost = room.participants.some(p => p.role === 'Host');
        const role = hasHost ? 'Participant' : 'Host';
        
        room.participants.push({
          userId: socket.id,
          username: username,
          role: role
        });
        
        await room.save();
      }

      io.to(roomId).emit('update_participants', room.participants);
      socket.emit('video_changed', room.currentVideoId);
      
    } catch (err) {
      console.error(err);
    }
  });


  socket.on('change_video', async ({ roomId, videoId }) => {
    try {
      const room = await Room.findOne({ roomId: roomId });
      if (room) {
        const user = room.participants.find(p => p.userId === socket.id);
        
        if (user && (user.role === 'Host' || user.role === 'Moderator')) {
          room.currentVideoId = videoId;
          await room.save();
          io.to(roomId).emit('video_changed', videoId);
        }
      }
    } catch (err) { console.error(err); }
  });


  socket.on('play', () => socket.to(Array.from(socket.rooms)[1]).emit('play'));
  socket.on('pause', () => socket.to(Array.from(socket.rooms)[1]).emit('pause'));
  socket.on('seek', (time) => socket.to(Array.from(socket.rooms)[1]).emit('seek', time));


  socket.on('assign_role', async ({ roomId, targetUserId, newRole }) => {
    try {
      const room = await Room.findOne({ roomId: roomId });
      if (room) {
        const requester = room.participants.find(p => p.userId === socket.id);
        if (requester && requester.role === 'Host') {
          const targetUser = room.participants.find(p => p.userId === targetUserId);
          if (targetUser) {
            targetUser.role = newRole;
            await room.save();
            io.to(roomId).emit('update_participants', room.participants);
          }
        }
      }
    } catch (err) { console.error(err); }
  });


  socket.on('disconnect', async () => {
    console.log(`User disconnected: ${socket.id}`);
    
    try {
      const room = await Room.findOne({ "participants.userId": socket.id });
      
      if (room) {
        
        room.participants = room.participants.filter(p => p.userId !== socket.id);
        
        if (room.participants.length === 0) {
         t
          await Room.deleteOne({ _id: room._id });
        } else {
       
          const hasHost = room.participants.some(p => p.role === 'Host');
          if (!hasHost && room.participants.length > 0) {
            room.participants[0].role = 'Host'; 
          }
          
          await room.save();
          io.to(room.roomId).emit('update_participants', room.participants);
        }
      }
    } catch (err) { console.error(err); }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});