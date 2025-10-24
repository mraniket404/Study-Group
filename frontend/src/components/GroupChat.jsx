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

  // Video Call Functions
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
      }

      setVideoCallActive(true);
      setIsInVideoCall(true);
      setVideoCallLoading(false);
      addNotification('Video call started!', 'success');
      
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

  // Socket connection
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

  // Question creation with fallback
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

  // Question answering with fallback
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

      {/* Navigation tabs */}
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
        <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-md h-[600px] flex flex-col">
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

            {/* Message input */}
            <form onSubmit={handleSendMessage} className="border-t p-4">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={
                    socketConnected 
                      ? "Type your message..." 
                      : "API Mode - Messages will sync on refresh"
                  }
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                {socketConnected 
                  ? '✅ Real-time chat enabled' 
                  : '🔌 Using API mode - messages will be saved'}
              </div>
            </form>
          </div>
        </main>
      )}

      {/* Notes tab content */}
      {activeTab === 'notes' && (
        <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-md h-[600px] flex flex-col">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold">Collaborative Notes</h2>
              <p className="text-sm text-gray-600">
                All changes are automatically saved and shared with group members
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

      {/* Questions and Answers tab content */}
      {activeTab === 'qa' && (
        <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="space-y-6">
            {/* Ask question form */}
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

            {/* Questions list */}
            <div className="space-y-4">
              {questions.length === 0 ? (
                <div className="text-center py-8 bg-white rounded-lg shadow-md">
                  <i className="fas fa-question-circle text-4xl text-gray-300 mb-4"></i>
                  <p className="text-gray-600">No questions yet</p>
                  <p className="text-sm text-gray-500">Ask the first question!</p>
                </div>
              ) : (
                questions.map((question) => (
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
                        Waiting for mentor's answer...
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      )}

      {/* Video Call tab content */}
      {activeTab === 'video' && (
        <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="space-y-6">
            {/* Video Call Controls */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold mb-4">Video Call</h2>
              
              {!videoCallActive ? (
                <div className="text-center py-8">
                  <i className="fas fa-video text-4xl text-gray-300 mb-4"></i>
                  <p className="text-gray-600 mb-4">No active video call</p>
                  {user.role === 'mentor' && (
                    <button
                      onClick={startVideoCall}
                      disabled={videoCallLoading}
                      className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 disabled:opacity-50"
                    >
                      {videoCallLoading ? (
                        <>
                          <i className="fas fa-spinner fa-spin mr-2"></i>
                          Starting Call...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-play mr-2"></i>
                          Start Video Call
                        </>
                      )}
                    </button>
                  )}
                  {user.role === 'student' && (
                    <p className="text-sm text-gray-500">
                      Waiting for mentor to start a video call...
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Video Call Info */}
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-blue-800">
                          <i className="fas fa-video mr-2"></i>
                          Live Video Call
                        </h3>
                        <p className="text-blue-600 text-sm">
                          Started by: {videoCallData?.userName || 'Mentor'} • 
                          Participants: {participants.length}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        {!isInVideoCall ? (
                          <button
                            onClick={joinVideoCall}
                            className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600"
                          >
                            <i className="fas fa-phone mr-2"></i>
                            Join Call
                          </button>
                        ) : (
                          <button
                            onClick={leaveVideoCall}
                            className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
                          >
                            <i className="fas fa-phone-slash mr-2"></i>
                            Leave Call
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Video Call Container */}
                  {isInVideoCall && (
                    <div className="bg-black rounded-lg p-4 min-h-[400px] relative">
                      {/* Local Video */}
                      {localStream && (
                        <div className="absolute bottom-4 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden border-2 border-white shadow-lg">
                          <video
                            ref={localVideoRef}
                            autoPlay
                            muted
                            playsInline
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                            You {isAudioMuted ? '🔇' : '🎤'} {isVideoOff ? '📷❌' : '📷'}
                          </div>
                        </div>
                      )}

                      {/* Remote Videos */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {participants
                          .filter(p => p.userId !== user._id)
                          .map(participant => (
                            <div key={participant.userId} className="bg-gray-800 rounded-lg overflow-hidden h-64 relative">
                              <div className="flex items-center justify-center h-full text-white">
                                <i className="fas fa-user text-4xl text-gray-400"></i>
                                <div className="ml-4">
                                  <div className="font-semibold">{participant.userName}</div>
                                  <div className="text-sm text-gray-300">Connecting...</div>
                                </div>
                              </div>
                              <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                                {participant.userName}
                              </div>
                            </div>
                          ))
                        }
                      </div>

                      {/* No other participants message */}
                      {participants.filter(p => p.userId !== user._id).length === 0 && (
                        <div className="flex items-center justify-center h-64 text-white">
                          <div className="text-center">
                            <i className="fas fa-users text-4xl text-gray-400 mb-4"></i>
                            <p>Waiting for other participants to join...</p>
                            <p className="text-sm text-gray-300 mt-2">
                              Share this group code: <strong>{group.code}</strong>
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Call Controls */}
                      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-4">
                        <button
                          onClick={toggleAudio}
                          className={`p-3 rounded-full ${
                            isAudioMuted ? 'bg-red-500' : 'bg-gray-600'
                          } text-white hover:bg-opacity-80`}
                        >
                          <i className={`fas ${isAudioMuted ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
                        </button>
                        <button
                          onClick={toggleVideo}
                          className={`p-3 rounded-full ${
                            isVideoOff ? 'bg-red-500' : 'bg-gray-600'
                          } text-white hover:bg-opacity-80`}
                        >
                          <i className={`fas ${isVideoOff ? 'fa-video-slash' : 'fa-video'}`}></i>
                        </button>
                        <button
                          onClick={leaveVideoCall}
                          className="p-3 rounded-full bg-red-500 text-white hover:bg-red-600"
                        >
                          <i className="fas fa-phone-slash"></i>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Participants List */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">Participants ({participants.length})</h4>
                    <div className="space-y-2">
                      {participants.map(participant => (
                        <div key={participant.userId} className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full ${
                            participant.userId === user._id ? 'bg-green-500' : 'bg-blue-500'
                          }`}></div>
                          <span className={`font-medium ${
                            participant.userId === user._id ? 'text-green-600' : 'text-gray-700'
                          }`}>
                            {participant.userName} {participant.userId === user._id && '(You)'}
                          </span>
                          {participant.userId === videoCallData?.userId && (
                            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                              Host
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