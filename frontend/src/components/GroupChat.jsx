import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'https://study-group-j14u.onrender.com/api';

const GroupChat = ({ user, group, socket, socketConnected, token, onBack, addNotification }) => {
  
  console.log('🔍 GroupChat: Component loaded');
  console.log('🔍 GroupChat: Group ID:', group?._id);
  console.log('👤 GroupChat: User:', user?.name);
  console.log('🔌 GroupChat: Socket Available:', socket ? 'Yes' : 'No');
  console.log('🔌 GroupChat: Socket Connected:', socketConnected ? 'Yes' : 'No');

  // Early return for missing data
  if (!user || !group) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">User or group data is loading...</p>
          <button
            onClick={onBack}
            className="mt-4 bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState('chat');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [notes, setNotes] = useState('');
  const [questions, setQuestions] = useState([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [answeringQuestion, setAnsweringQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Video call states
  const [videoCallActive, setVideoCallActive] = useState(false);
  const [videoCallData, setVideoCallData] = useState(null);
  const [isInVideoCall, setIsInVideoCall] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [videoCallLoading, setVideoCallLoading] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const messagesEndRef = useRef(null);
  const localVideoRef = useRef(null);

  // Data loading functions
  const fetchMessages = async () => { 
    try {
      const response = await axios.get(`${API_BASE}/messages/${group._id}`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000
      });
      const messagesData = response.data?.messages || response.data || [];
      console.log('📨 Messages loaded:', messagesData.length);
      setMessages(Array.isArray(messagesData) ? messagesData : []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setMessages([]);
    }
  };

  const fetchNotes = async () => { 
    try {
      const response = await axios.get(`${API_BASE}/notes/${group._id}`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000
      });
      const notesContent = response.data?.content || response.data || '';
      console.log('📝 Notes loaded');
      setNotes(notesContent);
    } catch (error) {
      console.error('Error fetching notes:', error);
      setNotes('');
    }
  };

  const fetchQuestions = async () => { 
    try {
      const response = await axios.get(`${API_BASE}/questions/${group._id}`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000
      });
      const questionsData = response.data?.questions || response.data || [];
      console.log('❓ Questions loaded:', questionsData.length);
      setQuestions(Array.isArray(questionsData) ? questionsData : []);
    } catch (error) {
      console.error('Error fetching questions:', error);
      setQuestions([]);
    }
  };

  const loadInitialData = async () => { 
    try {
      setLoading(true);
      console.log('🔄 Loading initial data...');
      await Promise.all([
        fetchMessages(),
        fetchNotes(),
        fetchQuestions()
      ]);
      setLoading(false);
      console.log('✅ Initial data loaded successfully');
    } catch (error) {
      console.error('❌ Error loading initial data:', error);
      addNotification('Error loading group data', 'error');
      setLoading(false);
    }
  };

  // ✅ IMPROVED: Video Call Functions with better error handling
  const startVideoCall = async () => {
    try {
      setVideoCallLoading(true);
      
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      setLocalStream(stream);
      
      // Set local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Emit video call start event if socket is connected
      if (socket && socketConnected) {
        socket.emit('startVideoCall', {
          groupId: group._id,
          userId: user._id,
          userName: user.name
        });
        console.log('🎥 Video call started via socket');
      } else {
        // Fallback: Store video call data in state for other users to see
        setVideoCallData({
          groupId: group._id,
          userId: user._id,
          userName: user.name,
          startedAt: new Date()
        });
        console.log('🎥 Video call started (fallback mode)');
      }

      setVideoCallActive(true);
      setIsInVideoCall(true);
      setVideoCallLoading(false);
      addNotification('Video call started! Other members will be notified.', 'success');
      
    } catch (error) {
      console.error('Error starting video call:', error);
      addNotification('Failed to start video call. Please check camera/mic permissions.', 'error');
      setVideoCallLoading(false);
    }
  };

  const joinVideoCall = () => {
    if (socket && socketConnected) {
      socket.emit('joinVideoCall', {
        groupId: group._id,
        userId: user._id,
        userName: user.name
      });
    }
    setIsInVideoCall(true);
    addNotification('Joined video call!', 'success');
  };

  const leaveVideoCall = () => {
    cleanupVideoCall();
    
    if (socket && socketConnected) {
      socket.emit('leaveVideoCall', {
        groupId: group._id,
        userId: user._id
      });
    }
    
    setIsInVideoCall(false);
    if (user.role === 'mentor') {
      setVideoCallActive(false);
      setVideoCallData(null);
    }
    addNotification('Left video call', 'info');
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsAudioMuted(!isAudioMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const cleanupVideoCall = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
  };

  // ✅ IMPROVED: Socket connection with better error handling
  useEffect(() => {
    console.log('🔌 GroupChat: Socket effect running');
    loadInitialData();

    if (!socket) {
      console.log('🔌 GroupChat: No socket available, using API mode');
      return;
    }

    // Socket event handlers
    const handleConnect = () => {
      console.log('🔌 GroupChat: Socket connected');
      socket.emit('joinRoom', { groupId: group._id, userId: user._id });
    };

    const handleNewMessage = (message) => {
      console.log('📨 New message received via socket:', message);
      setMessages(prev => {
        // Remove temporary messages with same content
        const filtered = prev.filter(msg => 
          !msg.isSending || msg.content !== message.content
        );
        return [...filtered, message];
      });
    };

    const handleNoteUpdated = (data) => {
      console.log('📝 Note updated via socket:', data);
      if (data.groupId === group._id) {
        setNotes(data.content);
      }
    };

    const handleNewQuestion = (question) => {
      console.log('❓ New question received via socket:', question);
      if (question.groupId === group._id) {
        setQuestions(prev => [...prev, question]);
      }
    };

    const handleQuestionAnswered = (data) => {
      console.log('✅ Question answered via socket:', data);
      setQuestions(prev => prev.map(q => 
        q._id === data.questionId ? { ...q, answer: data.answer, answeredBy: data.answeredBy, answeredAt: data.answeredAt } : q
      ));
    };

    // Video call socket handlers
    const handleVideoCallStarted = (data) => {
      console.log('🎥 Video call started notification:', data);
      if (data.groupId === group._id) {
        setVideoCallData(data);
        setVideoCallActive(true);
        addNotification(`${data.userName} started a video call!`, 'info');
      }
    };

    const handleVideoCallEnded = (data) => {
      console.log('🎥 Video call ended notification:', data);
      if (data.groupId === group._id) {
        setVideoCallActive(false);
        setVideoCallData(null);
        if (isInVideoCall) {
          cleanupVideoCall();
          setIsInVideoCall(false);
        }
        addNotification('Video call ended', 'info');
      }
    };

    const handleUserJoinedCall = (data) => {
      console.log('🎥 User joined call:', data);
      if (data.groupId === group._id) {
        setParticipants(prev => [...prev.filter(p => p.userId !== data.userId), data]);
        addNotification(`${data.userName} joined the video call`, 'info');
      }
    };

    const handleUserLeftCall = (data) => {
      console.log('🎥 User left call:', data);
      if (data.groupId === group._id) {
        setParticipants(prev => prev.filter(p => p.userId !== data.userId));
        addNotification(`${data.userName} left the video call`, 'info');
      }
    };

    // Register event listeners only if socket is connected
    if (socketConnected) {
      socket.on('connect', handleConnect);
      socket.on('newMessage', handleNewMessage);
      socket.on('noteUpdated', handleNoteUpdated);
      socket.on('newQuestion', handleNewQuestion);
      socket.on('questionAnswered', handleQuestionAnswered);
      socket.on('videoCallStarted', handleVideoCallStarted);
      socket.on('videoCallEnded', handleVideoCallEnded);
      socket.on('userJoinedCall', handleUserJoinedCall);
      socket.on('userLeftCall', handleUserLeftCall);

      // Join room if already connected
      if (socket.connected) {
        socket.emit('joinRoom', { groupId: group._id, userId: user._id });
      }
    }

    // Cleanup
    return () => {
      console.log('🔌 GroupChat: Cleaning up socket listeners');
      if (socket) {
        socket.off('connect', handleConnect);
        socket.off('newMessage', handleNewMessage);
        socket.off('noteUpdated', handleNoteUpdated);
        socket.off('newQuestion', handleNewQuestion);
        socket.off('questionAnswered', handleQuestionAnswered);
        socket.off('videoCallStarted', handleVideoCallStarted);
        socket.off('videoCallEnded', handleVideoCallEnded);
        socket.off('userJoinedCall', handleUserJoinedCall);
        socket.off('userLeftCall', handleUserLeftCall);
      }
      cleanupVideoCall();
    };
  }, [socket, socketConnected, group._id, user._id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Update local video when stream changes
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // ✅ IMPROVED: Message sending with better fallback
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) {
      addNotification('Message cannot be empty', 'warning');
      return;
    }

    const content = newMessage.trim();
    setNewMessage('');

    // Add temporary message immediately for better UX
    const tempMessage = {
      _id: `temp-${Date.now()}`,
      content: content,
      user: { _id: user._id, name: user.name },
      createdAt: new Date(),
      isSending: true
    };
    setMessages(prev => [...prev, tempMessage]);

    try {
      // Try socket first if connected
      if (socket && socketConnected) {
        socket.emit('sendMessage', {
          groupId: group._id,
          userId: user._id,
          content: content
        });
        console.log('📨 Message sent via socket');
      } else {
        // Fallback to API
        const response = await axios.post(`${API_BASE}/messages`, {
          groupId: group._id,
          content: content
        }, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 5000
        });

        // Replace temporary message with real message
        setMessages(prev => {
          const filtered = prev.filter(msg => msg._id !== tempMessage._id);
          return [...filtered, response.data];
        });
        console.log('📨 Message sent via API fallback');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      addNotification('Failed to send message', 'error');
      // Remove temporary message on error
      setMessages(prev => prev.filter(msg => msg._id !== tempMessage._id));
    }
  };

  // ✅ IMPROVED: Notes update with fallback
  const handleNoteUpdate = async (content) => {
    setNotes(content);
    
    if (socket && socketConnected) {
      socket.emit('updateNote', {
        groupId: group._id,
        userId: user._id,
        content: content
      });
    } else {
      // API fallback for notes
      try {
        await axios.put(`${API_BASE}/notes/${group._id}`, {
          content: content
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (error) {
        console.error('Error updating notes:', error);
      }
    }
  };

  // ✅ IMPROVED: Question creation with fallback
  const handleCreateQuestion = async (e) => {
    e.preventDefault();
    if (!newQuestion.trim()) {
      addNotification('Question cannot be empty', 'warning');
      return;
    }

    const questionText = newQuestion.trim();
    setNewQuestion('');

    try {
      if (socket && socketConnected) {
        socket.emit('createQuestion', {
          groupId: group._id,
          userId: user._id,
          question: questionText
        });
        addNotification('Question posted!', 'success');
      } else {
        // API fallback
        const response = await axios.post(`${API_BASE}/questions`, {
          groupId: group._id,
          question: questionText
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setQuestions(prev => [...prev, response.data]);
        addNotification('Question posted!', 'success');
      }
    } catch (error) {
      console.error('Error creating question:', error);
      addNotification('Failed to post question', 'error');
    }
  };

  // ✅ IMPROVED: Question answering with fallback
  const handleAnswerQuestion = async (questionId) => {
    if (!answer.trim()) {
      addNotification('Answer cannot be empty', 'warning');
      return;
    }

    const answerText = answer.trim();
    setAnswer('');
    setAnsweringQuestion(null);

    try {
      if (socket && socketConnected) {
        socket.emit('answerQuestion', {
          groupId: group._id,
          userId: user._id,
          questionId: questionId,
          answer: answerText
        });
        addNotification('Answer submitted!', 'success');
      } else {
        // API fallback
        const response = await axios.put(`${API_BASE}/questions/${questionId}/answer`, {
          answer: answerText
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setQuestions(prev => prev.map(q => 
          q._id === questionId ? response.data : q
        ));
        addNotification('Answer submitted!', 'success');
      }
    } catch (error) {
      console.error('Error answering question:', error);
      addNotification('Failed to submit answer', 'error');
    }
  };

  // Utility functions
  const getUserName = (messageUser) => {
    return messageUser?.name || 'Unknown User';
  };

  const isUserMessage = (messageUser) => {
    return messageUser?._id === user._id;
  };

  // Navigation tabs
  const navigationTabs = ['chat', 'notes', 'qa', 'video'];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading {group.name}...</p>
          <button
            onClick={onBack}
            className="mt-4 bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={onBack}
                className="text-gray-600 hover:text-gray-800 flex items-center space-x-2 bg-gray-100 px-3 py-2 rounded-md"
              >
                <i className="fas fa-arrow-left"></i>
                <span>Back to Dashboard</span>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
                <p className="text-gray-600">Code: {group.code} • {group.members?.length || 0} members</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {/* Video Call Status */}
              {videoCallActive && (
                <div className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-semibold flex items-center space-x-2">
                  <i className="fas fa-video"></i>
                  <span>Live Video Call</span>
                </div>
              )}
              
              {/* Connection Status */}
              <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
                socketConnected ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
              }`}>
                {socketConnected ? '🟢 Real-time' : '🟡 API Mode'}
              </div>
              
              <div className="text-sm text-gray-500">
                {user.name} (<span className="capitalize">{user.role}</span>)
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Rest of the component remains the same as your previous version */}
      {/* Tabs, Chat, Notes, Q&A, and Video Call sections */}
      {/* ... (keep all the JSX from your previous GroupChat component) ... */}
      
    </div>
  );
};

export default GroupChat;