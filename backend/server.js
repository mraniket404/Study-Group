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
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  content: String,
}, { timestamps: true });

const NoteSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
  content: String,
  lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const QuestionSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  question: String,
  answer: String,
  answeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  answeredAt: Date,
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);
const Group = mongoose.model('Group', GroupSchema);
const Message = mongoose.model('Message', MessageSchema);
const Note = mongoose.model('Note', NoteSchema);
const Question = mongoose.model('Question', QuestionSchema);

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
    await group.populate('mentor', 'name');
    res.status(201).json({ message: 'Group created', group });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.post('/api/groups/join', authenticateToken, async (req, res) => {
  try {
    const { code } = req.body;
    const group = await Group.findOne({ code }).populate('mentor', 'name');
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
      .populate('mentor', 'name')
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
      .populate('user', 'name')
      .sort({ createdAt: 1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.get('/api/notes/:groupId', authenticateToken, async (req, res) => {
  try {
    const note = await Note.findOne({ group: req.params.groupId });
    res.json(note);
  } catch (error) {
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
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Socket.IO - FIXED REAL-TIME
io.on('connection', (socket) => {
  console.log('🔌 NEW USER CONNECTED:', socket.id);

  // Test immediate event
  socket.emit('connection_test', { 
    message: 'Connected to server successfully',
    socketId: socket.id,
    timestamp: new Date().toISOString()
  });

  // Join group room
  socket.on('joinRoom', ({ groupId }) => {
    console.log(`🎯 JOIN ROOM: User ${socket.id} joining room ${groupId}`);
    
    socket.join(groupId);
    console.log(`✅ User ${socket.id} joined room: ${groupId}`);
    
    // Send confirmation
    socket.emit('room_joined', { 
      room: groupId, 
      success: true,
      message: `Successfully joined room ${groupId}`
    });
  });

  // Handle chat messages - FIXED
  socket.on('sendMessage', async (data) => {
    try {
      console.log('💬 SEND MESSAGE:', {
        groupId: data.groupId,
        userId: data.userId,
        content: data.content,
        socketId: socket.id
      });

      // Validate required fields
      if (!data.groupId || !data.userId || !data.content) {
        console.error('❌ Missing required fields');
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
        user: messageWithUser.user
      });

      // BROADCAST TO ALL USERS IN THE ROOM
      console.log(`📢 Broadcasting to room: ${data.groupId}`);
      io.to(data.groupId).emit('newMessage', messageWithUser);
      console.log(`✅ Message broadcasted to room ${data.groupId}`);

    } catch (error) {
      console.error('❌ Error in sendMessage:', error);
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
      
      // Broadcast to all in room
      io.to(data.groupId).emit('noteUpdated', {
        content: data.content,
        lastUpdated: new Date(),
        lastUpdatedBy: data.userId
      });
      
    } catch (error) {
      console.error('❌ Error updating note:', error);
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

      const questionWithUser = await Question.findById(question._id)
        .populate('user', 'name');

      // Broadcast to all in room
      io.to(data.groupId).emit('newQuestion', questionWithUser);
      
    } catch (error) {
      console.error('❌ Error creating question:', error);
    }
  });

  socket.on('answerQuestion', async (data) => {
    try {
      console.log('💡 Answer question:', data);

      const question = await Question.findById(data.questionId);
      if (!question) return;

      question.answer = data.answer;
      question.answeredBy = data.userId;
      question.answeredAt = new Date();
      
      await question.save();

      const updatedQuestion = await Question.findById(question._id)
        .populate('user', 'name')
        .populate('answeredBy', 'name');

      // Broadcast to all in room
      io.to(data.groupId).emit('questionAnswered', updatedQuestion);
      
    } catch (error) {
      console.error('❌ Error answering question:', error);
    }
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
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔗 MongoDB: ${process.env.MONGODB_URI ? 'Connected' : 'Local'}`);
  console.log(`🌐 CORS Enabled for: localhost:5173, 10.117.114.135:5173`);
});