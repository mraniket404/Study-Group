import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import GroupChat from './components/GroupChat';

const API_BASE = 'http://localhost:5000/api';

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [currentView, setCurrentView] = useState('login');
  const [socket, setSocket] = useState(null);
  const [currentGroup, setCurrentGroup] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  // Add notification function
  const addNotification = (message, type = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(notif => notif.id !== id));
    }, 3000);
  };

  // Verify token function
  const verifyToken = async (token) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data.user);
      setCurrentView('dashboard');
      console.log('Token verified, user:', response.data.user);
    } catch (error) {
      console.error('Token verification failed:', error);
      localStorage.removeItem('token');
      setToken(null);
      addNotification('Session expired. Please login again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      verifyToken(token);
    }
  }, [token]);

  useEffect(() => {
    if (user && user.id) {
      console.log('Initializing socket connection for user:', user.id);
      const newSocket = io('http://localhost:5000', {
        transports: ['websocket', 'polling']
      });
      
      // Socket connection events
      newSocket.on('connect', () => {
        console.log('Socket connected successfully:', newSocket.id);
        addNotification('Connected to real-time service', 'success');
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        addNotification('Connection issues - some features may not work', 'warning');
      });

      newSocket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        if (reason === 'io server disconnect') {
          // Server disconnected, try to reconnect
          newSocket.connect();
        }
      });

      // Socket event listeners for notifications - WITH SAFE USER ACCESS
      newSocket.on('newMessage', (message) => {
        console.log('New message notification:', message);
        // Safe user check
        if (message.user && message.user._id && message.user._id !== user.id) {
          addNotification(`New message from ${message.user.name || 'Unknown User'}`, 'info');
        }
      });

      newSocket.on('newQuestion', (question) => {
        console.log('New question notification:', question);
        // Safe user checks
        if (user.role === 'mentor' && 
            question.user && 
            question.user._id && 
            question.user._id !== user.id) {
          addNotification(`New question from ${question.user.name || 'Unknown User'}`, 'warning');
        }
      });

      newSocket.on('questionAnswered', (question) => {
        console.log('Question answered notification:', question);
        // Safe user check
        if (user.role === 'student' && 
            question.user && 
            question.user._id && 
            question.user._id === user.id) {
          addNotification('Your question has been answered!', 'success');
        }
      });

      setSocket(newSocket);

      return () => {
        console.log('Cleaning up socket connection');
        newSocket.off('connect');
        newSocket.off('connect_error');
        newSocket.off('disconnect');
        newSocket.off('newMessage');
        newSocket.off('newQuestion');
        newSocket.off('questionAnswered');
        newSocket.disconnect();
      };
    }
  }, [user]);

  const handleLogin = (userData, authToken) => {
    console.log('Login successful:', userData);
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('token', authToken);
    setCurrentView('dashboard');
    addNotification(`Welcome back, ${userData.name}!`, 'success');
  };

  const handleLogout = () => {
    console.log('Logging out user:', user?.name);
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    setCurrentView('login');
    if (socket) {
      socket.disconnect();
    }
    addNotification('Logged out successfully', 'info');
  };

  const handleGroupSelect = (group) => {
    console.log('Group selected:', group);
    if (!group || !group._id) {
      addNotification('Invalid group selected', 'error');
      return;
    }
    setCurrentGroup(group);
    setCurrentView('group-chat');
    addNotification(`Joined ${group.name}`, 'success');
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setCurrentGroup(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Notifications */}
      {notifications.map(notif => (
        <div 
          key={notif.id} 
          className={`toast ${notif.type} transform transition-all duration-300 ease-in-out`}
          style={{
            top: `${20 + (notifications.indexOf(notif) * 80)}px`
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <i className={`fas ${
                notif.type === 'success' ? 'fa-check-circle' :
                notif.type === 'error' ? 'fa-exclamation-circle' :
                notif.type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'
              } mr-3`}></i>
              <span className="font-medium">{notif.message}</span>
            </div>
            <button 
              onClick={() => setNotifications(prev => prev.filter(n => n.id !== notif.id))}
              className="ml-4 text-white hover:text-gray-200 transition-colors"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
      ))}
      
      {/* Login View */}
      {currentView === 'login' && (
        <Login 
          onLogin={handleLogin} 
          onSwitchToRegister={() => setCurrentView('register')} 
        />
      )}
      
      {/* Register View */}
      {currentView === 'register' && (
        <Register 
          onRegister={handleLogin} 
          onSwitchToLogin={() => setCurrentView('login')} 
        />
      )}

      {/* Dashboard View */}
      {currentView === 'dashboard' && user && (
        <Dashboard 
          user={user} 
          onLogout={handleLogout}
          onGroupSelect={handleGroupSelect}
          token={token}
          addNotification={addNotification}
        />
      )}

      {/* Group Chat View */}
      {currentView === 'group-chat' && user && currentGroup && socket && (
        <GroupChat
          user={user}
          group={currentGroup}
          socket={socket}
          token={token}
          onBack={handleBackToDashboard}
          addNotification={addNotification}
        />
      )}

      {/* Error State - if something goes wrong */}
      {!loading && !user && currentView !== 'login' && currentView !== 'register' && (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg max-w-md">
              <i className="fas fa-exclamation-triangle text-2xl mb-3"></i>
              <h3 className="text-lg font-semibold mb-2">Session Error</h3>
              <p className="mb-4">There was an issue with your session. Please login again.</p>
              <button
                onClick={() => {
                  setCurrentView('login');
                  localStorage.removeItem('token');
                  setToken(null);
                }}
                className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition-colors"
              >
                Go to Login
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;