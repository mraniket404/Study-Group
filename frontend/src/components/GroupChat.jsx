import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'https://study-group-j14u.onrender.com/api';

const GroupChat = ({ user, group, socket, token, onBack, addNotification }) => {
  
  console.log('🔍 APP: GroupChat loaded');
  console.log('🔍 APP: Group ID:', group?._id);
  console.log('👤 APP: User:', user?.name);
  console.log('🔌 APP: Socket:', socket ? 'Connected' : 'Missing');

  // FIX 1: Component level early return to prevent reading properties of undefined 'user'
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
  const [connectionStatus, setConnectionStatus] = useState('checking');
  
  // ✅ Video call related states
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

  // Data loading functions - FIXED
  const fetchMessages = async () => { 
    try {
      console.log('📨 Fetching messages for group:', group._id);
      const response = await axios.get(`${API_BASE}/messages/${group._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // ✅ FIX: Ensure we always get an array
      const messagesData = response.data?.messages || response.data || [];
      console.log('📨 Messages loaded:', messagesData);
      setMessages(Array.isArray(messagesData) ? messagesData : []);
      
    } catch (error) {
      console.error('Error fetching messages:', error);
      setMessages([]);
    }
  };

  const fetchNotes = async () => { 
    try {
      console.log('📝 Fetching notes for group:', group._id);
      const response = await axios.get(`${API_BASE}/notes/${group._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // ✅ FIX: Handle different response structures
      const notesContent = response.data?.content || response.data || '';
      console.log('📝 Notes loaded:', notesContent);
      setNotes(notesContent);
      
    } catch (error) {
      console.error('Error fetching notes:', error);
      setNotes('');
    }
  };

  const fetchQuestions = async () => { 
    try {
      console.log('❓ Fetching questions for group:', group._id);
      const response = await axios.get(`${API_BASE}/questions/${group._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // ✅ FIX: Ensure we always get an array
      const questionsData = response.data?.questions || response.data || [];
      console.log('❓ Questions loaded:', questionsData);
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

  // Socket connection monitor
  useEffect(() => {
    console.log('🔌 Socket effect running');
    loadInitialData();

    if (!socket) {
      console.log('🔌 No socket available');
      setConnectionStatus('no-socket');
      return;
    }

    // Socket event handlers
    const handleConnect = () => {
      console.log('🔌 Socket connected');
      setConnectionStatus('connected');
      socket.emit('joinRoom', { groupId: group._id });
    };

    const handleConnectError = (error) => {
      console.log('🔌 Socket connection error:', error);
      setConnectionStatus('disconnected');
    };

    const handleDisconnect = (reason) => {
      console.log('🔌 Socket disconnected:', reason);
      setConnectionStatus('disconnected');
      if (isInVideoCall) {
        cleanupVideoCall(true);
        addNotification('Connection lost from server. Video call ended.', 'error');
      }
    };

    const handleRoomJoined = (data) => {
      console.log('🎉 Room successfully joined:', data);
    };

    const handleNewMessage = (message) => {
      console.log('📨 New message received:', message);
      setMessages(prev => {
        const filtered = prev.filter(msg => 
          !msg.isSending || msg.content !== message.content
        );
        return [...filtered, message];
      });
    };

    const handleExistingMessages = (existingMessages) => {
      console.log('📨 Existing messages:', existingMessages);
      setMessages(existingMessages);
    };

    const handleNoteUpdated = (data) => {
      console.log('📝 Note updated:', data);
      setNotes(data.content);
    };

    const handleNewQuestion = (question) => {
      console.log('❓ New question received:', question);
      setQuestions(prev => [...prev, question]);
    };

    const handleQuestionAnswered = (question) => {
      console.log('✅ Question answered:', question);
      setQuestions(prev => prev.map(q => 
        q._id === question._id ? question : q
      ));
    };

    // Register event listeners
    socket.on('connect', handleConnect);
    socket.on('connect_error', handleConnectError);
    socket.on('disconnect', handleDisconnect);
    socket.on('room_joined', handleRoomJoined);
    socket.on('newMessage', handleNewMessage);
    socket.on('existing_messages', handleExistingMessages);
    socket.on('noteUpdated', handleNoteUpdated);
    socket.on('newQuestion', handleNewQuestion);
    socket.on('questionAnswered', handleQuestionAnswered);

    // Check current socket status
    if (socket.connected) {
      console.log('🔌 Socket already connected');
      setConnectionStatus('connected');
      socket.emit('joinRoom', { groupId: group._id });
    } else {
      console.log('🔌 Socket connecting...');
      setConnectionStatus('connecting');
    }

    // Cleanup
    return () => {
      console.log('🔌 Cleaning up socket listeners');
      if (socket) {
        socket.off('connect', handleConnect);
        socket.off('connect_error', handleConnectError);
        socket.off('disconnect', handleDisconnect);
        socket.off('room_joined', handleRoomJoined);
        socket.off('newMessage', handleNewMessage);
        socket.off('existing_messages', handleExistingMessages);
        socket.off('noteUpdated', handleNoteUpdated);
        socket.off('newQuestion', handleNewQuestion);
        socket.off('questionAnswered', handleQuestionAnswered);
      }
    };
  }, [socket, group._id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) {
      addNotification('Message cannot be empty', 'warning');
      return;
    }

    const content = newMessage;
    setNewMessage('');

    // Add temporary message
    const tempMessage = {
      _id: `temp-${Date.now()}`,
      content: content,
      user: { _id: user._id, name: user.name },
      createdAt: new Date(),
      isSending: true
    };
    setMessages(prev => [...prev, tempMessage]);

    // Send via socket if available and connected
    if (socket && socket.connected) {
      socket.emit('sendMessage', {
        groupId: group._id,
        userId: user._id,
        content: content
      });
    } else {
      // API fallback
      axios.post(`${API_BASE}/messages`, {
        groupId: group._id,
        content: content
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(response => {
        // Remove temporary message and add real message
        setMessages(prev => {
          const filtered = prev.filter(msg => msg._id !== tempMessage._id);
          return [...filtered, response.data];
        });
      })
      .catch(error => {
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
      addNotification('Cannot post question, socket offline.', 'error');
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
      addNotification('Cannot submit answer, socket offline.', 'error');
    }

    setAnswer('');
    setAnsweringQuestion(null);
  };

  // Safe user check function
  const getUserName = (messageUser) => {
    return messageUser?.name || 'Unknown User';
  };

  const isUserMessage = (messageUser) => {
    return messageUser?._id === user._id;
  };

  // Navigation tabs based on role
  const navigationTabs = user.role === 'mentor' 
    ? ['chat', 'notes', 'qa']
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
      {/* Header with connection status */}
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
              <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
                connectionStatus === 'connected' ? 'bg-green-100 text-green-800' : 
                connectionStatus === 'connecting' ? 'bg-yellow-100 text-yellow-800' : 
                'bg-red-100 text-red-800'
              }`}>
                {connectionStatus === 'connected' ? '🟢 Connected' : 
                 connectionStatus === 'connecting' ? '🟡 Connecting' : '🔴 Offline'}
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
                {tab === 'qa' ? 'Q&A' : tab === 'chat' ? 'Chat' : tab === 'notes' ? 'Notes' : 'Video'}
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
    </div>
  );
};

export default GroupChat;