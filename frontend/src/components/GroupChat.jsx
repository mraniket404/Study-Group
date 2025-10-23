import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

const GroupChat = ({ user, group, socket, token, onBack, addNotification }) => {
  const [activeTab, setActiveTab] = useState('chat');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [notes, setNotes] = useState('');
  const [questions, setQuestions] = useState([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [answeringQuestion, setAnsweringQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('checking');
  
  // ✅ UPDATED: Video Call States
  const [videoCallActive, setVideoCallActive] = useState(false);
  const [videoCallData, setVideoCallData] = useState(null);
  const [isInVideoCall, setIsInVideoCall] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [videoCallLoading, setVideoCallLoading] = useState(false);

  const messagesEndRef = useRef(null);

  // Socket connection monitor
  useEffect(() => {
    console.log('🎯 GroupChat Mounted - Analysis:', {
      group: group?.name,
      user: user?.name,
      socket: socket ? 'Available' : 'Missing',
      connected: socket?.connected ? 'Yes' : 'No',
      socketId: socket?.id
    });

    // Load data immediately
    loadInitialData();

    if (!socket) {
      setConnectionStatus('no-socket');
      console.log('❌ No socket available');
      return;
    }

    // Socket event handlers
    const handleConnect = () => {
      console.log('🎉 ✅ SOCKET CONNECTED IN GROUPCHAT! ID:', socket.id);
      setConnectionStatus('connected');
      addNotification('Real-time chat activated!', 'success');
      
      // Join room after connection
      socket.emit('joinRoom', { groupId: group._id });
    };

    const handleConnectError = (error) => {
      console.error('❌ Socket connection failed:', error);
      setConnectionStatus('disconnected');
    };

    const handleDisconnect = (reason) => {
      console.log('🔌 Socket disconnected:', reason);
      setConnectionStatus('disconnected');
    };

    const handleRoomJoined = (data) => {
      console.log('🎉 Room joined successfully:', data);
    };

    const handleNewMessage = (message) => {
      console.log('💬 NEW MESSAGE RECEIVED:', message);
      setMessages(prev => {
        // Remove temporary messages with same content
        const filtered = prev.filter(msg => 
          !msg.isSending || msg.content !== message.content
        );
        return [...filtered, message];
      });
    };

    const handleExistingMessages = (existingMessages) => {
      console.log('📨 Existing messages received:', existingMessages.length);
      setMessages(existingMessages);
    };

    const handleMessageSent = (data) => {
      console.log('✅ Message sent confirmation:', data);
      // Remove temporary message
      setMessages(prev => prev.filter(msg => !msg.isSending));
    };

    const handleMessageError = (error) => {
      console.error('❌ Message error:', error);
      addNotification('Failed to send message: ' + error.error, 'error');
      // Remove temporary message
      setMessages(prev => prev.filter(msg => !msg.isSending));
    };

    const handleNoteUpdated = (data) => {
      console.log('📝 Note updated:', data);
      setNotes(data.content);
    };

    const handleNewQuestion = (question) => {
      console.log('❓ New question:', question);
      setQuestions(prev => [...prev, question]);
    };

    const handleQuestionAnswered = (question) => {
      console.log('💡 Question answered:', question);
      setQuestions(prev => prev.map(q => 
        q._id === question._id ? question : q
      ));
    };

    // ✅ UPDATED: Video Call Event Handlers
    const handleVideoCallStarted = (data) => {
      console.log('🎥 Video call started notification:', data);
      setVideoCallActive(true);
      setVideoCallData(data);
      
      if (user.role === 'student') {
        addNotification(
          `${data.startedBy.name} started a video call. Click "Join Video Call" to join!`, 
          'warning',
          10000
        );
      } else {
        addNotification('Video call started! Waiting for students to join...', 'success');
      }
    };

    const handleVideoCallStartedSuccess = (data) => {
      console.log('🎥 Video call started successfully:', data);
      setVideoCallActive(true);
      setVideoCallData(data);
      setVideoCallLoading(false);
      addNotification('Video call started! Students can now join.', 'success');
    };

    const handleVideoCallJoinedSuccess = (data) => {
      console.log('🎥 Successfully joined video call:', data);
      setIsInVideoCall(true);
      setVideoCallLoading(false);
      setVideoCallData(prev => ({ ...prev, ...data }));
      addNotification('Joined video call successfully!', 'success');
    };

    const handleVideoCallEnded = (data) => {
      console.log('🎥 Video call ended:', data);
      setVideoCallActive(false);
      setIsInVideoCall(false);
      setVideoCallData(null);
      setVideoCallLoading(false);
      stopLocalStream();
      addNotification('Video call has ended', 'info');
    };

    const handleParticipantJoined = (data) => {
      console.log('🎥 Participant joined:', data);
      addNotification(`${data.participant.name} joined the video call`, 'info');
    };

    const handleVideoCallError = (error) => {
      console.error('🎥 Video call error:', error);
      setVideoCallLoading(false);
      addNotification(error.error, 'error');
    };

    const handleTestResponse = (data) => {
      console.log('🧪 Test response:', data);
      addNotification('Socket test successful!', 'success');
    };

    // Register event listeners
    socket.on('connect', handleConnect);
    socket.on('connect_error', handleConnectError);
    socket.on('disconnect', handleDisconnect);
    socket.on('room_joined', handleRoomJoined);
    socket.on('newMessage', handleNewMessage);
    socket.on('existing_messages', handleExistingMessages);
    socket.on('message_sent', handleMessageSent);
    socket.on('message_error', handleMessageError);
    socket.on('noteUpdated', handleNoteUpdated);
    socket.on('newQuestion', handleNewQuestion);
    socket.on('questionAnswered', handleQuestionAnswered);
    socket.on('test_response', handleTestResponse);
    
    // ✅ UPDATED: Video Call Event Listeners
    socket.on('videoCallStarted', handleVideoCallStarted);
    socket.on('videoCallStartedSuccess', handleVideoCallStartedSuccess);
    socket.on('videoCallJoinedSuccess', handleVideoCallJoinedSuccess);
    socket.on('videoCallEnded', handleVideoCallEnded);
    socket.on('participantJoined', handleParticipantJoined);
    socket.on('video_call_error', handleVideoCallError);

    // Check current socket status
    if (socket.connected) {
      console.log('✅ Socket already connected, setting up...');
      setConnectionStatus('connected');
      socket.emit('joinRoom', { groupId: group._id });
    } else {
      setConnectionStatus('connecting');
      console.log('🔄 Socket not connected, waiting for connection...');
      
      // Try to connect if not connected
      setTimeout(() => {
        if (!socket.connected) {
          console.log('🔄 Attempting socket connection...');
          socket.connect();
        }
      }, 1000);
    }

    // Cleanup
    return () => {
      console.log('🧹 GroupChat cleanup: Removing socket listeners');
      if (socket) {
        socket.off('connect', handleConnect);
        socket.off('connect_error', handleConnectError);
        socket.off('disconnect', handleDisconnect);
        socket.off('room_joined', handleRoomJoined);
        socket.off('newMessage', handleNewMessage);
        socket.off('existing_messages', handleExistingMessages);
        socket.off('message_sent', handleMessageSent);
        socket.off('message_error', handleMessageError);
        socket.off('noteUpdated', handleNoteUpdated);
        socket.off('newQuestion', handleNewQuestion);
        socket.off('questionAnswered', handleQuestionAnswered);
        socket.off('test_response', handleTestResponse);
        
        // ✅ UPDATED: Video Call Cleanup
        socket.off('videoCallStarted', handleVideoCallStarted);
        socket.off('videoCallStartedSuccess', handleVideoCallStartedSuccess);
        socket.off('videoCallJoinedSuccess', handleVideoCallJoinedSuccess);
        socket.off('videoCallEnded', handleVideoCallEnded);
        socket.off('participantJoined', handleParticipantJoined);
        socket.off('video_call_error', handleVideoCallError);
      }
    };
  }, [socket, group]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
      
      console.log('✅ Initial data loaded successfully');
      setLoading(false);
    } catch (error) {
      console.error('❌ Error loading initial data:', error);
      addNotification('Error loading group data', 'error');
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      const response = await axios.get(`${API_BASE}/messages/${group._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('📨 Messages fetched:', response.data?.length || 0);
      setMessages(response.data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setMessages([]);
    }
  };

  const fetchNotes = async () => {
    try {
      const response = await axios.get(`${API_BASE}/notes/${group._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('📝 Notes fetched');
      setNotes(response.data?.content || '');
    } catch (error) {
      console.error('Error fetching notes:', error);
      setNotes('');
    }
  };

  const fetchQuestions = async () => {
    try {
      const response = await axios.get(`${API_BASE}/questions/${group._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('❓ Questions fetched:', response.data?.length || 0);
      setQuestions(response.data || []);
    } catch (error) {
      console.error('Error fetching questions:', error);
      setQuestions([]);
    }
  };

  // ✅ UPDATED: Video Call Handlers
  const handleStartVideoCall = () => {
    if (socket && socket.connected) {
      console.log('🎥 Starting video call...', {
        user: {
          id: user._id,
          name: user.name,
          role: user.role
        },
        group: {
          id: group._id,
          name: group.name
        }
      });
      
      setVideoCallLoading(true);
      
      socket.emit('startVideoCall', {
        groupId: group._id,
        userId: user._id,
        userName: user.name
      });
    } else {
      console.log('❌ Socket not connected');
      addNotification('Cannot start video call - no connection', 'error');
    }
  };

  const handleJoinVideoCall = (callData) => {
    if (socket && socket.connected) {
      console.log('🎥 Joining video call...', callData);
      setVideoCallLoading(true);
      
      socket.emit('joinVideoCall', {
        callId: callData.callId,
        userId: user._id,
        userName: user.name
      });
      
      setVideoCallData(callData);
    } else {
      addNotification('Cannot join video call - no connection', 'error');
    }
  };

  const handleEndVideoCall = () => {
    if (socket && socket.connected && videoCallData) {
      console.log('🎥 Ending video call...');
      socket.emit('endVideoCall', {
        callId: videoCallData.callId,
        userId: user._id
      });
    } else {
      // Force cleanup even if no connection
      setVideoCallActive(false);
      setIsInVideoCall(false);
      setVideoCallData(null);
      setVideoCallLoading(false);
      stopLocalStream();
    }
  };

  const handleLeaveVideoCall = () => {
    if (socket && socket.connected && videoCallData) {
      socket.emit('leaveVideoCall', {
        callId: videoCallData.callId,
        userId: user._id
      });
    }
    setIsInVideoCall(false);
    setVideoCallData(null);
    setVideoCallLoading(false);
    stopLocalStream();
  };

  const stopLocalStream = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) {
      addNotification('Message cannot be empty', 'warning');
      return;
    }

    console.log('📤 Sending message:', newMessage);

    // Add temporary message
    const tempMessage = {
      _id: `temp-${Date.now()}`,
      content: newMessage,
      user: { _id: user._id, name: user.name },
      createdAt: new Date(),
      isSending: true
    };
    
    setMessages(prev => [...prev, tempMessage]);
    setNewMessage('');

    // Send via socket if available and connected
    if (socket && socket.connected) {
      console.log('🚀 Sending via socket...');
      socket.emit('sendMessage', {
        groupId: group._id,
        userId: user._id,
        content: newMessage
      });
    } else {
      console.log('❌ Socket not connected, using API fallback...');
      // API fallback
      axios.post(`${API_BASE}/messages`, {
        groupId: group._id,
        content: newMessage
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(response => {
        console.log('✅ Message sent via API:', response.data);
        addNotification('Message sent!', 'success');
        // Remove temporary message and add real one
        setMessages(prev => {
          const filtered = prev.filter(msg => msg._id !== tempMessage._id);
          return [...filtered, response.data];
        });
      })
      .catch(error => {
        console.error('❌ API fallback failed:', error);
        addNotification('Failed to send message', 'error');
        // Remove temporary message
        setMessages(prev => prev.filter(msg => msg._id !== tempMessage._id));
      });
    }
  };

  const handleNoteUpdate = (content) => {
    setNotes(content);
    if (socket && socket.connected) {
      socket.emit('updateNote', {
        groupId: group._id,
        userId: user._id,
        content: content
      });
    }
  };

  const handleCreateQuestion = (e) => {
    e.preventDefault();
    if (!newQuestion.trim()) {
      addNotification('Question cannot be empty', 'warning');
      return;
    }

    if (socket && socket.connected) {
      socket.emit('createQuestion', {
        groupId: group._id,
        userId: user._id,
        question: newQuestion
      });
      addNotification('Question posted!', 'success');
    } else {
      addNotification('Question saved locally (offline)', 'info');
    }

    setNewQuestion('');
  };

  const handleAnswerQuestion = (questionId) => {
    if (!answer.trim()) {
      addNotification('Answer cannot be empty', 'warning');
      return;
    }

    if (socket && socket.connected) {
      socket.emit('answerQuestion', {
        groupId: group._id,
        userId: user._id,
        questionId: questionId,
        answer: answer
      });
      addNotification('Answer submitted!', 'success');
    } else {
      addNotification('Answer saved locally (offline)', 'info');
    }

    setAnswer('');
    setAnsweringQuestion(null);
  };

  const handleTestSocket = () => {
    if (socket && socket.connected) {
      console.log('🧪 Testing socket connection...');
      socket.emit('testMessage', {
        groupId: group._id,
        userId: user._id,
        test: 'Hello from client'
      });
    } else {
      addNotification('Socket not connected', 'error');
    }
  };

  const handleReconnectSocket = () => {
    if (socket) {
      console.log('🔄 Manually reconnecting socket...');
      socket.connect();
    }
  };

  // ✅ UPDATED: Video Call Modal Component
  const VideoCallModal = () => {
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);

    useEffect(() => {
      if (isInVideoCall) {
        startVideo();
      }
    }, [isInVideoCall]);

    const startVideo = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing media devices:', error);
        addNotification('Cannot access camera/microphone', 'error');
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg w-full max-w-4xl h-96">
          <div className="flex justify-between items-center p-4 border-b">
            <h3 className="text-lg font-semibold">
              Video Call - {group.name}
              {videoCallData?.startedBy && (
                <span className="text-sm font-normal text-gray-600 ml-2">
                  (Started by: {videoCallData.startedBy.name})
                </span>
              )}
            </h3>
            <div className="flex space-x-2">
              {user.role === 'mentor' && (
                <button
                  onClick={handleEndVideoCall}
                  className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600"
                >
                  End Call
                </button>
              )}
              <button
                onClick={handleLeaveVideoCall}
                className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
              >
                Leave Call
              </button>
            </div>
          </div>
          
          <div className="p-4 h-80 flex space-x-4">
            {/* Local Video */}
            <div className="flex-1 bg-gray-900 rounded-lg overflow-hidden relative">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
                You ({user.name})
              </div>
            </div>

            {/* Remote Video */}
            <div className="flex-1 bg-gray-800 rounded-lg overflow-hidden relative">
              <video
                ref={remoteVideoRef}
                autoPlay
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
                Other Participant
              </div>
              
              {/* Placeholder when no remote video */}
              {!remoteStreams.length && (
                <div className="absolute inset-0 flex items-center justify-center text-white">
                  <div className="text-center">
                    <i className="fas fa-user-friends text-4xl mb-2 text-gray-400"></i>
                    <p>Waiting for participants...</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border-t bg-gray-50">
            <div className="flex justify-center space-x-4">
              <button className="bg-red-500 text-white p-3 rounded-full hover:bg-red-600">
                <i className="fas fa-microphone"></i>
              </button>
              <button className="bg-red-500 text-white p-3 rounded-full hover:bg-red-600">
                <i className="fas fa-video"></i>
              </button>
              <button className="bg-green-500 text-white p-3 rounded-full hover:bg-green-600">
                <i className="fas fa-phone"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Safe user check functions
  const getUserName = (messageUser) => {
    return messageUser?.name || 'Unknown User';
  };

  const isUserMessage = (messageUser) => {
    return messageUser?._id === user._id;
  };

  // ✅ UPDATED: Navigation tabs based on role
  const navigationTabs = user.role === 'mentor' 
    ? ['chat', 'notes', 'qa', 'video']
    : ['chat', 'notes', 'qa'];

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
      {/* Header with Connection Status */}
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
              {/* ✅ UPDATED: Video Call Button - Only for Mentor */}
              {user.role === 'mentor' && (
                <button
                  onClick={handleStartVideoCall}
                  disabled={videoCallActive || videoCallLoading}
                  className={`px-4 py-2 rounded-md flex items-center space-x-2 ${
                    videoCallActive 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : videoCallLoading
                      ? 'bg-yellow-500 cursor-not-allowed'
                      : 'bg-green-500 hover:bg-green-600 text-white'
                  }`}
                >
                  <i className="fas fa-video"></i>
                  <span>
                    {videoCallLoading ? 'Starting...' : videoCallActive ? 'Call Active' : 'Start Video Call'}
                  </span>
                </button>
              )}

              {/* ✅ UPDATED: Video Call Notification for Students */}
              {user.role === 'student' && videoCallActive && (
                <button
                  onClick={() => handleJoinVideoCall(videoCallData)}
                  disabled={videoCallLoading}
                  className={`px-4 py-2 rounded-md flex items-center space-x-2 ${
                    videoCallLoading
                      ? 'bg-yellow-500 cursor-not-allowed'
                      : 'bg-green-500 hover:bg-green-600 text-white'
                  }`}
                >
                  <i className="fas fa-phone"></i>
                  <span>{videoCallLoading ? 'Joining...' : 'Join Video Call'}</span>
                </button>
              )}

              <div className={`px-3 py-1 rounded-full text-sm ${
                connectionStatus === 'connected' ? 'bg-green-100 text-green-800' : 
                connectionStatus === 'connecting' ? 'bg-yellow-100 text-yellow-800' : 
                'bg-red-100 text-red-800'
              }`}>
                {connectionStatus === 'connected' ? '🟢 Connected' : 
                 connectionStatus === 'connecting' ? '🟡 Connecting' : '🔴 Offline'}
              </div>
              <button 
                onClick={handleTestSocket}
                className="bg-purple-500 text-white px-3 py-1 rounded text-sm hover:bg-purple-600"
              >
                Test
              </button>
              <button 
                onClick={handleReconnectSocket}
                className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
              >
                Reconnect
              </button>
              <div className="text-sm text-gray-500">
                {user.name} ({user.role})
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {navigationTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm capitalize ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab === 'qa' ? 'Q&A' : tab}
                {tab === 'chat' && messages.length > 0 && (
                  <span className="ml-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                    {messages.length}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* ✅ UPDATED: Video Tab Content */}
      {activeTab === 'video' && user.role === 'mentor' && (
        <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-center py-8">
              <i className="fas fa-video text-6xl text-gray-300 mb-4"></i>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Video Calls</h2>
              <p className="text-gray-600 mb-6">
                Start a video call with your students. Only mentors can initiate calls.
              </p>
              
              <div className="space-y-4 max-w-md mx-auto">
                <button
                  onClick={handleStartVideoCall}
                  disabled={videoCallActive || videoCallLoading}
                  className={`w-full py-3 px-6 rounded-lg flex items-center justify-center space-x-3 ${
                    videoCallActive
                      ? 'bg-gray-400 cursor-not-allowed'
                      : videoCallLoading
                      ? 'bg-yellow-500 cursor-not-allowed'
                      : 'bg-green-500 hover:bg-green-600 text-white'
                  }`}
                >
                  <i className="fas fa-video"></i>
                  <span className="text-lg font-semibold">
                    {videoCallLoading ? 'Starting Call...' : 
                     videoCallActive ? 'Call in Progress...' : 'Start Video Call'}
                  </span>
                </button>

                {videoCallActive && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-center space-x-2 text-green-700">
                      <i className="fas fa-circle animate-pulse"></i>
                      <span>Video call is active. Students can join now.</span>
                    </div>
                    <button
                      onClick={handleEndVideoCall}
                      className="mt-3 bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 w-full"
                    >
                      End Call
                    </button>
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                  <h3 className="font-semibold text-blue-800 mb-2">How it works:</h3>
                  <ul className="text-blue-700 text-sm space-y-1">
                    <li>• Only mentors can start video calls</li>
                    <li>• Students receive notifications to join</li>
                    <li>• Up to 10 participants supported</li>
                    <li>• Camera and microphone required</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* Chat Tab */}
      {activeTab === 'chat' && (
        <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-md h-[600px] flex flex-col">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <i className="fas fa-comments text-4xl mb-4 text-gray-300"></i>
                  <p className="text-lg">No messages yet</p>
                  <p className="text-sm">Start the conversation!</p>
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
                      className={`max-w-xs md:max-w-md rounded-lg px-4 py-2 ${
                        message.isSending 
                          ? 'bg-gray-300 text-gray-700 opacity-70' 
                          : isUserMessage(message.user)
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 text-gray-800'
                      }`}
                    >
                      <div className="font-semibold text-sm">
                        {getUserName(message.user)}
                        {message.isSending && ' (Sending...)'}
                      </div>
                      <div className="mt-1">{message.content}</div>
                      <div className="text-xs opacity-75 mt-1">
                        {new Date(message.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="border-t p-4">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={
                    connectionStatus === 'connected' 
                      ? "Type your message..." 
                      : "Connecting... (messages may not send)"
                  }
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={connectionStatus !== 'connected'}
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50"
                >
                  Send
                </button>
              </div>
              <div className="text-xs text-gray-500 mt-2">
                {connectionStatus === 'connected' 
                  ? '✅ Real-time chat enabled' 
                  : '🔌 Connecting to chat service...'}
              </div>
            </form>
          </div>
        </main>
      )}

      {/* Notes Tab */}
      {activeTab === 'notes' && (
        <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-md h-[600px] flex flex-col">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold">Collaborative Notes</h2>
              <p className="text-sm text-gray-600">
                All changes are saved automatically and shared with group members
              </p>
            </div>
            <textarea
              value={notes}
              onChange={(e) => handleNoteUpdate(e.target.value)}
              className="flex-1 p-4 border-none resize-none focus:outline-none"
              placeholder="Start typing your notes here..."
            />
          </div>
        </main>
      )}

      {/* Q&A Tab */}
      {activeTab === 'qa' && (
        <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="space-y-6">
            {/* Ask Question Form */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold mb-4">Ask a Question</h2>
              <form onSubmit={handleCreateQuestion} className="flex space-x-2">
                <input
                  type="text"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="What would you like to ask?"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={!newQuestion.trim()}
                  className="bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50"
                >
                  Ask
                </button>
              </form>
            </div>

            {/* Questions List */}
            <div className="space-y-4">
              {questions.map((question) => (
                <div key={question._id} className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-gray-800 text-lg">
                      {question.question}
                    </h3>
                    {!question.answer && user.role === 'mentor' && (
                      <button
                        onClick={() => setAnsweringQuestion(question._id)}
                        className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
                      >
                        Answer
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    Asked by: {getUserName(question.user)} • 
                    {new Date(question.createdAt).toLocaleDateString()}
                  </p>
                  
                  {question.answer ? (
                    <div className="mt-3 p-3 bg-green-50 rounded border border-green-200">
                      <div className="font-semibold text-green-800 mb-1">Answer:</div>
                      <p className="text-green-700">{question.answer}</p>
                      <div className="text-xs text-green-600 mt-2">
                        Answered by: {question.answeredBy?.name || 'Mentor'} • 
                        {question.answeredAt ? new Date(question.answeredAt).toLocaleDateString() : 'Recently'}
                      </div>
                    </div>
                  ) : answeringQuestion === question._id ? (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder="Type your answer here..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows="3"
                      />
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleAnswerQuestion(question._id)}
                          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                        >
                          Submit Answer
                        </button>
                        <button
                          onClick={() => setAnsweringQuestion(null)}
                          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : user.role === 'mentor' ? (
                    <div className="mt-2">
                      <button
                        onClick={() => setAnsweringQuestion(question._id)}
                        className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 text-sm"
                      >
                        Answer Question
                      </button>
                    </div>
                  ) : (
                    <div className="mt-2 text-yellow-600 text-sm">
                      <i className="fas fa-clock mr-1"></i>
                      Waiting for mentor's response...
                    </div>
                  )}
                </div>
              ))}
              
              {questions.length === 0 && (
                <div className="text-center py-8 bg-white rounded-lg shadow-md">
                  <i className="fas fa-question-circle text-4xl text-gray-300 mb-4"></i>
                  <p className="text-gray-600">No questions yet</p>
                  <p className="text-sm text-gray-500">Be the first to ask a question!</p>
                </div>
              )}
            </div>
          </div>
        </main>
      )}

      {/* ✅ UPDATED: Video Call Modal */}
      {isInVideoCall && <VideoCallModal />}
    </div>
  );
};

export default GroupChat;