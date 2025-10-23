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
      console.log('✅ Token verified, user:', response.data.user);
    } catch (error) {
      console.error('❌ Token verification failed:', error);
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

  // ✅ FIXED: Socket initialization
  useEffect(() => {
    if (user && user._id) { // ✅ Use user._id instead of user.id
      console.log('🚀 Initializing socket connection for user:', user._id);
      
      // Purana socket cleanup
      if (socket) {
        console.log('🧹 Cleaning up old socket');
        socket.disconnect();
        setSocket(null);
      }

      const newSocket = io('http://localhost:5000', {
        transports: ['websocket', 'polling'],
        timeout: 15000, // Increased timeout
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000
      });
      
      // Socket connection events
      newSocket.on('connect', () => {
        console.log('🎉 ✅ ✅ SOCKET CONNECTED SUCCESSFULLY! ID:', newSocket.id);
        setSocket(newSocket);
        addNotification('Real-time connection established!', 'success');
      });

      newSocket.on('connect_error', (error) => {
        console.error('❌ Socket connection error:', error);
        console.log('🔧 Error details:', error.message);
        addNotification('Real-time features unavailable', 'warning');
        
        // Fallback: Set socket anyway
        setSocket(newSocket);
      });

      newSocket.on('disconnect', (reason) => {
        console.log('🔌 Socket disconnected:', reason);
        if (reason === 'io server disconnect') {
          // Server disconnected, try to reconnect
          newSocket.connect();
        }
      });

      // Set socket immediately
      setSocket(newSocket);

      // Test connection after 1 second
      setTimeout(() => {
        if (!newSocket.connected) {
          console.log('⏰ Socket still not connected after 1 second');
          console.log('Socket status:', {
            connected: newSocket.connected,
            id: newSocket.id
          });
        }
      }, 1000);

      return () => {
        console.log('🧹 App cleanup: Socket disconnection');
        if (newSocket.connected) {
          newSocket.disconnect();
        }
      };
    }
  }, [user]); // ✅ Only depend on user

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
    }
    addNotification('Logged out successfully', 'info');
  };

  const handleGroupSelect = (group) => {
    console.log('🎯 APP: Group selected:', group);
    console.log('🔍 APP: Group ID:', group?._id);
    console.log('👤 APP: User:', user?.name);
    console.log('🔌 APP: Socket:', socket ? 'Available' : 'Missing');
    console.log('🔌 APP: Socket Connected:', socket?.connected ? 'Yes' : 'No');
    
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
        />
      )}

      {/* Group Chat View */}
      {currentView === 'group-chat' && user && currentGroup && (
        <GroupChat
          user={user}
          group={currentGroup}
          socket={socket}
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