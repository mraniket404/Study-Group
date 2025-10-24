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

// ✅ CORS setup: include your deployed frontend + local
const allowedOrigins = [
  "http://localhost:5173",
  "http://10.117.114.135:5173",
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

// ------------------------ Auth Middleware ------------------------
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  console.log('🔐 Auth Middleware - Header:', authHeader);
  console.log('🔐 Auth Middleware - Token:', token ? 'Present' : 'Missing');
  
  if (!token) {
    console.log('❌ No token provided');
    return res.status(401).json({ 
      success: false,
      message: 'Access token required' 
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.log('❌ Token verification failed:', err.message);
      return res.status(403).json({ 
        success: false,
        message: 'Invalid token',
        error: err.message 
      });
    }
    
    console.log('✅ Token verified - User:', user);
    req.user = user;
    next();
  });
};

// ------------------------ Auth Routes ------------------------

// Register Route
app.post('/api/auth/register', async (req, res) => {
  try {
    console.log('Registration request:', req.body);
    
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
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
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      message: 'Server error during registration',
      error: error.message 
    });
  }
});

// Login Route
app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('Login request:', req.body);
    
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
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
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ------------------------ Group Routes ------------------------

// Create Group (Alternative endpoint for frontend)
app.post('/api/groups/create', authenticateToken, async (req, res) => {
  try {
    console.log('🔧 Create group request received');
    console.log('🔧 Headers:', req.headers);
    console.log('🔧 User from token:', req.user);
    console.log('🔧 Request body:', req.body);
    
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

    console.log('✅ Group created successfully:', group.name);

    res.status(201).json({
      success: true,
      message: 'Group created successfully',
      group
    });

  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error creating group',
      error: error.message 
    });
  }
});

// Create Group (Original endpoint)
app.post('/api/groups', authenticateToken, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'Group name is required' });
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

    res.status(201).json({
      success: true,
      message: 'Group created successfully',
      group
    });

  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Join Group
app.post('/api/groups/join', authenticateToken, async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ message: 'Group code is required' });
    }

    const group = await Group.findOne({ code });
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is already a member
    if (group.members.includes(req.user.userId)) {
      return res.status(400).json({ message: 'Already a member of this group' });
    }

    // Add user to group
    group.members.push(req.user.userId);
    await group.save();

    await group.populate('mentor', 'name email');
    await group.populate('members', 'name email role');

    res.json({
      success: true,
      message: 'Joined group successfully',
      group
    });

  } catch (error) {
    console.error('Join group error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get User's Groups
app.get('/api/groups/my-groups', authenticateToken, async (req, res) => {
  try {
    console.log('🔧 Fetching groups for user:', req.user.userId);
    
    const groups = await Group.find({
      members: req.user.userId
    })
    .populate('mentor', 'name email')
    .populate('members', 'name email role')
    .sort({ createdAt: -1 });

    console.log('✅ Groups found:', groups.length);

    res.json({
      success: true,
      groups: groups || []
    });

  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error fetching groups' 
    });
  }
});

// ------------------------ Message Routes ------------------------

// Get Group Messages
app.get('/api/groups/:groupId/messages', authenticateToken, async (req, res) => {
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
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get Messages (Alternative endpoint)
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
    console.error('Get messages error:', error);
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

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      message: message
    });

  } catch (error) {
    console.error('Send message error:', error);
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
    console.error('Get notes error:', error);
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

    res.json({
      success: true,
      message: 'Notes updated successfully',
      content: note.content
    });

  } catch (error) {
    console.error('Update notes error:', error);
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
    console.error('Get questions error:', error);
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

    res.status(201).json({
      success: true,
      message: 'Question posted successfully',
      question: newQuestion
    });

  } catch (error) {
    console.error('Create question error:', error);
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

    res.json({
      success: true,
      message: 'Answer submitted successfully',
      question
    });

  } catch (error) {
    console.error('Answer question error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error answering question' 
    });
  }
});

// ------------------------ Socket.IO ------------------------

const activeVideoCalls = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join group room
  socket.on('join-group', (groupId) => {
    socket.join(groupId);
    console.log(`User ${socket.id} joined group ${groupId}`);
  });

  // Handle messages
  socket.on('send-message', async (data) => {
    try {
      const message = new Message({
        group: data.groupId,
        user: data.userId,
        content: data.content
      });

      await message.save();
      await message.populate('user', 'name email role');

      io.to(data.groupId).emit('new-message', message);
    } catch (error) {
      console.error('Send message error:', error);
    }
  });

  // WebRTC Signaling
  socket.on('offer', (data) => {
    socket.to(data.groupId).emit('offer', {
      offer: data.offer,
      from: socket.id
    });
  });

  socket.on('answer', (data) => {
    socket.to(data.groupId).emit('answer', {
      answer: data.answer,
      from: socket.id
    });
  });

  socket.on('ice-candidate', (data) => {
    socket.to(data.groupId).emit('ice-candidate', {
      candidate: data.candidate,
      from: socket.id
    });
  });

  // Video Call Management
  socket.on('start-video-call', (data) => {
    activeVideoCalls.set(data.groupId, {
      startedBy: data.userId,
      participants: [data.userId]
    });
    socket.to(data.groupId).emit('video-call-started', {
      startedBy: data.userId
    });
  });

  socket.on('join-video-call', (data) => {
    const call = activeVideoCalls.get(data.groupId);
    if (call && !call.participants.includes(data.userId)) {
      call.participants.push(data.userId);
    }
    socket.to(data.groupId).emit('user-joined-call', {
      userId: data.userId
    });
  });

  socket.on('leave-video-call', (data) => {
    const call = activeVideoCalls.get(data.groupId);
    if (call) {
      call.participants = call.participants.filter(id => id !== data.userId);
      if (call.participants.length === 0) {
        activeVideoCalls.delete(data.groupId);
      }
    }
    socket.to(data.groupId).emit('user-left-call', {
      userId: data.userId
    });
  });

  socket.on('end-video-call', (data) => {
    activeVideoCalls.delete(data.groupId);
    socket.to(data.groupId).emit('video-call-ended');
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// ------------------------ Health Check ------------------------
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    socket: 'Available',
    activeVideoCalls: activeVideoCalls.size
  });
});

// Test Route
app.get('/api/test', (req, res) => {
  res.json({ 
    success: true,
    message: 'API is working! 🚀',
    timestamp: new Date().toISOString()
  });
});

// ------------------------ Start Server ------------------------
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔗 MongoDB: ${process.env.MONGODB_URI ? 'Connected' : 'Local'}`);
  console.log(`🌐 CORS Enabled for: ${allowedOrigins.join(', ')}`);
  console.log(`💬 Socket.IO Server Ready`);
  console.log(`🎥 WebRTC Video Call Features Enabled`);
  console.log(`🔐 JWT Secret: ${process.env.JWT_SECRET ? 'Set' : 'Not Set'}`);
});