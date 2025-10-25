import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_BASE = 'https://study-group-j14u.onrender.com/api';

const GroupChat = ({ user, group, socket, socketConnected, token, onBack, addNotification }) => {
  
  console.log('🔍 GroupChat: Component loaded');
  console.log('🔍 GroupChat: Group ID:', group?._id);
  console.log('👤 GroupChat: User:', user?.name);
  console.log('🔌 GroupChat: Socket Available:', socket ? 'Yes' : 'No');
  console.log('🔌 GroupChat: Socket Connected:', socketConnected ? 'Yes' : 'No');

  // Early return for missing data
  if (!user || !group) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center bg-white rounded-2xl p-8 shadow-2xl border border-blue-100">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Loading Group Data</h3>
          <p className="text-gray-600 mb-6">Please wait while we load your study group...</p>
          <button
            onClick={onBack}
            className="bg-gradient-to-r from-red-500 to-pink-600 text-white px-6 py-3 rounded-lg hover:from-red-600 hover:to-pink-700 flex items-center space-x-2 shadow-md transition-all duration-200 hover:shadow-lg mx-auto"
          >
            <i className="fas fa-arrow-left"></i>
            <span>Back to Dashboard</span>
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
  
  // WebRTC states
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [peerConnections, setPeerConnections] = useState(new Map());

  const messagesEndRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRefs = useRef(new Map());

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

  // WebRTC Configuration
  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // WebRTC Functions
  const createPeerConnection = (userId) => {
    const peerConnection = new RTCPeerConnection(configuration);
    
    // Add local stream to peer connection
    if (localStream) {
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });
    }

    // Handle incoming remote stream
    peerConnection.ontrack = (event) => {
      console.log('🎥 Remote track received:', event.streams[0]);
      const remoteStream = event.streams[0];
      setRemoteStreams(prev => new Map(prev.set(userId, remoteStream)));
      
      // Update video element when it's available
      setTimeout(() => {
        const videoElement = remoteVideoRefs.current.get(userId);
        if (videoElement && remoteStream) {
          videoElement.srcObject = remoteStream;
        }
      }, 100);
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socket && socketConnected) {
        socket.emit('ice-candidate', {
          targetUserId: userId,
          candidate: event.candidate,
          groupId: group._id
        });
      }
    };

    return peerConnection;
  };

  // Video Call Functions - IMPROVED WITH WEBRTC
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

      // Emit video call start event
      if (socket && socketConnected) {
        socket.emit('startVideoCall', {
          groupId: group._id,
          userId: user._id,
          userName: user.name
        });
        console.log('🎥 Video call started via socket');
      }

      setVideoCallActive(true);
      setIsInVideoCall(true);
      setVideoCallData({
        groupId: group._id,
        userId: user._id,
        userName: user.name
      });
      setParticipants([{ userId: user._id, userName: user.name }]);
      
      setVideoCallLoading(false);
      addNotification('Video call started! Share group code with students.', 'success');
      
    } catch (error) {
      console.error('Error starting video call:', error);
      addNotification('Failed to start video call. Please check camera/mic permissions.', 'error');
      setVideoCallLoading(false);
    }
  };

  const joinVideoCall = async () => {
    try {
      setVideoCallLoading(true);
      
      // Get user media for student bhi
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      setLocalStream(stream);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      if (socket && socketConnected) {
        socket.emit('joinVideoCall', {
          groupId: group._id,
          userId: user._id,
          userName: user.name
        });
      }
      
      setIsInVideoCall(true);
      setVideoCallLoading(false);
      addNotification('Joined video call successfully!', 'success');
      
    } catch (error) {
      console.error('Error joining video call:', error);
      addNotification('Failed to join video call. Check camera/mic permissions.', 'error');
      setVideoCallLoading(false);
    }
  };

  const leaveVideoCall = () => {
    cleanupVideoCall();
    
    if (socket && socketConnected) {
      socket.emit('leaveVideoCall', {
        groupId: group._id,
        userId: user._id,
        userName: user.name
      });
    }
    
    setIsInVideoCall(false);
    // Only mentor can end the entire call
    if (user.role === 'mentor') {
      endVideoCall();
    }
    addNotification('Left video call', 'info');
  };

  const endVideoCall = () => {
    cleanupVideoCall();
    
    if (socket && socketConnected) {
      socket.emit('endVideoCall', {
        groupId: group._id,
        userId: user._id
      });
    }
    
    setVideoCallActive(false);
    setVideoCallData(null);
    setIsInVideoCall(false);
    setParticipants([]);
    setRemoteStreams(new Map());
    setPeerConnections(new Map());
    addNotification('Video call ended', 'info');
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
      localStream.getTracks().forEach(track => {
        track.stop();
      });
      setLocalStream(null);
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    
    // Clean up peer connections
    peerConnections.forEach((pc, userId) => {
      pc.close();
    });
    setPeerConnections(new Map());
    setRemoteStreams(new Map());
  };

  // Socket connection - IMPROVED WITH BETTER SYNC
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
        if (data.userId !== user._id) {
          addNotification('Notes updated by another user', 'info');
        }
      }
    };

    // IMPROVED: Question handlers with immediate sync
    const handleNewQuestion = (question) => {
      console.log('❓ New question received via socket:', question);
      if (question.groupId === group._id) {
        // Remove temporary questions with same content
        setQuestions(prev => {
          const filtered = prev.filter(q => 
            !q.isSending || q.question !== question.question
          );
          
          // Check if question already exists to avoid duplicates
          const exists = filtered.some(q => q._id === question._id || 
            (q.isSending && q.question === question.question));
          
          if (!exists) {
            return [...filtered, question];
          }
          return filtered;
        });
        
        // Notification show karo for new questions
        if (question.user?._id !== user._id) {
          addNotification(`New question from ${question.user?.name || 'a member'}`, 'info');
        }
      }
    };

    const handleQuestionAnswered = (data) => {
      console.log('✅ Question answered via socket:', data);
      if (data.groupId === group._id) {
        setQuestions(prev => prev.map(q => 
          q._id === data.questionId ? { 
            ...q, 
            answer: data.answer, 
            answeredBy: data.answeredBy, 
            answeredAt: data.answeredAt || new Date().toISOString()
          } : q
        ));
        
        // Notification for answer
        if (data.answeredBy?._id !== user._id) {
          addNotification(`Your question was answered by ${data.answeredBy?.name || 'mentor'}`, 'success');
        }
      }
    };

    // IMPROVED: Video call socket handlers with WebRTC
    const handleVideoCallStarted = (data) => {
      console.log('🎥 Video call started notification:', data);
      if (data.groupId === group._id) {
        setVideoCallData(data);
        setVideoCallActive(true);
        setParticipants([{ userId: data.userId, userName: data.userName }]);
        addNotification(`${data.userName} started a video call!`, 'info');
      }
    };

    const handleVideoCallEnded = (data) => {
      console.log('🎥 Video call ended notification:', data);
      if (data.groupId === group._id) {
        setVideoCallActive(false);
        setVideoCallData(null);
        setIsInVideoCall(false);
        setParticipants([]);
        setRemoteStreams(new Map());
        setPeerConnections(new Map());
        cleanupVideoCall();
        addNotification('Video call has ended', 'info');
      }
    };

    const handleUserJoinedCall = (data) => {
      console.log('🎥 User joined call:', data);
      if (data.groupId === group._id) {
        setParticipants(prev => {
          const filtered = prev.filter(p => p.userId !== data.userId);
          return [...filtered, { userId: data.userId, userName: data.userName }];
        });
        addNotification(`${data.userName} joined the video call`, 'success');
        
        // WebRTC connection setup would go here in a real implementation
      }
    };

    const handleUserLeftCall = (data) => {
      console.log('🎥 User left call:', data);
      if (data.groupId === group._id) {
        setParticipants(prev => prev.filter(p => p.userId !== data.userId));
        setRemoteStreams(prev => {
          const newStreams = new Map(prev);
          newStreams.delete(data.userId);
          return newStreams;
        });
        setPeerConnections(prev => {
          const newPCs = new Map(prev);
          const pc = newPCs.get(data.userId);
          if (pc) {
            pc.close();
            newPCs.delete(data.userId);
          }
          return newPCs;
        });
        addNotification(`${data.userName} left the video call`, 'info');
        
        // If mentor left, end call for everyone
        if (data.userId === videoCallData?.userId) {
          setVideoCallActive(false);
          setVideoCallData(null);
          setIsInVideoCall(false);
          cleanupVideoCall();
          addNotification('Video call ended by host', 'info');
        }
      }
    };

    // WebRTC signaling events
    const handleOffer = async (data) => {
      // WebRTC offer handling
      console.log('📞 Received WebRTC offer:', data);
    };

    const handleAnswer = async (data) => {
      // WebRTC answer handling  
      console.log('📞 Received WebRTC answer:', data);
    };

    const handleIceCandidate = async (data) => {
      // WebRTC ICE candidate handling
      console.log('📞 Received ICE candidate:', data);
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
      socket.on('offer', handleOffer);
      socket.on('answer', handleAnswer);
      socket.on('ice-candidate', handleIceCandidate);

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
        socket.off('offer', handleOffer);
        socket.off('answer', handleAnswer);
        socket.off('ice-candidate', handleIceCandidate);
      }
      cleanupVideoCall();
    };
  }, [socket, socketConnected, group._id, user._id, videoCallData]);

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

  // Update remote videos when streams change
  useEffect(() => {
    remoteStreams.forEach((stream, userId) => {
      const videoElement = remoteVideoRefs.current.get(userId);
      if (videoElement && stream) {
        videoElement.srcObject = stream;
      }
    });
  }, [remoteStreams]);

  // Message sending with fallback
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

  // Notes update with fallback
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

  // IMPROVED: Question creation with better real-time sync
  const handleCreateQuestion = async (e) => {
    e.preventDefault();
    if (!newQuestion.trim()) {
      addNotification('Question cannot be empty', 'warning');
      return;
    }

    const questionText = newQuestion.trim();
    setNewQuestion('');

    // Immediate UI update
    const tempQuestion = {
      _id: `temp-${Date.now()}`,
      question: questionText,
      user: { _id: user._id, name: user.name },
      groupId: group._id,
      createdAt: new Date(),
      isSending: true
    };
    setQuestions(prev => [...prev, tempQuestion]);

    try {
      if (socket && socketConnected) {
        socket.emit('createQuestion', {
          groupId: group._id,
          userId: user._id,
          userName: user.name,
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
        
        // Replace temporary question with real one
        setQuestions(prev => {
          const filtered = prev.filter(q => q._id !== tempQuestion._id);
          return [...filtered, response.data];
        });
        addNotification('Question posted!', 'success');
      }
    } catch (error) {
      console.error('Error creating question:', error);
      addNotification('Failed to post question', 'error');
      // Remove temporary question on error
      setQuestions(prev => prev.filter(q => q._id !== tempQuestion._id));
    }
  };

  // IMPROVED: Question answering with better real-time sync
  const handleAnswerQuestion = async (questionId) => {
    if (!answer.trim()) {
      addNotification('Answer cannot be empty', 'warning');
      return;
    }

    const answerText = answer.trim();
    setAnswer('');
    setAnsweringQuestion(null);

    // Immediate UI update
    setQuestions(prev => prev.map(q => 
      q._id === questionId ? { 
        ...q, 
        answer: answerText, 
        answeredBy: { _id: user._id, name: user.name },
        answeredAt: new Date().toISOString(),
        isAnswering: true 
      } : q
    ));

    try {
      if (socket && socketConnected) {
        socket.emit('answerQuestion', {
          groupId: group._id,
          userId: user._id,
          userName: user.name,
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
        
        // Update with server response
        setQuestions(prev => prev.map(q => 
          q._id === questionId ? { ...response.data, isAnswering: false } : q
        ));
        addNotification('Answer submitted!', 'success');
      }
    } catch (error) {
      console.error('Error answering question:', error);
      addNotification('Failed to submit answer', 'error');
      // Revert on error
      setQuestions(prev => prev.map(q => 
        q._id === questionId ? { ...q, answer: undefined, answeredBy: undefined, answeredAt: undefined, isAnswering: false } : q
      ));
    }
  };

  // Utility functions
  const getUserName = (messageUser) => {
    return messageUser?.name || 'Unknown User';
  };

  const isUserMessage = (messageUser) => {
    return messageUser?._id === user._id;
  };

  // Set remote video ref
  const setRemoteVideoRef = (userId, element) => {
    if (element) {
      remoteVideoRefs.current.set(userId, element);
    } else {
      remoteVideoRefs.current.delete(userId);
    }
  };

  // Navigation tabs
  const navigationTabs = ['chat', 'notes', 'qa', 'video'];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center bg-white rounded-2xl p-8 shadow-2xl border border-blue-100">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Loading {group.name}</h3>
          <p className="text-gray-600 mb-6">Please wait while we load all group data...</p>
          <button
            onClick={onBack}
            className="bg-gradient-to-r from-red-500 to-pink-600 text-white px-6 py-3 rounded-lg hover:from-red-600 hover:to-pink-700 flex items-center space-x-2 shadow-md transition-all duration-200 hover:shadow-lg mx-auto"
          >
            <i className="fas fa-arrow-left"></i>
            <span>Back to Dashboard</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-indigo-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={onBack}
                className="text-white hover:text-blue-100 flex items-center space-x-2 bg-blue-500 bg-opacity-20 px-4 py-2 rounded-lg transition-all duration-200 hover:bg-opacity-30 backdrop-blur-sm"
              >
                <i className="fas fa-arrow-left"></i>
                <span>Back to Dashboard</span>
              </button>
              <div className="flex items-center space-x-3">
                <div className="bg-white p-2 rounded-lg shadow-md">
                  <i className="fas fa-users text-xl text-blue-600"></i>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">{group.name}</h1>
                  <p className="text-blue-100">Code: {group.code} • {group.members?.length || 0} members</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {/* Video Call Status */}
              {videoCallActive && (
                <div className="bg-red-500 text-white px-4 py-2 rounded-full text-sm font-semibold flex items-center space-x-2 shadow-lg animate-pulse">
                  <i className="fas fa-video"></i>
                  <span>Live Video Call</span>
                </div>
              )}
              
              {/* Connection Status */}
              <div className={`px-4 py-2 rounded-full text-sm font-semibold shadow-md ${
                socketConnected ? 'bg-green-500 text-white' : 'bg-yellow-500 text-white'
              }`}>
                {socketConnected ? '🟢 Real-time' : '🟡 API Mode'}
              </div>
              
              <div className="text-blue-100 bg-blue-500 bg-opacity-20 px-3 py-1 rounded-full">
                {user.name} (<span className="capitalize">{user.role}</span>)
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation tabs */}
      <div className="bg-white border-b border-blue-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {navigationTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm capitalize transition-all duration-200 ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600 font-bold'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab === 'qa' ? 'Q&A' : 
                 tab === 'chat' ? 'Chat' : 
                 tab === 'notes' ? 'Notes' : 
                 tab === 'video' ? 'Video Call' : tab}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Chat tab content */}
      {activeTab === 'chat' && (
        <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl shadow-xl h-[600px] flex flex-col border border-blue-100">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 py-12">
                  <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-comments text-2xl text-blue-500"></i>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">No messages yet</h3>
                  <p className="text-gray-500">Start the conversation with your group!</p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message._id}
                    className={`flex ${
                      isUserMessage(message.user) ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-xs md:max-w-md rounded-2xl px-4 py-3 shadow-md ${
                        message.isSending 
                          ? 'bg-gray-200 text-gray-700 opacity-70 border-2 border-dashed border-gray-300' 
                          : isUserMessage(message.user)
                            ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white'
                            : 'bg-gray-100 text-gray-800 border border-gray-200'
                      }`}
                    >
                      <div className="font-semibold text-sm opacity-90">
                        {getUserName(message.user)}
                        {message.isSending && ' (Sending...)'}
                      </div>
                      <div className="mt-1">{message.content}</div>
                      <div className="text-xs opacity-75 mt-2">
                        {new Date(message.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message input */}
            <form onSubmit={handleSendMessage} className="border-t border-blue-100 p-6 bg-gray-50 rounded-b-2xl">
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={
                    socketConnected 
                      ? "Type your message..." 
                      : "API Mode - Messages will sync on refresh"
                  }
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-3 rounded-xl hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 transition-all duration-200 shadow-md hover:shadow-lg flex items-center space-x-2"
                >
                  <i className="fas fa-paper-plane"></i>
                  <span>Send</span>
                </button>
              </div>
              <div className={`text-xs mt-2 flex items-center space-x-1 ${
                socketConnected ? 'text-green-600' : 'text-yellow-600'
              }`}>
                <i className={`fas ${socketConnected ? 'fa-check-circle' : 'fa-exclamation-triangle'}`}></i>
                <span>
                  {socketConnected 
                    ? '✅ Real-time chat enabled' 
                    : '🔌 Using API mode - messages will be saved'}
                </span>
              </div>
            </form>
          </div>
        </main>
      )}

      {/* Notes tab content */}
      {activeTab === 'notes' && (
        <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl shadow-xl h-[600px] flex flex-col border border-blue-100">
            <div className="p-6 border-b border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-2xl">
              <h2 className="text-xl font-bold text-gray-800 flex items-center space-x-2">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <i className="fas fa-edit text-blue-600"></i>
                </div>
                <span>Collaborative Notes</span>
              </h2>
              <p className="text-gray-600 mt-1">
                All changes are automatically saved and shared with group members in real-time
              </p>
            </div>
            <textarea
              value={notes}
              onChange={(e) => handleNoteUpdate(e.target.value)}
              className="flex-1 p-6 border-none resize-none focus:outline-none text-gray-700 leading-relaxed"
              placeholder="Start typing your notes here... Collaborate with your group members in real-time!"
            />
            <div className="p-4 border-t border-blue-100 bg-gray-50 rounded-b-2xl">
              <div className="text-xs text-gray-500 flex items-center space-x-1">
                <i className="fas fa-info-circle"></i>
                <span>Changes are saved automatically as you type</span>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* IMPROVED: Questions and Answers tab content */}
      {activeTab === 'qa' && (
        <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="space-y-6">
            {/* Ask question form */}
            <div className="bg-white rounded-2xl shadow-xl p-6 border border-blue-100">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center space-x-2">
                <div className="bg-green-100 p-2 rounded-lg">
                  <i className="fas fa-question-circle text-green-600"></i>
                </div>
                <span>Ask a Question</span>
              </h2>
              <form onSubmit={handleCreateQuestion} className="flex space-x-3">
                <input
                  type="text"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="What would you like to ask your mentor or group members?"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <button
                  type="submit"
                  disabled={!newQuestion.trim()}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-xl hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 transition-all duration-200 shadow-md hover:shadow-lg flex items-center space-x-2"
                >
                  <i className="fas fa-paper-plane"></i>
                  <span>Ask</span>
                </button>
              </form>
              <div className={`text-xs mt-2 flex items-center space-x-1 ${
                socketConnected ? 'text-green-600' : 'text-yellow-600'
              }`}>
                <i className={`fas ${socketConnected ? 'fa-check-circle' : 'fa-exclamation-triangle'}`}></i>
                <span>
                  {socketConnected 
                    ? '✅ Real-time Q&A enabled' 
                    : '🔌 Using API mode - questions will sync on refresh'}
                </span>
              </div>
            </div>

            {/* Questions list */}
            <div className="space-y-4">
              {questions.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl shadow-xl border border-blue-100">
                  <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-question-circle text-2xl text-blue-500"></i>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">No questions yet</h3>
                  <p className="text-gray-500">Be the first to ask a question!</p>
                </div>
              ) : (
                questions.map((question) => (
                  <div key={question._id} className="bg-white rounded-2xl shadow-xl p-6 border border-blue-100 hover:shadow-2xl transition-all duration-300">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-bold text-gray-800 text-lg flex items-start space-x-3">
                        <div className="bg-blue-100 p-2 rounded-lg mt-1">
                          <i className="fas fa-question text-blue-600 text-sm"></i>
                        </div>
                        <span>
                          {question.question}
                          {question.isSending && ' (Posting...)'}
                        </span>
                      </h3>
                      {!question.answer && user.role === 'mentor' && (
                        <button
                          onClick={() => setAnsweringQuestion(question._id)}
                          className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-2 rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg flex items-center space-x-2"
                        >
                          <i className="fas fa-reply"></i>
                          <span>Answer</span>
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-4 flex items-center space-x-2">
                      <i className="fas fa-user text-gray-400"></i>
                      <span>Asked by: {getUserName(question.user)}</span>
                      <i className="fas fa-clock text-gray-400 ml-2"></i>
                      <span>{new Date(question.createdAt).toLocaleDateString()}</span>
                    </p>
                    
                    {question.answer ? (
                      <div className={`mt-4 p-4 rounded-xl border-2 ${
                        question.isAnswering ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'
                      }`}>
                        <div className="font-bold text-green-800 mb-2 flex items-center space-x-2">
                          <div className="bg-green-100 p-1 rounded-lg">
                            <i className="fas fa-check text-green-600 text-sm"></i>
                          </div>
                          <span>{question.isAnswering ? 'Answering...' : 'Answer:'}</span>
                        </div>
                        <p className="text-green-700 ml-2">{question.answer}</p>
                        <div className="text-xs text-green-600 mt-3 flex items-center space-x-2">
                          <i className="fas fa-user-check"></i>
                          <span>Answered by: {question.answeredBy?.name || 'Mentor'}</span>
                          <i className="fas fa-clock ml-2"></i>
                          <span>{question.answeredAt ? new Date(question.answeredAt).toLocaleDateString() : 'Recently'}</span>
                        </div>
                      </div>
                    ) : answeringQuestion === question._id ? (
                      <div className="mt-4 space-y-3">
                        <textarea
                          value={answer}
                          onChange={(e) => setAnswer(e.target.value)}
                          placeholder="Type your answer here... Help your fellow students with clear explanations!"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                          rows="4"
                        />
                        <div className="flex space-x-3">
                          <button
                            onClick={() => handleAnswerQuestion(question._id)}
                            className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-md hover:shadow-lg flex items-center space-x-2"
                          >
                            <i className="fas fa-check"></i>
                            <span>Submit Answer</span>
                          </button>
                          <button
                            onClick={() => setAnsweringQuestion(null)}
                            className="bg-gradient-to-r from-gray-500 to-gray-600 text-white px-6 py-3 rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all duration-200 shadow-md hover:shadow-lg flex items-center space-x-2"
                          >
                            <i className="fas fa-times"></i>
                            <span>Cancel</span>
                          </button>
                        </div>
                      </div>
                    ) : user.role === 'mentor' ? (
                      <div className="mt-3">
                        <button
                          onClick={() => setAnsweringQuestion(question._id)}
                          className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-5 py-2 rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg flex items-center space-x-2 text-sm"
                        >
                          <i className="fas fa-reply"></i>
                          <span>Answer Question</span>
                        </button>
                      </div>
                    ) : (
                      <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                        <div className="flex items-center space-x-2 text-yellow-700">
                          <i className="fas fa-clock"></i>
                          <span className="text-sm font-medium">Waiting for mentor's answer...</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      )}

      {/* IMPROVED: Video Call tab content with WebRTC */}
      {activeTab === 'video' && (
        <main className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="space-y-6">
            {/* Video Call Controls */}
            <div className="bg-white rounded-2xl shadow-xl p-6 border border-blue-100">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center space-x-2">
                <div className="bg-red-100 p-2 rounded-lg">
                  <i className="fas fa-video text-red-600"></i>
                </div>
                <span>Video Call</span>
              </h2>
              
              {!videoCallActive ? (
                <div className="text-center py-8">
                  <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-video text-3xl text-blue-500"></i>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">No active video call</h3>
                  <p className="text-gray-500 mb-6">Start or join a video call to collaborate with your group</p>
                  {user.role === 'mentor' && (
                    <button
                      onClick={startVideoCall}
                      disabled={videoCallLoading}
                      className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-8 py-4 rounded-xl hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center space-x-3 mx-auto"
                    >
                      {videoCallLoading ? (
                        <>
                          <i className="fas fa-spinner fa-spin"></i>
                          <span>Starting Call...</span>
                        </>
                      ) : (
                        <>
                          <i className="fas fa-play"></i>
                          <span className="font-semibold">Start Video Call</span>
                        </>
                      )}
                    </button>
                  )}
                  {user.role === 'student' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 max-w-md mx-auto">
                      <div className="flex items-center space-x-2 text-blue-700 mb-2">
                        <i className="fas fa-info-circle"></i>
                        <span className="font-semibold">Waiting for Mentor</span>
                      </div>
                      <p className="text-sm text-blue-600">
                        The mentor will start the video call. You'll be notified when it begins.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Video Call Info */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="bg-red-500 text-white p-3 rounded-lg shadow-lg animate-pulse">
                          <i className="fas fa-video text-lg"></i>
                        </div>
                        <div>
                          <h3 className="font-bold text-blue-800 text-lg">
                            Live Video Call
                          </h3>
                          <p className="text-blue-600">
                            Started by: <strong>{videoCallData?.userName || 'Mentor'}</strong> • 
                            Participants: <strong>{participants.length}</strong>
                          </p>
                          <p className="text-blue-600 text-sm mt-1 bg-blue-100 px-3 py-1 rounded-full inline-block">
                            Share this code: <strong className="text-blue-800">{group.code}</strong>
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-3">
                        {!isInVideoCall ? (
                          <button
                            onClick={joinVideoCall}
                            disabled={videoCallLoading}
                            className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-lg hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 transition-all duration-200 shadow-md hover:shadow-lg flex items-center space-x-2"
                          >
                            {videoCallLoading ? (
                              <>
                                <i className="fas fa-spinner fa-spin"></i>
                                <span>Joining...</span>
                              </>
                            ) : (
                              <>
                                <i className="fas fa-phone"></i>
                                <span>Join Call</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <div className="flex space-x-3">
                            {user.role === 'mentor' && (
                              <button
                                onClick={endVideoCall}
                                className="bg-gradient-to-r from-red-500 to-pink-600 text-white px-6 py-3 rounded-lg hover:from-red-600 hover:to-pink-700 transition-all duration-200 shadow-md hover:shadow-lg flex items-center space-x-2"
                              >
                                <i className="fas fa-stop"></i>
                                <span>End Call</span>
                              </button>
                            )}
                            <button
                              onClick={leaveVideoCall}
                              className="bg-gradient-to-r from-red-500 to-pink-600 text-white px-6 py-3 rounded-lg hover:from-red-600 hover:to-pink-700 transition-all duration-200 shadow-md hover:shadow-lg flex items-center space-x-2"
                            >
                              <i className="fas fa-phone-slash"></i>
                              <span>Leave Call</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Video Call Container - Only show if user has joined */}
                  {isInVideoCall && (
                    <div className="bg-gray-900 rounded-2xl p-6 min-h-[500px] relative border-2 border-blue-300 shadow-2xl">
                      {/* Local Video */}
                      {localStream && (
                        <div className="absolute bottom-6 right-6 w-56 h-40 bg-gray-800 rounded-xl overflow-hidden border-2 border-white shadow-2xl z-10 transform hover:scale-105 transition-transform duration-300">
                          <video
                            ref={localVideoRef}
                            autoPlay
                            muted
                            playsInline
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute bottom-3 left-3 bg-black bg-opacity-60 text-white text-xs px-3 py-1 rounded-full backdrop-blur-sm">
                            You {isAudioMuted ? '🔇' : '🎤'} {isVideoOff ? '📷❌' : '📷'}
                          </div>
                        </div>
                      )}

                      {/* Remote Videos with actual WebRTC streams */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
                        {participants
                          .filter(p => p.userId !== user._id)
                          .map(participant => {
                            const remoteStream = remoteStreams.get(participant.userId);
                            return (
                              <div key={participant.userId} className="bg-gray-800 rounded-xl overflow-hidden h-80 relative border-2 border-blue-400 shadow-lg">
                                {remoteStream ? (
                                  <video
                                    ref={el => setRemoteVideoRef(participant.userId, el)}
                                    autoPlay
                                    playsInline
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="flex items-center justify-center h-full text-white">
                                    <div className="text-center">
                                      <i className="fas fa-user text-5xl text-gray-400 mb-3"></i>
                                      <div className="font-semibold text-lg">{participant.userName}</div>
                                      <div className="text-sm text-gray-300 mt-1">
                                        {participant.userId === videoCallData?.userId ? 'Host - Connecting...' : 'Connecting...'}
                                      </div>
                                    </div>
                                  </div>
                                )}
                                <div className="absolute bottom-3 left-3 bg-black bg-opacity-60 text-white text-sm px-3 py-1 rounded-full backdrop-blur-sm">
                                  {participant.userName}
                                  {remoteStream && ' 🔴 Live'}
                                </div>
                              </div>
                            );
                          })
                        }
                        
                        {/* No other participants message */}
                        {participants.filter(p => p.userId !== user._id).length === 0 && (
                          <div className="flex items-center justify-center h-80 text-white col-span-2">
                            <div className="text-center">
                              <i className="fas fa-users text-6xl text-gray-400 mb-4"></i>
                              <p className="text-xl font-semibold mb-2">Waiting for other participants</p>
                              <p className="text-gray-300">
                                Share this group code: <strong className="text-white text-lg">{group.code}</strong>
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Call Controls */}
                      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex space-x-4 z-20">
                        <button
                          onClick={toggleAudio}
                          className={`p-4 rounded-full shadow-lg transform hover:scale-110 transition-all duration-200 ${
                            isAudioMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'
                          } text-white`}
                        >
                          <i className={`fas ${isAudioMuted ? 'fa-microphone-slash' : 'fa-microphone'} text-lg`}></i>
                        </button>
                        <button
                          onClick={toggleVideo}
                          className={`p-4 rounded-full shadow-lg transform hover:scale-110 transition-all duration-200 ${
                            isVideoOff ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'
                          } text-white`}
                        >
                          <i className={`fas ${isVideoOff ? 'fa-video-slash' : 'fa-video'} text-lg`}></i>
                        </button>
                        <button
                          onClick={leaveVideoCall}
                          className="p-4 rounded-full bg-red-500 text-white hover:bg-red-600 shadow-lg transform hover:scale-110 transition-all duration-200"
                        >
                          <i className="fas fa-phone-slash text-lg"></i>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Participants List */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
                    <h4 className="font-bold text-blue-800 mb-3 flex items-center space-x-2">
                      <i className="fas fa-users"></i>
                      <span>Participants ({participants.length})</span>
                      {!isInVideoCall && <span className="text-yellow-600 text-sm ml-2">- Join call to participate</span>}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {participants.map(participant => (
                        <div key={participant.userId} className={`flex items-center space-x-3 p-3 rounded-lg ${
                          participant.userId === user._id ? 'bg-blue-100 border border-blue-300' : 
                          participant.userId === videoCallData?.userId ? 'bg-green-100 border border-green-300' : 'bg-white border border-gray-200'
                        }`}>
                          <div className={`w-3 h-3 rounded-full ${
                            participant.userId === user._id ? 'bg-green-500' : 
                            participant.userId === videoCallData?.userId ? 'bg-blue-500' : 'bg-gray-500'
                          }`}></div>
                          <div className="flex-1">
                            <span className={`font-semibold ${
                              participant.userId === user._id ? 'text-green-600' : 
                              participant.userId === videoCallData?.userId ? 'text-blue-600' : 'text-gray-700'
                            }`}>
                              {participant.userName} 
                              {participant.userId === user._id && ' (You)'}
                              {participant.userId === videoCallData?.userId && ' (Host)'}
                            </span>
                          </div>
                          {remoteStreams.has(participant.userId) && participant.userId !== user._id && (
                            <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
                              Live
                            </span>
                          )}
                          {!isInVideoCall && participant.userId === user._id && (
                            <span className="bg-yellow-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
                              Not in call
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      )}
    </div>
  );
};

export default GroupChat;