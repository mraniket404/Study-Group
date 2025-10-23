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

  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!group || !group._id) {
      console.error('❌ Group data is invalid:', group);
      addNotification('Invalid group data', 'error');
      return;
    }

    console.log('🔌 INITIALIZING SOCKET FOR GROUP:', group._id);
    console.log('👤 CURRENT USER:', user.name);
    console.log('🔗 Socket connected?', socket.connected);

    // Socket connection events
    const handleConnect = () => {
      console.log('✅ ✅ ✅ SOCKET CONNECTED SUCCESSFULLY');
      console.log('🆔 Socket ID:', socket.id);
      
      // Join room after connection
      console.log(`🎯 Joining room: ${group._id}`);
      socket.emit('joinRoom', { groupId: group._id });
    };

    const handleConnectError = (error) => {
      console.error('❌ SOCKET CONNECTION FAILED:', error);
      addNotification('Real-time connection failed', 'error');
    };

    const handleConnectionTest = (data) => {
      console.log('🧪 CONNECTION TEST:', data);
    };

    const handleRoomJoined = (data) => {
      console.log('🎉 ROOM JOINED:', data);
      addNotification(`Connected to ${group.name}`, 'success');
    };

    const handleNewMessage = (message) => {
      console.log('💬 💬 💬 NEW MESSAGE RECEIVED:', message);
      console.log('📨 Content:', message.content);
      console.log('👤 From:', message.user.name);
      
      setMessages(prev => {
        // Remove any temporary messages
        const filtered = prev.filter(msg => 
          !msg.isSending || msg.content !== message.content
        );
        return [...filtered, message];
      });
      
      // Show notification only for others' messages
      if (message.user._id !== user.id) {
        addNotification(`New message from ${message.user.name}`, 'info');
      }
    };

    // Register socket listeners
    socket.on('connect', handleConnect);
    socket.on('connect_error', handleConnectError);
    socket.on('connection_test', handleConnectionTest);
    socket.on('room_joined', handleRoomJoined);
    socket.on('newMessage', handleNewMessage);

    // Other event listeners
    socket.on('noteUpdated', (data) => {
      console.log('📝 NOTE UPDATED:', data);
      setNotes(data.content);
    });

    socket.on('newQuestion', (question) => {
      console.log('❓ NEW QUESTION:', question);
      setQuestions(prev => [...prev, question]);
    });

    socket.on('questionAnswered', (question) => {
      console.log('💡 QUESTION ANSWERED:', question);
      setQuestions(prev => prev.map(q => 
        q._id === question._id ? question : q
      ));
    });

    // If already connected, join room immediately
    if (socket.connected) {
      console.log('🚀 Socket already connected, joining room');
      socket.emit('joinRoom', { groupId: group._id });
    }

    // Load initial data
    loadInitialData();

    return () => {
      console.log('🧹 Cleaning up socket listeners');
      
      // Remove listeners
      socket.off('connect', handleConnect);
      socket.off('connect_error', handleConnectError);
      socket.off('connection_test', handleConnectionTest);
      socket.off('room_joined', handleRoomJoined);
      socket.off('newMessage', handleNewMessage);
      socket.off('noteUpdated');
      socket.off('newQuestion');
      socket.off('questionAnswered');
      
      socket.emit('leaveRoom', { groupId: group._id });
    };
  }, [group, socket, user]);

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
      console.log('✅ Initial data loaded');
    } catch (error) {
      console.error('❌ Error loading initial data:', error);
      addNotification('Error loading group data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      console.log('📨 Fetching messages...');
      const response = await axios.get(`${API_BASE}/messages/${group._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✅ Messages fetched:', response.data.length);
      setMessages(response.data || []);
    } catch (error) {
      console.error('❌ Error fetching messages:', error);
      setMessages([]);
    }
  };

  const fetchNotes = async () => {
    try {
      const response = await axios.get(`${API_BASE}/notes/${group._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data) {
        setNotes(response.data.content || '');
      } else {
        setNotes('');
      }
    } catch (error) {
      console.error('❌ Error fetching notes:', error);
      setNotes('');
    }
  };

  const fetchQuestions = async () => {
    try {
      const response = await axios.get(`${API_BASE}/questions/${group._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setQuestions(response.data || []);
    } catch (error) {
      console.error('❌ Error fetching questions:', error);
      setQuestions([]);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) {
      addNotification('Message cannot be empty', 'warning');
      return;
    }

    console.log('🚀 SENDING MESSAGE:', {
      groupId: group._id,
      userId: user.id,
      content: newMessage,
      socketConnected: socket.connected
    });

    // Add temporary message
    const tempMessage = {
      _id: `temp-${Date.now()}`,
      content: newMessage,
      user: { _id: user.id, name: user.name },
      createdAt: new Date(),
      isSending: true
    };
    
    setMessages(prev => [...prev, tempMessage]);
    setNewMessage('');

    // Check socket connection
    if (!socket.connected) {
      console.error('❌ Socket not connected');
      addNotification('Connection lost', 'error');
      return;
    }

    // Send via socket
    socket.emit('sendMessage', {
      groupId: group._id,
      userId: user.id,
      content: newMessage
    });

    console.log('✅ Message sent via socket');

    // Remove temp message after timeout
    setTimeout(() => {
      setMessages(prev => prev.filter(msg => 
        !msg.isSending || msg._id !== tempMessage._id
      ));
    }, 5000);
  };

  const handleNoteUpdate = (content) => {
    setNotes(content);
    socket.emit('updateNote', {
      groupId: group._id,
      userId: user.id,
      content: content
    });
  };

  const handleCreateQuestion = (e) => {
    e.preventDefault();
    if (!newQuestion.trim()) {
      addNotification('Question cannot be empty', 'warning');
      return;
    }

    socket.emit('createQuestion', {
      groupId: group._id,
      userId: user.id,
      question: newQuestion
    });

    setNewQuestion('');
    addNotification('Question posted successfully!', 'success');
  };

  const handleAnswerQuestion = (questionId) => {
    if (!answer.trim()) {
      addNotification('Answer cannot be empty', 'warning');
      return;
    }

    socket.emit('answerQuestion', {
      groupId: group._id,
      userId: user.id,
      questionId: questionId,
      answer: answer
    });

    setAnswer('');
    setAnsweringQuestion(null);
    addNotification('Answer submitted successfully!', 'success');
  };

  // Safe user check function
  const getUserName = (messageUser) => {
    if (!messageUser) return 'Unknown User';
    return messageUser.name || 'Unknown User';
  };

  const isUserMessage = (messageUser) => {
    if (!messageUser || !messageUser._id) return false;
    return messageUser._id === user.id;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading group data...</p>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 text-lg">Group not found</p>
          <button
            onClick={onBack}
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
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
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="text-gray-600 hover:text-gray-800 flex items-center space-x-2"
            >
              <i className="fas fa-arrow-left"></i>
              <span>Back</span>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
              <p className="text-gray-600">Group Code: {group.code}</p>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            Logged in as: <span className="font-semibold">{user.name}</span> ({user.role})
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {['chat', 'notes', 'qa', 'video'].map((tab) => (
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
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Chat Tab */}
        {activeTab === 'chat' && (
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
                    key={message._id || Math.random()}
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
                      <div className="text-xs opacity-75 mt-2">
                        {message.createdAt ? new Date(message.createdAt).toLocaleTimeString() : 'Just now'}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="border-t p-4">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading || !newMessage.trim()}
                  className="bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Notes Tab */}
        {activeTab === 'notes' && (
          <div className="bg-white rounded-lg shadow-md h-[600px] flex flex-col">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold">Collaborative Notes</h2>
              <p className="text-sm text-gray-600">
                All changes are saved automatically and shared with group members in real-time
              </p>
            </div>
            <textarea
              value={notes}
              onChange={(e) => handleNoteUpdate(e.target.value)}
              className="flex-1 p-4 border-none resize-none focus:outline-none"
              placeholder="Start typing your notes here..."
              rows={10}
            />
          </div>
        )}

        {/* Q&A Tab */}
        {activeTab === 'qa' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold mb-4">Ask a Question</h2>
              <form onSubmit={handleCreateQuestion} className="flex space-x-2">
                <input
                  type="text"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="What would you like to ask?"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading || !newQuestion.trim()}
                  className="bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50"
                >
                  Ask
                </button>
              </form>
            </div>

            <div className="space-y-4">
              {questions.map((question) => (
                <div key={question._id} className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="font-semibold text-gray-800 text-lg mb-2">
                    {question.question}
                  </h3>
                  <p className="text-sm text-gray-600">
                    Asked by: {question.user ? question.user.name : 'Unknown User'}
                  </p>
                  
                  {question.answer ? (
                    <div className="mt-3 p-3 bg-green-50 rounded">
                      <p className="text-green-700">{question.answer}</p>
                    </div>
                  ) : user.role === 'mentor' ? (
                    <div className="mt-3">
                      <button
                        onClick={() => setAnsweringQuestion(question._id)}
                        className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                      >
                        Answer Question
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 text-yellow-600">
                      Waiting for mentor's response...
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Video Tab */}
        {activeTab === 'video' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold mb-4">Video Session</h2>
            <div className="text-center py-12">
              <i className="fas fa-video text-6xl text-gray-400 mb-4"></i>
              <p className="text-gray-600 mb-4">
                Video session feature coming soon
              </p>
              <button 
                disabled
                className="bg-blue-500 text-white px-8 py-3 rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                Start Session (Coming Soon)
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default GroupChat;