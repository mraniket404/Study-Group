import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import GroupChat from './components/GroupChat';

// ✅ FIXED: Use Render.com server directly
const API_BASE = 'https://study-group-j14u.onrender.com/api';
const SOCKET_URL = 'https://study-group-j14u.onrender.com';

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [currentView, setCurrentView] = useState('login');
  const [socket, setSocket] = useState(null);
  const [currentGroup, setCurrentGroup] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);

  // Add notification function
  const addNotification = (message, type = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(notif => notif.id !== id));
    }, 3000);
  };

  // ✅ FIXED: Better token verification
  const verifyToken = async (token) => {
    try {
      setLoading(true);
      console.log('🔐 Verifying token...');
      
      const response = await axios.get(`${API_BASE}/auth/me`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      console.log('✅ Token verification response:', response.data);
      
      if (response.data.success && response.data.user) {
        const userData = response.data.user;
        console.log('👤 User verified:', userData.name, userData.role);
        
        setUser(userData);
        setCurrentView('dashboard');
        addNotification(`Welcome back, ${userData.name}!`, 'success');
      } else {
        throw new Error('Invalid user data received');
      }
    } catch (error) {
      console.error('❌ Token verification failed:', error);
      
      // Clear all stored data
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
      setCurrentView('login');
      
      if (error.response?.status === 401) {
        addNotification('Session expired. Please login again.', 'error');
      } else {
        addNotification('Authentication failed. Please login again.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      verifyToken(token);
    } else {
      setCurrentView('login');
    }
  }, [token]);

  // ✅ FIXED: Better Socket initialization
  useEffect(() => {
    if (user && token) {
      console.log('🚀 Initializing socket connection for user:', user.name);
      
      // Cleanup old socket
      if (socket) {
        console.log('🧹 Cleaning up old socket');
        socket.disconnect();
        setSocket(null);
        setSocketConnected(false);
      }

      const newSocket = io(SOCKET_URL, {
        auth: {
          token: token
        },
        transports: ['websocket', 'polling'],
        timeout: 15000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000
      });
      
      // Socket connection events
      newSocket.on('connect', () => {
        console.log('🎉 ✅ ✅ SOCKET CONNECTED SUCCESSFULLY! ID:', newSocket.id);
        setSocketConnected(true);
        setSocket(newSocket);
        addNotification('Real-time connection established!', 'success');
      });

      newSocket.on('connect_error', (error) => {
        console.error('❌ Socket connection error:', error);
        setSocketConnected(false);
        addNotification('Real-time features unavailable. Using API mode.', 'warning');
      });

      newSocket.on('disconnect', (reason) => {
        console.log('🔌 Socket disconnected:', reason);
        setSocketConnected(false);
      });

      // Set socket immediately
      setSocket(newSocket);

      return () => {
        console.log('🧹 App cleanup: Socket disconnection');
        if (newSocket) {
          newSocket.disconnect();
        }
      };
    }
  }, [user, token]);

  const handleLogin = (userData, authToken) => {
    console.log('✅ Login successful:', userData);
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('token', authToken);
    setCurrentView('dashboard');
    addNotification(`Welcome back, ${userData.name}!`, 'success');
  };

  const handleLogout = () => {
    console.log('🔒 Logging out user:', user?.name);
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    setCurrentView('login');
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setSocketConnected(false);
    }
    addNotification('Logged out successfully', 'info');
  };

  const handleGroupSelect = (group) => {
    console.log('🎯 APP: Group selected:', group);
    console.log('🔍 APP: Group ID:', group?._id);
    console.log('👤 APP: User:', user?.name);
    console.log('🔌 APP: Socket Available:', socket ? 'Yes' : 'No');
    console.log('🔌 APP: Socket Connected:', socketConnected ? 'Yes' : 'No');
    
    if (!group || !group._id) {
      console.error('❌ APP: Invalid group received');
      addNotification('Invalid group selection', 'error');
      return;
    }
    
    setCurrentGroup(group);
    setCurrentView('group-chat');
    addNotification(`Joined ${group.name}`, 'success');
  };

  const handleBackToDashboard = () => {
    console.log('🔙 Going back to dashboard');
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
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map(notif => (
          <div 
            key={notif.id} 
            className={`p-4 rounded-lg shadow-lg text-white min-w-80 ${
              notif.type === 'success' ? 'bg-green-500' :
              notif.type === 'error' ? 'bg-red-500' :
              notif.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="font-medium">{notif.message}</span>
              </div>
              <button 
                onClick={() => setNotifications(prev => prev.filter(n => n.id !== notif.id))}
                className="ml-4 text-white hover:text-gray-200"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
      
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
          socketConnected={socketConnected}
        />
      )}

      {/* Group Chat View */}
      {currentView === 'group-chat' && user && currentGroup && (
        <GroupChat
          user={user}
          group={currentGroup}
          socket={socket}
          socketConnected={socketConnected}
          token={token}
          onBack={handleBackToDashboard}
          addNotification={addNotification}
        />
      )}

      {/* Error State */}
      {!loading && !user && currentView !== 'login' && currentView !== 'register' && (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg max-w-md">
              <h3 className="text-lg font-semibold mb-2">Session Error</h3>
              <p className="mb-4">Please login again.</p>
              <button
                onClick={() => {
                  setCurrentView('login');
                  localStorage.removeItem('token');
                  setToken(null);
                }}
                className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600"
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