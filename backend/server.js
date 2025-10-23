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

// ✅ ADDED: Video Call Schema
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
const VideoCall = mongoose.model('VideoCall', VideoCallSchema); // ✅ ADDED

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
    await group.populate('mentor', 'name _id'); // ✅ _id include karein
    res.status(201).json({ message: 'Group created', group });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.post('/api/groups/join', authenticateToken, async (req, res) => {
  try {
    const { code } = req.body;
    const group = await Group.findOne({ code }).populate('mentor', 'name _id'); // ✅ _id include karein
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
      .populate('mentor', 'name _id') // ✅ _id bhi include karein
      .populate('members', 'name');
    
    console.log('📋 Groups for user:', {
      userId: req.user.userId,
      groups: groups.map(g => ({
        id: g._id,
        name: g.name,
        mentor: g.mentor,
        mentorId: g.mentor._id
      }))
    });
    
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

// ✅ ADDED: Message save route for API fallback
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

// ✅ ADDED: Test socket route
app.get('/api/test-socket', (req, res) => {
  res.json({ 
    message: 'Socket server is working',
    timestamp: new Date().toISOString()
  });
});

// Socket.IO - UPDATED WITH VIDEO CALL FEATURES
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
      
      // Send confirmation
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
      console.log(`📨 Sent ${messages.length} existing messages to user ${socket.id}`);
      
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('room_join_error', { error: 'Failed to join room' });
    }
  });

  // Handle chat messages - UPDATED WITH BETTER LOGGING
  socket.on('sendMessage', async (data) => {
    try {
      console.log('💬 SEND MESSAGE EVENT RECEIVED:', {
        groupId: data.groupId,
        userId: data.userId,
        content: data.content,
        socketId: socket.id
      });

      // Validate required fields
      if (!data.groupId || !data.userId || !data.content) {
        console.error('❌ Missing required fields:', data);
        socket.emit('message_error', { error: 'Missing required fields' });
        return;
      }

      // Validate group exists
      const group = await Group.findById(data.groupId);
      if (!group) {
        console.error('❌ Group not found:', data.groupId);
        socket.emit('message_error', { error: 'Group not found' });
        return;
      }

      // Save message to MongoDB
      const message = new Message({
        group: data.groupId,
        user: data.userId,
        content: data.content
      });
      
      const savedMessage = await message.save();
      console.log('✅ Message saved to MongoDB:', savedMessage._id);

      // Populate user information
      const messageWithUser = await Message.findById(savedMessage._id)
        .populate('user', 'name _id');

      console.log('✅ Message populated:', {
        id: messageWithUser._id,
        content: messageWithUser.content,
        user: messageWithUser.user.name
      });

      // BROADCAST TO ALL USERS IN THE ROOM
      console.log(`📢 Broadcasting to room: ${data.groupId}`);
      io.to(data.groupId).emit('newMessage', messageWithUser);
      console.log(`✅ Message broadcasted to room ${data.groupId}`);

      // Send confirmation to sender
      socket.emit('message_sent', { success: true, messageId: savedMessage._id });

    } catch (error) {
      console.error('❌ Error in sendMessage:', error);
      socket.emit('message_error', { error: 'Failed to send message: ' + error.message });
    }
  });

  // Handle note updates
  socket.on('updateNote', async (data) => {
    try {
      console.log('📝 Update note:', data);

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
      console.log('✅ Note saved to MongoDB');
      
      // Broadcast to all in room
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
      console.log('❓ Create question:', data);

      const question = new Question({
        group: data.groupId,
        user: data.userId,
        question: data.question
      });
      
      await question.save();
      console.log('✅ Question saved to MongoDB');

      const questionWithUser = await Question.findById(question._id)
        .populate('user', 'name');

      // Broadcast to all in room
      io.to(data.groupId).emit('newQuestion', questionWithUser);
      
    } catch (error) {
      console.error('❌ Error creating question:', error);
      socket.emit('question_error', { error: 'Failed to create question' });
    }
  });

  socket.on('answerQuestion', async (data) => {
    try {
      console.log('💡 Answer question:', data);

      const question = await Question.findById(data.questionId);
      if (!question) {
        socket.emit('answer_error', { error: 'Question not found' });
        return;
      }

      question.answer = data.answer;
      question.answeredBy = data.userId;
      question.answeredAt = new Date();
      
      await question.save();
      console.log('✅ Answer saved to MongoDB');

      const updatedQuestion = await Question.findById(question._id)
        .populate('user', 'name')
        .populate('answeredBy', 'name');

      // Broadcast to all in room
      io.to(data.groupId).emit('questionAnswered', updatedQuestion);
      
    } catch (error) {
      console.error('❌ Error answering question:', error);
      socket.emit('answer_error', { error: 'Failed to answer question' });
    }
  });

  // ✅ FIXED: VIDEO CALL EVENTS - MENTOR VALIDATION FIXED

  // Mentor starts video call
  socket.on('startVideoCall', async (data) => {
    try {
      console.log('🎥 START VIDEO CALL:', data);
      
      const { groupId, userId, userName } = data;

      // Check if user is mentor - PROPER VALIDATION
      const group = await Group.findById(groupId).populate('mentor', 'name _id');
      if (!group) {
        socket.emit('video_call_error', { error: 'Group not found' });
        return;
      }

      console.log('🔍 MENTOR VALIDATION CHECK:', {
        groupMentorId: group.mentor._id.toString(),
        requestingUserId: userId,
        mentorName: group.mentor.name,
        isMentor: group.mentor._id.toString() === userId
      });

      // ✅ FIXED: Proper ObjectId comparison
      if (group.mentor._id.toString() !== userId) {
        console.log('❌ USER IS NOT MENTOR:', {
          mentor: group.mentor._id.toString(),
          user: userId
        });
        socket.emit('video_call_error', { error: 'Only mentor can start video call' });
        return;
      }

      console.log('✅ USER IS MENTOR - Proceeding with video call...');

      // End any existing active call for this group
      await VideoCall.updateMany(
        { group: groupId, status: 'active' },
        { status: 'ended', endTime: new Date() }
      );

      // Create video call record
      const videoCall = new VideoCall({
        group: groupId,
        startedBy: userId,
        participants: [userId],
        status: 'active'
      });
      
      await videoCall.save();
      await videoCall.populate('startedBy', 'name');

      console.log('✅ Video call started by mentor:', userName);

      // ✅ FIXED: Notify ALL group members including mentor
      const callData = {
        callId: videoCall._id,
        startedBy: { 
          _id: group.mentor._id, 
          name: group.mentor.name 
        },
        groupId: groupId,
        groupName: group.name,
        message: `${group.mentor.name} started a video call`,
        timestamp: new Date()
      };

      console.log('📢 Broadcasting video call to room:', groupId);
      io.to(groupId).emit('videoCallStarted', callData);
      
      // ✅ FIXED: Send specific success event to mentor
      socket.emit('videoCallStartedSuccess', {
        callId: videoCall._id,
        startedBy: { _id: userId, name: userName },
        groupId: groupId,
        message: 'Video call started successfully! Students can now join.'
      });

      console.log('🎉 Video call setup completed successfully');

    } catch (error) {
      console.error('❌ Error starting video call:', error);
      socket.emit('video_call_error', { error: 'Failed to start video call: ' + error.message });
    }
  });

  // Student joins video call - UPDATED
  socket.on('joinVideoCall', async (data) => {
    try {
      console.log('🎥 JOIN VIDEO CALL:', data);
      
      const { callId, userId, userName } = data;

      const videoCall = await VideoCall.findById(callId)
        .populate('startedBy', 'name')
        .populate('participants', 'name');

      if (!videoCall) {
        socket.emit('video_call_error', { error: 'Video call not found' });
        return;
      }

      if (videoCall.status === 'ended') {
        socket.emit('video_call_error', { error: 'Video call has ended' });
        return;
      }

      // Add participant if not already joined
      if (!videoCall.participants.some(p => p._id.toString() === userId)) {
        videoCall.participants.push(userId);
        await videoCall.save();
        await videoCall.populate('participants', 'name');
      }

      // Join the video call room
      socket.join(`video-call-${callId}`);

      // ✅ FIXED: Notify all participants that someone joined
      io.to(`video-call-${callId}`).emit('participantJoined', {
        callId: callId,
        participant: { _id: userId, name: userName },
        participantsCount: videoCall.participants.length,
        participantList: videoCall.participants
      });

      // ✅ FIXED: Send confirmation to the joiner
      socket.emit('videoCallJoinedSuccess', {
        callId: callId,
        startedBy: videoCall.startedBy,
        participants: videoCall.participants,
        message: 'Successfully joined video call'
      });

      // ✅ FIXED: Notify group about participant joining
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

  // Mentor ends video call
  socket.on('endVideoCall', async (data) => {
    try {
      console.log('🎥 END VIDEO CALL:', data);
      
      const { callId, userId } = data;

      const videoCall = await VideoCall.findById(callId).populate('group');
      
      if (!videoCall) {
        socket.emit('video_call_error', { error: 'Video call not found' });
        return;
      }

      // Check if user is the one who started the call
      if (videoCall.startedBy.toString() !== userId) {
        socket.emit('video_call_error', { error: 'Only the call starter can end the call' });
        return;
      }

      videoCall.status = 'ended';
      videoCall.endTime = new Date();
      await videoCall.save();

      // Notify all participants
      io.to(`video-call-${callId}`).emit('videoCallEnded', {
        callId: callId,
        endedBy: userId,
        message: 'Video call has ended'
      });

      // Notify the entire group
      io.to(videoCall.group.toString()).emit('videoCallEnded', {
        callId: callId,
        endedBy: userId,
        message: 'Video call has ended'
      });

      // Cleanup - disconnect all from room
      io.socketsLeave(`video-call-${callId}`);

      console.log(`✅ Video call ${callId} ended by ${userId}`);

    } catch (error) {
      console.error('❌ Error ending video call:', error);
      socket.emit('video_call_error', { error: 'Failed to end video call' });
    }
  });

  // WebRTC signaling events
  socket.on('offer', (data) => {
    socket.to(`video-call-${data.callId}`).emit('offer', {
      offer: data.offer,
      from: data.userId
    });
  });

  socket.on('answer', (data) => {
    socket.to(`video-call-${data.callId}`).emit('answer', {
      answer: data.answer,
      from: data.userId
    });
  });

  socket.on('ice-candidate', (data) => {
    socket.to(`video-call-${data.callId}`).emit('ice-candidate', {
      candidate: data.candidate,
      from: data.userId
    });
  });

  socket.on('leaveVideoCall', (data) => {
    socket.leave(`video-call-${data.callId}`);
    socket.to(`video-call-${data.callId}`).emit('participantLeft', {
      callId: data.callId,
      participant: data.userId
    });
  });

  // ✅ ADDED: Test message event
  socket.on('testMessage', (data) => {
    console.log('🧪 TEST MESSAGE RECEIVED:', data);
    socket.emit('test_response', { 
      message: 'Test successful!', 
      receivedData: data,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('disconnect', () => {
    console.log('🔌 User disconnected:', socket.id);
  });
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    socket: 'Available'
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔗 MongoDB: ${process.env.MONGODB_URI ? 'Connected' : 'Local'}`);
  console.log(`🌐 CORS Enabled for: localhost:5173, 10.117.114.135:5173`);
  console.log(`💬 Socket.IO Server Ready`);
  console.log(`🎥 Video Call Features Enabled`);
});