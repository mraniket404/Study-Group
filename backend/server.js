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
  "https://study-group-3-wnhq.onrender.com"
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

// ------------------------ Auth Middleware ------------------------
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ message: 'Access token required' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
};

// ------------------------ Routes ------------------------
// (All your auth routes, group routes, message routes, note, questions, etc.)
// Keep your previous full implementation here

// ------------------------ Socket.IO ------------------------
// (Keep all Socket.IO + WebRTC code exactly as in your full server file)
// Just make sure the io instance is using allowedOrigins as above

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

// ------------------------ Start Server ------------------------
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔗 MongoDB: ${process.env.MONGODB_URI ? 'Connected' : 'Local'}`);
  console.log(`🌐 CORS Enabled for: ${allowedOrigins.join(', ')}`);
  console.log(`💬 Socket.IO Server Ready`);
  console.log(`🎥 COMPLETE WebRTC Video Call Features Enabled`);
});
