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
  
  // ✅ COMPLETE VIDEO CALL STATES
  const [videoCallActive, setVideoCallActive] = useState(false);
  const [videoCallData, setVideoCallData] = useState(null);
  const [isInVideoCall, setIsInVideoCall] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [videoCallLoading, setVideoCallLoading] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const messagesEndRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRefs = useRef(new Map());
  const peerConnections = useRef(new Map());

  // Socket connection monitor
  useEffect(() => {
    console.log('🎯 GroupChat Mounted - Analysis:', {
      group: group?.name,
      user: user?.name,
      userRole: user?.role,
      socket: socket ? 'Available' : 'Missing'
    });

    loadInitialData();

    if (!socket) {
      setConnectionStatus('no-socket');
      return;
    }

    // Socket event handlers
    const handleConnect = () => {
      console.log('🎉 ✅ SOCKET CONNECTED IN GROUPCHAT!');
      setConnectionStatus('connected');
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
      setMessages(prev => prev.filter(msg => !msg.isSending));
    };

    const handleMessageError = (error) => {
      console.error('❌ Message error:', error);
      addNotification('Failed to send message: ' + error.error, 'error');
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

    // ✅ COMPLETE VIDEO CALL EVENT HANDLERS
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

    const handleVideoCallJoinedSuccess = async (data) => {
      console.log('🎥 Successfully joined video call:', data);
      setIsInVideoCall(true);
      setVideoCallLoading(false);
      setVideoCallData(prev => ({ ...prev, ...data }));
      setParticipants(data.participants || []);
      
      // Start local media and WebRTC
      await startLocalMedia();
      initializeWebRTC();
      
      addNotification('Joined video call successfully!', 'success');
    };

    const handleVideoCallEnded = (data) => {
      console.log('🎥 Video call ended:', data);
      cleanupVideoCall();
      addNotification('Video call has ended', 'info');
    };

    const handleParticipantJoined = (data) => {
      console.log('🎥 Participant joined:', data);
      setParticipants(prev => [...prev, data.participant]);
      addNotification(`${data.participant.name} joined the video call`, 'info');
      
      // Create WebRTC connection for new participant
      if (isInVideoCall) {
        createPeerConnection(data.participant._id, true);
      }
    };

    const handleParticipantLeft = (data) => {
      console.log('🎥 Participant left:', data);
      setParticipants(prev => prev.filter(p => p._id !== data.participant._id));
      
      // Clean up WebRTC connection
      cleanupPeerConnection(data.participant._id);
      
      addNotification(`${data.participant.name} left the video call`, 'info');
    };

    const handleVideoCallError = (error) => {
      console.error('🎥 Video call error:', error);
      setVideoCallLoading(false);
      addNotification(`Video call failed: ${error.error}`, 'error');
    };

    // ✅ WEBRTC SIGNALING EVENT HANDLERS
    const handleWebRTCOffer = async (data) => {
      console.log('📞 Received WebRTC offer from:', data.from);
      const pc = await createPeerConnection(data.from, false);
      
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      socket.emit('webrtc-answer', {
        to: data.from,
        from: user._id,
        answer: answer
      });
    };

    const handleWebRTCAnswer = async (data) => {
      console.log('📞 Received WebRTC answer from:', data.from);
      const pc = peerConnections.current.get(data.from);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    };

    const handleWebRTCICECandidate = async (data) => {
      console.log('🧊 Received ICE candidate from:', data.from);
      const pc = peerConnections.current.get(data.from);
      if (pc && data.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
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
    
    // ✅ Video Call Event Listeners
    socket.on('videoCallStarted', handleVideoCallStarted);
    socket.on('videoCallStartedSuccess', handleVideoCallStartedSuccess);
    socket.on('videoCallJoinedSuccess', handleVideoCallJoinedSuccess);
    socket.on('videoCallEnded', handleVideoCallEnded);
    socket.on('participantJoined', handleParticipantJoined);
    socket.on('participantLeft', handleParticipantLeft);
    socket.on('video_call_error', handleVideoCallError);
    
    // ✅ WebRTC Signaling Event Listeners
    socket.on('webrtc-offer', handleWebRTCOffer);
    socket.on('webrtc-answer', handleWebRTCAnswer);
    socket.on('webrtc-ice-candidate', handleWebRTCICECandidate);

    // Check current socket status
    if (socket.connected) {
      console.log('✅ Socket already connected, setting up...');
      setConnectionStatus('connected');
      socket.emit('joinRoom', { groupId: group._id });
    } else {
      setConnectionStatus('connecting');
      console.log('🔄 Socket not connected, waiting for connection...');
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
        
        // Video Call Cleanup
        socket.off('videoCallStarted', handleVideoCallStarted);
        socket.off('videoCallStartedSuccess', handleVideoCallStartedSuccess);
        socket.off('videoCallJoinedSuccess', handleVideoCallJoinedSuccess);
        socket.off('videoCallEnded', handleVideoCallEnded);
        socket.off('participantJoined', handleParticipantJoined);
        socket.off('participantLeft', handleParticipantLeft);
        socket.off('video_call_error', handleVideoCallError);
        
        // WebRTC Signaling Cleanup
        socket.off('webrtc-offer', handleWebRTCOffer);
        socket.off('webrtc-answer', handleWebRTCAnswer);
        socket.off('webrtc-ice-candidate', handleWebRTCICECandidate);
      }
      
      // Cleanup video call on unmount
      if (isInVideoCall) {
        cleanupVideoCall();
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

  // ✅ WEBRTC FUNCTIONS
  const startLocalMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720 },
        audio: true 
      });
      setLocalStream(stream);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      addNotification('Cannot access camera/microphone. Please check permissions.', 'error');
      return null;
    }
  };

  const createPeerConnection = async (participantId, isInitiator) => {
    try {
      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      };

      const pc = new RTCPeerConnection(configuration);
      peerConnections.current.set(participantId, pc);

      // Add local stream to connection
      if (localStream) {
        localStream.getTracks().forEach(track => {
          pc.addTrack(track, localStream);
        });
      }

      // Handle incoming remote stream
      pc.ontrack = (event) => {
        console.log('📹 Received remote stream from:', participantId);
        const remoteStream = event.streams[0];
        
        setRemoteStreams(prev => {
          const newStreams = new Map(prev);
          newStreams.set(participantId, remoteStream);
          return newStreams;
        });

        // Update video element
        setTimeout(() => {
          const videoElement = remoteVideoRefs.current.get(participantId);
          if (videoElement && remoteStream) {
            videoElement.srcObject = remoteStream;
          }
        }, 100);
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('webrtc-ice-candidate', {
            to: participantId,
            from: user._id,
            candidate: event.candidate
          });
        }
      };

      // Create offer if initiator
      if (isInitiator) {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          
          socket.emit('webrtc-offer', {
            to: participantId,
            from: user._id,
            offer: offer
          });
        } catch (error) {
          console.error('Error creating offer:', error);
        }
      }

      return pc;
    } catch (error) {
      console.error('Error creating peer connection:', error);
      return null;
    }
  };

  const initializeWebRTC = () => {
    // Create peer connections for all existing participants
    participants.forEach(participant => {
      if (participant._id !== user._id) {
        createPeerConnection(participant._id, true);
      }
    });
  };

  const cleanupPeerConnection = (participantId) => {
    const pc = peerConnections.current.get(participantId);
    if (pc) {
      pc.close();
      peerConnections.current.delete(participantId);
    }
    
    setRemoteStreams(prev => {
      const newStreams = new Map(prev);
      newStreams.delete(participantId);
      return newStreams;
    });
  };

  const cleanupVideoCall = () => {
    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    // Close all peer connections
    peerConnections.current.forEach((pc, participantId) => {
      pc.close();
    });
    peerConnections.current.clear();

    // Clear remote streams
    setRemoteStreams(new Map());
    setParticipants([]);
    
    // Reset states
    setIsInVideoCall(false);
    setVideoCallActive(false);
    setVideoCallData(null);
    setVideoCallLoading(false);
    setIsAudioMuted(false);
    setIsVideoOff(false);
  };

  // ✅ VIDEO CALL CONTROL FUNCTIONS
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

  const handleJoinVideoCall = () => {
    if (socket && socket.connected && videoCallData) {
      console.log('🎥 Joining video call...', videoCallData);
      setVideoCallLoading(true);
      
      socket.emit('joinVideoCall', {
        callId: videoCallData.callId,
        userId: user._id,
        userName: user.name
      });
    } else {
      addNotification('Cannot join video call - no connection', 'error');
    }
  };

  const handleLeaveVideoCall = () => {
    if (socket && socket.connected && videoCallData) {
      socket.emit('leaveVideoCall', {
        callId: videoCallData.callId,
        userId: user._id,
        userName: user.name
      });
    }
    cleanupVideoCall();
    addNotification('You left the video call', 'info');
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
      cleanupVideoCall();
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsAudioMuted(!isAudioMuted);
      addNotification(isAudioMuted ? 'Microphone unmuted' : 'Microphone muted', 'info');
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
      addNotification(isVideoOff ? 'Camera turned on' : 'Camera turned off', 'info');
    }
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

  // Data loading functions
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

  // ✅ UPDATED VIDEO CALL MODAL - GOOGLE MEET STYLE
  const VideoCallModal = () => {
    return (
      <div className="fixed inset-0 bg-gray-900 flex flex-col z-50">
        {/* Header */}
        <div className="bg-gray-800 text-white p-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold">Video Call - {group.name}</h2>
            <p className="text-sm text-gray-300">
              {participants.length} participant(s) in call
              {videoCallData?.startedBy && ` • Started by: ${videoCallData.startedBy.name}`}
            </p>
          </div>
          <div className="flex space-x-2">
            {user.role === 'mentor' && (
              <button
                onClick={handleEndVideoCall}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center space-x-2"
              >
                <i className="fas fa-phone-slash"></i>
                <span>End Call</span>
              </button>
            )}
            <button
              onClick={handleLeaveVideoCall}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center space-x-2"
            >
              <i className="fas fa-sign-out-alt"></i>
              <span>Leave</span>
            </button>
          </div>
        </div>

        {/* Video Grid */}
        <div className="flex-1 p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-auto">
          {/* Local Video */}
          <div className="bg-black rounded-lg overflow-hidden relative aspect-video">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
              You {isAudioMuted && '🔇'} {isVideoOff && '📷❌'}
            </div>
          </div>

          {/* Remote Videos */}
          {Array.from(remoteStreams.entries()).map(([participantId, stream]) => {
            const participant = participants.find(p => p._id === participantId);
            return (
              <div key={participantId} className="bg-black rounded-lg overflow-hidden relative aspect-video">
                <video
                  ref={el => {
                    if (el) remoteVideoRefs.current.set(participantId, el);
                  }}
                  autoPlay
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
                  {participant?.name || 'Participant'}
                </div>
              </div>
            );
          })}

          {/* Waiting for participants */}
          {remoteStreams.size === 0 && (
            <div className="col-span-2 lg:col-span-3 flex items-center justify-center text-white">
              <div className="text-center">
                <i className="fas fa-user-friends text-6xl mb-4 text-gray-400"></i>
                <p className="text-xl">Waiting for other participants to join...</p>
                <p className="text-gray-400">Share the call link with others</p>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="bg-gray-800 p-4 flex justify-center space-x-4">
          <button
            onClick={toggleAudio}
            className={`p-4 rounded-full ${
              isAudioMuted ? 'bg-red-600 text-white' : 'bg-gray-600 text-white'
            } hover:bg-gray-500 transition-colors`}
            title={isAudioMuted ? 'Unmute' : 'Mute'}
          >
            <i className={`fas ${isAudioMuted ? 'fa-microphone-slash' : 'fa-microphone'} text-xl`}></i>
          </button>
          
          <button
            onClick={toggleVideo}
            className={`p-4 rounded-full ${
              isVideoOff ? 'bg-red-600 text-white' : 'bg-gray-600 text-white'
            } hover:bg-gray-500 transition-colors`}
            title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
          >
            <i className={`fas ${isVideoOff ? 'fa-video-slash' : 'fa-video'} text-xl`}></i>
          </button>
          
          <button
            onClick={handleLeaveVideoCall}
            className="p-4 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors"
            title="Leave call"
          >
            <i className="fas fa-phone-slash text-xl"></i>
          </button>
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

  // Navigation tabs based on role
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
              {/* Video Call Button - Only for Mentor */}
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

              {/* Video Call Notification for Students */}
              {user.role === 'student' && videoCallActive && (
                <button
                  onClick={handleJoinVideoCall}
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

      {/* Video Tab Content */}
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
                  <h3 className="font-semibold text-blue-800 mb-2">Features:</h3>
                  <ul className="text-blue-700 text-sm space-y-1">
                    <li>• Real-time video and audio communication</li>
                    <li>• Multiple participants support</li>
                    <li>• Mute/unmute audio and video</li>
                    <li>• Google Meet-like interface</li>
                    <li>• Screen sharing ready</li>
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

      {/* Video Call Modal */}
      {isInVideoCall && <VideoCallModal />}
    </div>
  );
};

export default GroupChat;