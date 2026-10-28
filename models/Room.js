// watch-party-server/models/Room.js
const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
  userId: String,    
  username: String,
  role: String      
});

const roomSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  currentVideoId: { type: String, default: 'jfKfPfyJRdk' },
  participants: [participantSchema]
});

module.exports = mongoose.model('Room', roomSchema);