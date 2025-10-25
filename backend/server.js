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

// ✅ CORS setup
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173", 
  "https://study-group-3-wnhq.onrender.com",
  "https://study-squad-frontend.onrender.com"
];

app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  }
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/studygroup', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB Connected Successfully'))
.catch((err) => console.error('❌ MongoDB Connection Error:', err));

// ------------------------ Schemas ------------------------
const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, default: 'student' },
}, { timestamps: true });

const GroupSchema = new mongoose.Schema({
  name: String,
  description: String,
  code: { type: String, unique: true },
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

const User = mongoose.model('User', UserSchema);
const Group = mongoose.model('Group', GroupSchema);
const Message = mongoose.model('Message', MessageSchema);
const Note = mongoose.model('Note', NoteSchema);
const Question = mongoose.model('Question', QuestionSchema);

// ------------------------ AUTH MIDDLEWARE ------------------------
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    console.log('🔐 Auth Middleware - Token present:', !!token);
    
    if (!token) {
      return res.status(401).json({ message: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = {
      userId: user._id,
      email: user.email,
      role: user.role,
      name: user.name
    };
    
    console.log('✅ User authenticated:', req.user.name, req.user.role);
    next();
  } catch (error) {
    console.error('❌ Auth error:', error);
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// ------------------------ Auth Routes ------------------------

// Register Route
app.post('/api/auth/register', async (req, res) => {
  try {
    console.log('📝 Registration request:', req.body);
    
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'All fields are required' 
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        message: 'User already exists' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role: role || 'student'
    });

    await user.save();

    // Generate token
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );

    console.log('✅ User registered:', user.email);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token
    });

  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error during registration',
      error: error.message 
    });
  }
});

// Login Route
app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('🔐 Login request:', req.body);
    
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Email and password are required' 
      });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );

    console.log('✅ User logged in:', user.email, user.role);

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error during login',
      error: error.message 
    });
  }
});

// Get Current User
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    console.log('✅ User data returned:', user.name, user.role);

    res.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('❌ Get user error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error fetching user data' 
    });
  }
});

// ------------------------ Group Routes ------------------------

// Create Group
app.post('/api/groups', authenticateToken, async (req, res) => {
  try {
    console.log('🔧 Create group request from:', req.user.name);
    
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ 
        success: false,
        message: 'Group name is required' 
      });
    }

    // Generate unique code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();

    const group = new Group({
      name,
      description,
      code,
      mentor: req.user.userId,
      members: [req.user.userId]
    });

    await group.save();
    await group.populate('mentor', 'name email');
    await group.populate('members', 'name email role');

    console.log('✅ Group created:', group.name, 'by', req.user.name);

    res.status(201).json({
      success: true,
      message: 'Group created successfully',
      group
    });

  } catch (error) {
    console.error('❌ Create group error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error creating group',
      error: error.message 
    });
  }
});

// ADD THIS NEW ROUTE FOR GROUP CREATION (if frontend is using /api/groups/create)
app.post('/api/groups/create', authenticateToken, async (req, res) => {
  try {
    console.log('🔧 Create group request (via /create):', req.user.name);
    
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ 
        success: false,
        message: 'Group name is required' 
      });
    }

    // Generate unique code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();

    const group = new Group({
      name,
      description,
      code,
      mentor: req.user.userId,
      members: [req.user.userId]
    });

    await group.save();
    await group.populate('mentor', 'name email');
    await group.populate('members', 'name email role');

    console.log('✅ Group created via /create:', group.name, 'by', req.user.name);

    res.status(201).json({
      success: true,
      message: 'Group created successfully',
      group
    });

  } catch (error) {
    console.error('❌ Create group error (/create):', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error creating group',
      error: error.message 
    });
  }
});

// Join Group
app.post('/api/groups/join', authenticateToken, async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ 
        success: false,
        message: 'Group code is required' 
      });
    }

    const group = await Group.findOne({ code });
    if (!group) {
      return res.status(404).json({ 
        success: false,
        message: 'Group not found' 
      });
    }

    // Check if user is already a member
    if (group.members.includes(req.user.userId)) {
      return res.status(400).json({ 
        success: false,
        message: 'Already a member of this group' 
      });
    }

    // Add user to group
    group.members.push(req.user.userId);
    await group.save();

    await group.populate('mentor', 'name email');
    await group.populate('members', 'name email role');

    console.log('✅ User joined group:', req.user.name, '->', group.name);

    res.json({
      success: true,
      message: 'Joined group successfully',
      group
    });

  } catch (error) {
    console.error('❌ Join group error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error joining group' 
    });
  }
});

// Get User's Groups
app.get('/api/groups/my-groups', authenticateToken, async (req, res) => {
  try {
    console.log('🔧 Fetching groups for user:', req.user.name);
    
    const groups = await Group.find({
      members: req.user.userId
    })
    .populate('mentor', 'name email')
    .populate('members', 'name email role')
    .sort({ createdAt: -1 });

    console.log('✅ Groups found:', groups.length, 'for', req.user.name);

    res.json({
      success: true,
      groups: groups || []
    });

  } catch (error) {
    console.error('❌ Get groups error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error fetching groups' 
    });
  }
});

// ------------------------ Message Routes ------------------------

// Get Messages
app.get('/api/messages/:groupId', authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    
    const messages = await Message.find({ group: groupId })
      .populate('user', 'name email role')
      .sort({ createdAt: 1 });

    res.json({
      success: true,
      messages: messages || []
    });

  } catch (error) {
    console.error('❌ Get messages error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error fetching messages' 
    });
  }
});

// Send Message
app.post('/api/messages', authenticateToken, async (req, res) => {
  try {
    const { groupId, content } = req.body;

    if (!groupId || !content) {
      return res.status(400).json({ 
        success: false,
        message: 'Group ID and content are required' 
      });
    }

    const message = new Message({
      group: groupId,
      user: req.user.userId,
      content
    });

    await message.save();
    await message.populate('user', 'name email role');

    console.log('✅ Message sent by:', req.user.name);

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      message: message
    });

  } catch (error) {
    console.error('❌ Send message error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error sending message' 
    });
  }
});

// ------------------------ Notes Routes ------------------------

// Get Notes
app.get('/api/notes/:groupId', authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    
    let note = await Note.findOne({ group: groupId });
    
    if (!note) {
      note = new Note({
        group: groupId,
        content: '',
        lastUpdatedBy: req.user.userId
      });
      await note.save();
    }

    res.json({
      success: true,
      content: note.content || ''
    });

  } catch (error) {
    console.error('❌ Get notes error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error fetching notes' 
    });
  }
});

// Update Notes
app.put('/api/notes/:groupId', authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { content } = req.body;

    let note = await Note.findOne({ group: groupId });
    
    if (!note) {
      note = new Note({
        group: groupId,
        content: content,
        lastUpdatedBy: req.user.userId
      });
    } else {
      note.content = content;
      note.lastUpdatedBy = req.user.userId;
    }

    await note.save();

    console.log('✅ Notes updated by:', req.user.name);

    res.json({
      success: true,
      message: 'Notes updated successfully',
      content: note.content
    });

  } catch (error) {
    console.error('❌ Update notes error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error updating notes' 
    });
  }
});

// ------------------------ Questions Routes ------------------------

// Get Questions
app.get('/api/questions/:groupId', authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    
    const questions = await Question.find({ group: groupId })
      .populate('user', 'name email')
      .populate('answeredBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      questions: questions || []
    });

  } catch (error) {
    console.error('❌ Get questions error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error fetching questions' 
    });
  }
});

// Create Question
app.post('/api/questions', authenticateToken, async (req, res) => {
  try {
    const { groupId, question } = req.body;

    if (!groupId || !question) {
      return res.status(400).json({ 
        success: false,
        message: 'Group ID and question are required' 
      });
    }

    const newQuestion = new Question({
      group: groupId,
      user: req.user.userId,
      question
    });

    await newQuestion.save();
    await newQuestion.populate('user', 'name email');

    console.log('✅ Question posted by:', req.user.name);

    res.status(201).json({
      success: true,
      message: 'Question posted successfully',
      question: newQuestion
    });

  } catch (error) {
    console.error('❌ Create question error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error creating question' 
    });
  }
});

// Answer Question
app.put('/api/questions/:questionId/answer', authenticateToken, async (req, res) => {
  try {
    const { questionId } = req.params;
    const { answer } = req.body;

    const question = await Question.findById(questionId);
    
    if (!question) {
      return res.status(404).json({ 
        success: false,
        message: 'Question not found' 
      });
    }

    question.answer = answer;
    question.answeredBy = req.user.userId;
    question.answeredAt = new Date();

    await question.save();
    await question.populate('answeredBy', 'name email');

    console.log('✅ Question answered by:', req.user.name);

    res.json({
      success: true,
      message: 'Answer submitted successfully',
      question
    });

  } catch (error) {
    console.error('❌ Answer question error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error answering question' 
    });
  }
});

// ------------------------ Socket.IO ------------------------

const activeVideoCalls = new Map();
const userSocketMap = new Map(); // Track user socket connections

io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);

  // Join group room
  socket.on('joinRoom', (data) => {
    socket.join(data.groupId);
    userSocketMap.set(data.userId, socket.id);
    console.log(`👥 User ${data.userId} (${socket.id}) joined group ${data.groupId}`);
  });

  // Handle messages
  socket.on('sendMessage', async (data) => {
    try {
      console.log('📨 Message received via socket:', data);
      
      const message = new Message({
        group: data.groupId,
        user: data.userId,
        content: data.content
      });

      await message.save();
      await message.populate('user', 'name email role');

      io.to(data.groupId).emit('newMessage', message);
      console.log('✅ Message broadcasted to group:', data.groupId);
    } catch (error) {
      console.error('❌ Send message error:', error);
    }
  });

  // Handle notes update
  socket.on('updateNote', async (data) => {
    try {
      console.log('📝 Note update received:', data);
      
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
        groupId: data.groupId,
        content: data.content,
        updatedBy: data.userId
      });
      
      console.log('✅ Note updated and broadcasted');
    } catch (error) {
      console.error('❌ Update note error:', error);
    }
  });

  // IMPROVED: Handle questions with better real-time sync
  socket.on('createQuestion', async (data) => {
    try {
      console.log('❓ Question received:', data);
      
      const question = new Question({
        group: data.groupId,
        user: data.userId,
        question: data.question
      });

      await question.save();
      await question.populate('user', 'name email');

      // Send to all group members including sender for immediate sync
      io.to(data.groupId).emit('newQuestion', {
        ...question.toObject(),
        groupId: data.groupId
      });
      
      console.log('✅ Question broadcasted to group:', data.groupId);
    } catch (error) {
      console.error('❌ Create question error:', error);
    }
  });

  // IMPROVED: Handle question answers with better real-time sync
  socket.on('answerQuestion', async (data) => {
    try {
      console.log('✅ Answer received:', data);
      
      const question = await Question.findById(data.questionId);
      
      if (!question) {
        console.error('Question not found:', data.questionId);
        return;
      }

      question.answer = data.answer;
      question.answeredBy = data.userId;
      question.answeredAt = new Date();

      await question.save();
      await question.populate('answeredBy', 'name email');
      await question.populate('user', 'name email');

      // Send to all group members including sender for immediate sync
      io.to(data.groupId).emit('questionAnswered', {
        questionId: data.questionId,
        answer: data.answer,
        answeredBy: { _id: data.userId, name: data.userName },
        answeredAt: question.answeredAt,
        groupId: data.groupId
      });
      
      console.log('✅ Answer broadcasted to group:', data.groupId);
    } catch (error) {
      console.error('❌ Answer question error:', error);
    }
  });

  // IMPROVED: Video Call Management with better state tracking
  socket.on('startVideoCall', (data) => {
    console.log('🎥 Video call started:', data);
    
    activeVideoCalls.set(data.groupId, {
      startedBy: data.userId,
      participants: [{
        userId: data.userId,
        userName: data.userName,
        socketId: socket.id
      }],
      startTime: new Date()
    });
    
    // Notify all group members except the caller
    socket.to(data.groupId).emit('videoCallStarted', {
      groupId: data.groupId,
      userId: data.userId,
      userName: data.userName,
      startTime: new Date()
    });
    
    console.log('✅ Video call notification sent to group:', data.groupId);
  });

  socket.on('joinVideoCall', (data) => {
    console.log('🎥 User joining call:', data);
    
    const call = activeVideoCalls.get(data.groupId);
    if (call) {
      // Check if user already in call
      const existingParticipant = call.participants.find(p => p.userId === data.userId);
      if (!existingParticipant) {
        call.participants.push({
          userId: data.userId,
          userName: data.userName,
          socketId: socket.id
        });
      }
      
      console.log('🎥 Current participants:', call.participants.map(p => p.userName));
      
      // Notify all group members about the join
      io.to(data.groupId).emit('userJoinedCall', {
        groupId: data.groupId,
        userId: data.userId,
        userName: data.userName,
        participants: call.participants
      });
    }
    
    console.log('✅ User join notification sent');
  });

  socket.on('leaveVideoCall', (data) => {
    console.log('🎥 User leaving call:', data);
    
    const call = activeVideoCalls.get(data.groupId);
    if (call) {
      call.participants = call.participants.filter(p => p.userId !== data.userId);
      
      // If no participants left, end the call
      if (call.participants.length === 0) {
        activeVideoCalls.delete(data.groupId);
        io.to(data.groupId).emit('videoCallEnded', {
          groupId: data.groupId,
          endedBy: data.userId
        });
      } else {
        // Notify remaining participants
        io.to(data.groupId).emit('userLeftCall', {
          groupId: data.groupId,
          userId: data.userId,
          userName: data.userName,
          participants: call.participants
        });
      }
    }
    
    console.log('✅ User leave notification sent');
  });

  socket.on('endVideoCall', (data) => {
    console.log('🎥 Video call ended by host:', data);
    
    const call = activeVideoCalls.get(data.groupId);
    if (call) {
      activeVideoCalls.delete(data.groupId);
      
      // Notify all group members
      io.to(data.groupId).emit('videoCallEnded', {
        groupId: data.groupId,
        endedBy: data.userId,
        endedAt: new Date()
      });
    }
    
    console.log('✅ Video call end notification sent to group:', data.groupId);
  });

  // NEW: WebRTC Signaling for actual video/audio transmission
  socket.on('webrtc-offer', (data) => {
    console.log('📞 WebRTC Offer from:', data.from);
    
    // Send offer to specific user
    const targetSocketId = userSocketMap.get(data.to);
    if (targetSocketId) {
      socket.to(targetSocketId).emit('webrtc-offer', {
        offer: data.offer,
        from: data.from,
        to: data.to
      });
    }
  });

  socket.on('webrtc-answer', (data) => {
    console.log('📞 WebRTC Answer from:', data.from);
    
    // Send answer to specific user
    const targetSocketId = userSocketMap.get(data.to);
    if (targetSocketId) {
      socket.to(targetSocketId).emit('webrtc-answer', {
        answer: data.answer,
        from: data.from,
        to: data.to
      });
    }
  });

  socket.on('webrtc-ice-candidate', (data) => {
    console.log('📞 WebRTC ICE Candidate from:', data.from);
    
    // Send ICE candidate to specific user
    const targetSocketId = userSocketMap.get(data.to);
    if (targetSocketId) {
      socket.to(targetSocketId).emit('webrtc-ice-candidate', {
        candidate: data.candidate,
        from: data.from,
        to: data.to
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('🔌 User disconnected:', socket.id);
    
    // Remove from user socket map
    for (let [userId, socketId] of userSocketMap.entries()) {
      if (socketId === socket.id) {
        userSocketMap.delete(userId);
        console.log('🗑️ Removed user from socket map:', userId);
        break;
      }
    }
    
    // Handle video call cleanup for disconnected users
    for (let [groupId, call] of activeVideoCalls.entries()) {
      const disconnectedParticipant = call.participants.find(p => p.socketId === socket.id);
      if (disconnectedParticipant) {
        call.participants = call.participants.filter(p => p.socketId !== socket.id);
        
        // Notify group about user leaving due to disconnect
        socket.to(groupId).emit('userLeftCall', {
          groupId: groupId,
          userId: disconnectedParticipant.userId,
          userName: disconnectedParticipant.userName,
          participants: call.participants,
          reason: 'disconnected'
        });
        
        console.log('🎥 User removed from call due to disconnect:', disconnectedParticipant.userName);
        
        // If no participants left, end the call
        if (call.participants.length === 0) {
          activeVideoCalls.delete(groupId);
          io.to(groupId).emit('videoCallEnded', {
            groupId: groupId,
            endedBy: 'system',
            reason: 'all participants disconnected'
          });
        }
      }
    }
  });
});

// ------------------------ Health Check ------------------------
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true,
    status: 'OK', 
    message: 'Server is running 🚀',
    timestamp: new Date().toISOString(),
    socket: 'Available',
    activeVideoCalls: activeVideoCalls.size,
    connectedUsers: userSocketMap.size
  });
});

// Test Route
app.get('/api/test', (req, res) => {
  res.json({ 
    success: true,
    message: 'API is working! 🎉',
    timestamp: new Date().toISOString()
  });
});

// Test Auth Route
app.get('/api/auth/test', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Auth is working! 🔐',
    user: req.user
  });
});

// ------------------------ Start Server ------------------------
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔗 MongoDB: ${process.env.MONGODB_URI ? 'Connected' : 'Local'}`);
  console.log(`🌐 CORS Enabled for: ${allowedOrigins.join(', ')}`);
  console.log(`💬 Socket.IO Server Ready`);
  console.log(`🎥 Video Call Features Enabled`);
  console.log(`📞 WebRTC Signaling Ready`);
});