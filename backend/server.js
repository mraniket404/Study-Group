import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "http://10.117.114.135:5173"
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://10.117.114.135:5173"
  ],
  credentials: true
}));
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/studygroup', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ MongoDB Connected Successfully');
})
.catch((error) => {
  console.error('❌ MongoDB Connection Error:', error);
});

// Schemas
const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  role: String,
}, { timestamps: true });

const GroupSchema = new mongoose.Schema({
  name: String,
  description: String,
  code: String,
  mentor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

const MessageSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
}, { timestamps: true });

const NoteSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  content: String,
  lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const QuestionSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  question: { type: String, required: true },
  answer: String,
  answeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  answeredAt: Date,
}, { timestamps: true });

const VideoCallSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  startedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['active', 'ended'], default: 'active' },
  startTime: { type: Date, default: Date.now },
  endTime: Date,
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);
const Group = mongoose.model('Group', GroupSchema);
const Message = mongoose.model('Message', MessageSchema);
const Note = mongoose.model('Note', NoteSchema);
const Question = mongoose.model('Question', QuestionSchema);
const VideoCall = mongoose.model('VideoCall', VideoCallSchema);

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword, role });
    await user.save();

    const token = jwt.sign({ userId: user._id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.status(201).json({ message: 'User created', token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ userId: user._id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ message: 'Login successful', token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Group Routes
app.post('/api/groups/create', authenticateToken, async (req, res) => {
  try {
    const { name, description } = req.body;
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const group = new Group({ name, description, code, mentor: req.user.userId, members: [req.user.userId] });
    await group.save();
    await group.populate('mentor', 'name _id');
    res.status(201).json({ message: 'Group created', group });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.post('/api/groups/join', authenticateToken, async (req, res) => {
  try {
    const { code } = req.body;
    const group = await Group.findOne({ code }).populate('mentor', 'name _id');
    if (!group) return res.status(404).json({ message: 'Group not found' });

    if (group.members.includes(req.user.userId)) return res.status(400).json({ message: 'Already a member' });
    group.members.push(req.user.userId);
    await group.save();
    res.json({ message: 'Joined group', group });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.get('/api/groups/my', authenticateToken, async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user.userId })
      .populate('mentor', 'name _id')
      .populate('members', 'name');
    res.json(groups);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Data Routes
app.get('/api/messages/:groupId', authenticateToken, async (req, res) => {
  try {
    const messages = await Message.find({ group: req.params.groupId })
      .populate('user', 'name email')
      .sort({ createdAt: 1 });
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.get('/api/notes/:groupId', authenticateToken, async (req, res) => {
  try {
    let note = await Note.findOne({ group: req.params.groupId });
    if (!note) {
      note = new Note({
        group: req.params.groupId,
        content: '',
        lastUpdatedBy: req.user.userId
      });
      await note.save();
    }
    res.json(note);
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.get('/api/questions/:groupId', authenticateToken, async (req, res) => {
  try {
    const questions = await Question.find({ group: req.params.groupId })
      .populate('user', 'name')
      .populate('answeredBy', 'name')
      .sort({ createdAt: -1 });
    res.json(questions);
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.post('/api/messages', authenticateToken, async (req, res) => {
  try {
    const { groupId, content } = req.body;
    
    const message = new Message({
      group: groupId,
      user: req.user.userId,
      content: content
    });
    
    await message.save();
    
    const messageWithUser = await Message.findById(message._id)
      .populate('user', 'name');
      
    res.status(201).json(messageWithUser);
  } catch (error) {
    console.error('Error saving message:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Store active video call rooms: Map<groupId, { callId, startedBy, participants: Map<userId, { socketId, userName }> }>
const activeVideoCalls = new Map();

// Socket.IO - COMPLETE WEBRTC IMPLEMENTATION
io.on('connection', (socket) => {
  console.log('🔌 NEW USER CONNECTED:', socket.id);

  // Test immediate event
  socket.emit('connection_test', { 
    message: 'Connected to server successfully',
    socketId: socket.id,
    timestamp: new Date().toISOString()
  });

  // Join group room
  socket.on('joinRoom', async ({ groupId }) => {
    try {
      console.log(`🎯 JOIN ROOM: User ${socket.id} joining room ${groupId}`);
      
      socket.join(groupId);
      console.log(`✅ User ${socket.id} joined room: ${groupId}`);
      
      socket.emit('room_joined', { 
        room: groupId, 
        success: true,
        message: `Successfully joined room ${groupId}`
      });

      // Send existing messages
      const messages = await Message.find({ group: groupId })
        .populate('user', 'name')
        .sort({ createdAt: 1 });
      
      socket.emit('existing_messages', messages);
      
      // Check for active call and notify the joiner
      const activeCall = activeVideoCalls.get(groupId);
      if (activeCall) {
        const startedBy = await User.findById(activeCall.startedBy).select('name _id');
        const groupData = await Group.findById(groupId).select('name');

        socket.emit('videoCallStarted', {
          callId: activeCall.callId,
          startedBy: startedBy,
          groupId: groupId,
          groupName: groupData.name,
          message: `${startedBy.name} started a video call`,
          timestamp: new Date()
        });
      }

    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('room_join_error', { error: 'Failed to join room' });
    }
  });

  // Handle chat messages
  socket.on('sendMessage', async (data) => {
    try {
      console.log('💬 SEND MESSAGE EVENT RECEIVED:', data);

      if (!data.groupId || !data.userId || !data.content) {
        socket.emit('message_error', { error: 'Missing required fields' });
        return;
      }

      const group = await Group.findById(data.groupId);
      if (!group) {
        socket.emit('message_error', { error: 'Group not found' });
        return;
      }

      const message = new Message({
        group: data.groupId,
        user: data.userId,
        content: data.content
      });
      
      const savedMessage = await message.save();
      const messageWithUser = await Message.findById(savedMessage._id)
        .populate('user', 'name _id');

      io.to(data.groupId).emit('newMessage', messageWithUser);
      socket.emit('message_sent', { success: true, messageId: savedMessage._id });

    } catch (error) {
      console.error('❌ Error in sendMessage:', error);
      socket.emit('message_error', { error: 'Failed to send message: ' + error.message });
    }
  });

  // Handle note updates
  socket.on('updateNote', async (data) => {
    try {
      let note = await Note.findOne({ group: data.groupId });
      
      if (!note) {
        note = new Note({
          group: data.groupId,
          content: data.content,
          lastUpdatedBy: data.userId
        });
      } else {
        note.content = data.content;
        note.lastUpdatedBy = data.userId;
      }
      
      await note.save();
      
      io.to(data.groupId).emit('noteUpdated', {
        content: data.content,
        lastUpdated: new Date(),
        lastUpdatedBy: data.userId
      });
      
    } catch (error) {
      console.error('❌ Error updating note:', error);
      socket.emit('note_error', { error: 'Failed to update note' });
    }
  });

  // Handle Q&A
  socket.on('createQuestion', async (data) => {
    try {
      const question = new Question({
        group: data.groupId,
        user: data.userId,
        question: data.question
      });
      
      await question.save();

      const questionWithUser = await Question.findById(question._id)
        .populate('user', 'name');

      io.to(data.groupId).emit('newQuestion', questionWithUser);
      
    } catch (error) {
      console.error('❌ Error creating question:', error);
      socket.emit('question_error', { error: 'Failed to create question' });
    }
  });

  socket.on('answerQuestion', async (data) => {
    try {
      const question = await Question.findById(data.questionId);
      if (!question) {
        socket.emit('answer_error', { error: 'Question not found' });
        return;
      }

      question.answer = data.answer;
      question.answeredBy = data.userId;
      question.answeredAt = new Date();
      
      await question.save();

      const updatedQuestion = await Question.findById(question._id)
        .populate('user', 'name')
        .populate('answeredBy', 'name');

      io.to(data.groupId).emit('questionAnswered', updatedQuestion);
      
    } catch (error) {
      console.error('❌ Error answering question:', error);
      socket.emit('answer_error', { error: 'Failed to answer question' });
    }
  });

  // Helper function to get participant socket ID for signaling
  const getRecipientSocketId = (groupId, userId) => {
    const activeCall = activeVideoCalls.get(groupId);
    if (activeCall) {
      const participantData = activeCall.participants.get(userId);
      return participantData ? participantData.socketId : null;
    }
    return null;
  };

  // ✅ COMPLETE VIDEO CALL IMPLEMENTATION WITH WEBRTC

  // Mentor starts video call
  socket.on('startVideoCall', async (data) => {
    try {
      console.log('🎥 START VIDEO CALL:', data);
      
      const { groupId, userId, userName } = data;

      const user = await User.findById(userId);
      if (!user || user.role !== 'mentor') {
        socket.emit('video_call_error', { error: 'Only mentors can start video calls' });
        return;
      }

      const group = await Group.findById(groupId);
      if (!group) {
        socket.emit('video_call_error', { error: 'Group not found' });
        return;
      }

      // End any existing active call for this group
      await VideoCall.updateMany(
        { group: groupId, status: 'active' },
        { status: 'ended', endTime: new Date() }
      );
      // Cleanup active map
      if (activeVideoCalls.has(groupId)) {
        const endedCallId = activeVideoCalls.get(groupId).callId;
        io.socketsLeave(`video-call-${endedCallId}`);
        activeVideoCalls.delete(groupId);
      }


      // Create video call record
      const videoCall = new VideoCall({
        group: groupId,
        startedBy: userId,
        participants: [userId],
        status: 'active'
      });
      await videoCall.save();
      await videoCall.populate('startedBy', 'name');

      const callRoom = `video-call-${videoCall._id}`;
      socket.join(callRoom);

      // Store video call in active calls map (for signaling)
      const activeCall = {
        callId: videoCall._id.toString(),
        startedBy: userId.toString(),
        participants: new Map() 
      };
      activeCall.participants.set(userId.toString(), {
        socketId: socket.id,
        userName: userName,
        joinedAt: new Date()
      });
      activeVideoCalls.set(groupId, activeCall);

      console.log('✅ Video call started by mentor:', userName);

      // Notify ALL group members (including mentor for consistency)
      const callData = {
        callId: videoCall._id,
        startedBy: { 
          _id: userId, 
          name: userName 
        },
        groupId: groupId,
        groupName: group.name,
        message: `${userName} started a video call`,
        timestamp: new Date()
      };
      io.to(groupId).emit('videoCallStarted', callData);
      
      // Send specific success event to mentor (including participant list for WebRTC init)
      socket.emit('videoCallStartedSuccess', {
        callId: videoCall._id,
        startedBy: { _id: userId, name: userName },
        groupId: groupId,
        message: 'Video call started successfully! Students can now join.',
        // Pass the current participant list back to the initiator
        participants: [{ _id: userId, name: userName }] 
      });

    } catch (error) {
      console.error('❌ Error starting video call:', error);
      socket.emit('video_call_error', { error: 'Failed to start video call: ' + error.message });
    }
  });

  // User joins video call
  socket.on('joinVideoCall', async (data) => {
    try {
      console.log('🎥 JOIN VIDEO CALL:', data);
      
      const { callId, userId, userName, groupId } = data;

      const videoCall = await VideoCall.findById(callId)
        .populate('startedBy', 'name')
        .populate('participants', 'name');

      if (!videoCall || videoCall.status === 'ended') {
        socket.emit('video_call_error', { error: 'Video call not found or has ended' });
        return;
      }

      // Add participant if not already joined (MongoDB update)
      const userIdStr = userId.toString();
      if (!videoCall.participants.some(p => p._id.toString() === userIdStr)) {
        videoCall.participants.push(userId);
        await videoCall.save();
        await videoCall.populate('participants', 'name');
      }

      // Join the video call room (Socket.io room for signaling)
      const callRoom = `video-call-${callId}`;
      socket.join(callRoom);

      // Store participant socket connection in active map
      const activeCall = activeVideoCalls.get(groupId);
      if (activeCall) {
        activeCall.participants.set(userIdStr, {
          socketId: socket.id,
          userName: userName,
          joinedAt: new Date()
        });
        
        console.log(`✅ User ${userName} stored in active call map for group ${groupId}`);
      } else {
        console.warn(`❌ Active call map missing for group ${groupId}. Creating new entry.`);
        // Create new active call entry if missing
        const newActiveCall = {
          callId: callId,
          startedBy: videoCall.startedBy.toString(),
          participants: new Map()
        };
        newActiveCall.participants.set(userIdStr, {
          socketId: socket.id,
          userName: userName,
          joinedAt: new Date()
        });
        activeVideoCalls.set(groupId, newActiveCall);
      }

      // Notify all participants in the signaling room that someone joined
      io.to(callRoom).emit('participantJoined', {
        callId: callId,
        participant: { _id: userId, name: userName, socketId: socket.id },
        participantsCount: videoCall.participants.length,
        participantList: videoCall.participants // Send the DB list (populated)
      });

      // Send confirmation to the joiner (includes current list of participants to call)
      socket.emit('videoCallJoinedSuccess', {
        callId: callId,
        startedBy: videoCall.startedBy,
        participants: videoCall.participants,
        message: 'Successfully joined video call'
      });

      // Notify the main group chat room about participant joining
      io.to(videoCall.group.toString()).emit('videoCallParticipantJoined', {
        callId: callId,
        participant: { _id: userId, name: userName },
        participantsCount: videoCall.participants.length
      });

      console.log(`✅ User ${userName} joined video call ${callId}`);

    } catch (error) {
      console.error('❌ Error joining video call:', error);
      socket.emit('video_call_error', { error: 'Failed to join video call: ' + error.message });
    }
  });

  // WebRTC Signaling Events
  const handleSignaling = (eventName) => (data) => {
    console.log(`📞 ${eventName} from: ${data.from} to: ${data.to} (Call: ${data.callId})`);
    const { to: recipientUserId, from: senderUserId, callId } = data;
    
    // FIX: Better groupId extraction
    let groupId = null;
    for (const [gid, activeCall] of activeVideoCalls.entries()) {
      if (activeCall.callId === callId) {
        groupId = gid;
        break;
      }
    }

    if (!groupId) {
      console.warn(`❌ No active call found for callId: ${callId}`);
      socket.emit('video_call_error', { error: `Call ${callId} not found or ended` });
      return;
    }

    // Lookup recipient's current socketId
    const recipientSocketId = getRecipientSocketId(groupId, recipientUserId);

    if (recipientSocketId) {
      console.log(`✅ Forwarding ${eventName} to socket: ${recipientSocketId}`);
      // Send signal to the specific user's socket ID
      io.to(recipientSocketId).emit(eventName, data);
    } else {
      console.warn(`❌ Recipient user ${recipientUserId} for call ${callId} not found in active call map.`);
      // Notify sender that recipient is unavailable
      socket.emit('video_call_error', { 
        error: `User ${recipientUserId} is not in the call right now. They may have left or not joined yet.` 
      });
    }
  };

  socket.on('webrtc-offer', handleSignaling('webrtc-offer'));
  socket.on('webrtc-answer', handleSignaling('webrtc-answer'));
  socket.on('webrtc-ice-candidate', handleSignaling('webrtc-ice-candidate'));


  // User leaves video call
  socket.on('leaveVideoCall', async (data) => {
    try {
      console.log('🎥 LEAVE VIDEO CALL:', data);
      
      const { callId, userId, userName, groupId } = data;

      const videoCall = await VideoCall.findById(callId);
      if (videoCall) {
        // Remove participant from DB list
        videoCall.participants = videoCall.participants.filter(p => p.toString() !== userId);
        await videoCall.save();

        // Remove from active calls map
        const activeCall = activeVideoCalls.get(groupId);
        if (activeCall) {
          activeCall.participants.delete(userId);
          // If the last participant leaves, end the call
          if (activeCall.participants.size === 0) {
            activeVideoCalls.delete(groupId);
            videoCall.status = 'ended';
            videoCall.endTime = new Date();
            await videoCall.save();
            // Notify the group room only if the call ended due to last person leaving
            io.to(groupId).emit('videoCallEnded', { callId: callId, message: 'Video call ended (last participant left)' });
          }
        }

        // Notify other participants in the signaling room
        const callRoom = `video-call-${callId}`;
        socket.to(callRoom).emit('participantLeft', {
          callId: callId,
          participant: { _id: userId, name: userName },
          participantsCount: videoCall.participants.length
        });

        // Leave the room
        socket.leave(callRoom);

        console.log(`✅ User ${userName} left video call ${callId}`);
      }
    } catch (error) {
      console.error('❌ Error leaving video call:', error);
    }
  });

  // Mentor ends video call
  socket.on('endVideoCall', async (data) => {
    try {
      console.log('🎥 END VIDEO CALL:', data);
      
      const { callId, userId, groupId } = data;

      const videoCall = await VideoCall.findById(callId).populate('group');
      
      if (!videoCall || videoCall.status === 'ended') {
        socket.emit('video_call_error', { error: 'Video call not found or already ended' });
        return;
      }

      // Check if user is the one who started the call (or a mentor)
      const user = await User.findById(userId);
      if (user.role !== 'mentor') {
        socket.emit('video_call_error', { error: 'Only a mentor can end the call' });
        return;
      }


      videoCall.status = 'ended';
      videoCall.endTime = new Date();
      await videoCall.save();

      // Remove from active calls map
      activeVideoCalls.delete(groupId);

      // Notify all participants in the signaling room
      const callRoom = `video-call-${callId}`;
      io.to(callRoom).emit('videoCallEnded', {
        callId: callId,
        endedBy: userId,
        message: 'Video call has ended by the mentor.'
      });

      // Notify the entire group chat room
      io.to(groupId).emit('videoCallEnded', {
        callId: callId,
        endedBy: userId,
        message: 'Video call has ended by the mentor.'
      });

      // Cleanup - disconnect all from signaling room
      io.socketsLeave(callRoom);

      console.log(`✅ Video call ${callId} ended by ${userId}`);

    } catch (error) {
      console.error('❌ Error ending video call:', error);
      socket.emit('video_call_error', { error: 'Failed to end video call' });
    }
  });

  // Toggle audio/video
  socket.on('toggleMedia', (data) => {
    const { callId, userId, mediaType, enabled } = data;
    const callRoom = `video-call-${callId}`;
    
    // Broadcast to others in the signaling room
    socket.to(callRoom).emit('participantMediaToggled', {
      participant: userId,
      mediaType: mediaType,
      enabled: enabled
    });
  });

  socket.on('testMessage', (data) => {
    console.log('🧪 TEST MESSAGE RECEIVED:', data);
    socket.emit('test_response', { 
      message: 'Test successful!', 
      receivedData: data,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('disconnect', async () => {
    console.log('🔌 User disconnected:', socket.id);
    
    // Attempt to find if the disconnected socket was in an active call
    for (const [groupId, activeCall] of activeVideoCalls.entries()) {
      let userIdToCleanup = null;
      
      // Find the userId associated with the disconnected socketId
      for (const [userId, participant] of activeCall.participants.entries()) {
        if (participant.socketId === socket.id) {
          userIdToCleanup = userId;
          break;
        }
      }

      if (userIdToCleanup) {
        console.log(`🧹 Cleaned up disconnected user ${userIdToCleanup} from call ${activeCall.callId}`);
        
        // Remove from active call map
        activeCall.participants.delete(userIdToCleanup);

        // Notify other participants in the signaling room
        const callRoom = `video-call-${activeCall.callId}`;
        socket.to(callRoom).emit('participantLeft', {
          callId: activeCall.callId,
          participant: { _id: userIdToCleanup, name: 'Disconnected User' },
          participantsCount: activeCall.participants.size
        });
        
        // If the last participant leaves, end the call
        if (activeCall.participants.size === 0) {
          activeVideoCalls.delete(groupId);
          
          // Update DB and notify group chat
          await VideoCall.findByIdAndUpdate(activeCall.callId, { 
            status: 'ended', 
            endTime: new Date() 
          });
          io.to(groupId).emit('videoCallEnded', { 
            callId: activeCall.callId, 
            message: 'Video call ended (last participant disconnected)' 
          });
          io.socketsLeave(callRoom); // Clean up socket room
        }

        break;
      }
    }
  });
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    socket: 'Available',
    activeVideoCalls: activeVideoCalls.size
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔗 MongoDB: ${process.env.MONGODB_URI ? 'Connected' : 'Local'}`);
  console.log(`🌐 CORS Enabled for: localhost:5173, 10.117.114.135:5173`);
  console.log(`💬 Socket.IO Server Ready`);
  console.log(`🎥 COMPLETE WebRTC Video Call Features Enabled`);
});