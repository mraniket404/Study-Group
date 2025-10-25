import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'https://study-group-j14u.onrender.com/api';

const Dashboard = ({ user, onLogout, onGroupSelect, token, addNotification }) => {
  const [groups, setGroups] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '' });
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      setRefreshing(true);
      
      const response = await axios.get(`${API_BASE}/groups/my-groups`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Groups fetched:', response.data);
      
      if (response.data.success) {
        setGroups(response.data.groups || []);
      } else {
        setGroups([]);
      }
      
    } catch (error) {
      console.error('Error fetching groups:', error);
      addNotification('Error loading groups', 'error');
      setGroups([]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE}/groups/create`, createForm, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Create group response:', response.data);
      
      if (response.data.success) {
        await fetchGroups();
        const newGroup = response.data.group;
        setShowCreateModal(false);
        setCreateForm({ name: '', description: '' });
        
        addNotification('Group created successfully!', 'success');
        
        setTimeout(() => {
          onGroupSelect(newGroup);
        }, 1000);
      } else {
        addNotification(response.data.message || 'Failed to create group', 'error');
      }
      
    } catch (error) {
      console.error('Create group error:', error);
      addNotification(error.response?.data?.message || 'Failed to create group', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGroup = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log('Attempting to join group with code:', joinCode);
      
      const response = await axios.post(`${API_BASE}/groups/join`, 
        { code: joinCode.toUpperCase().trim() },
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          } 
        }
      );
      
      console.log('Join group response:', response.data);
      
      if (response.data.success) {
        await fetchGroups();
        const joinedGroup = response.data.group;
        setShowJoinModal(false);
        setJoinCode('');
        
        addNotification(`Successfully joined ${joinedGroup.name}!`, 'success');
        
        setTimeout(() => {
          onGroupSelect(joinedGroup);
        }, 1000);
      } else {
        addNotification(response.data.message || 'Failed to join group', 'error');
      }
      
    } catch (error) {
      console.error('Error joining group:', error);
      const errorMessage = error.response?.data?.message || 'Failed to join group';
      addNotification(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGroupClick = (group) => {
    console.log('Group clicked:', group);
    onGroupSelect(group);
  };

  const handleRefreshGroups = () => {
    fetchGroups();
    addNotification('Groups refreshed', 'info');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-indigo-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="bg-white p-2 rounded-lg shadow-md">
              <i className="fas fa-graduation-cap text-2xl text-blue-600"></i>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Study Groups</h1>
              <p className="text-blue-100">Welcome, {user.name} ({user.role})</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={handleRefreshGroups}
              disabled={refreshing}
              className="bg-white text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50 disabled:opacity-50 flex items-center space-x-2 shadow-md transition-all duration-200 hover:shadow-lg"
            >
              <i className={`fas fa-sync ${refreshing ? 'animate-spin' : ''}`}></i>
              <span>Refresh</span>
            </button>
            <button
              onClick={onLogout}
              className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 flex items-center space-x-2 shadow-md transition-all duration-200 hover:shadow-lg"
            >
              <i className="fas fa-sign-out-alt"></i>
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Action Buttons */}
        <div className="mb-8 flex space-x-4">
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-lg hover:from-green-600 hover:to-emerald-700 flex items-center space-x-3 shadow-md transition-all duration-200 hover:shadow-lg"
          >
            <i className="fas fa-plus-circle text-xl"></i>
            <span className="font-medium">Create Group</span>
          </button>
          <button
            onClick={() => setShowJoinModal(true)}
            className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-3 rounded-lg hover:from-blue-600 hover:to-indigo-700 flex items-center space-x-3 shadow-md transition-all duration-200 hover:shadow-lg"
          >
            <i className="fas fa-user-plus text-xl"></i>
            <span className="font-medium">Join Group</span>
          </button>
        </div>

        {/* Groups Count */}
        <div className="mb-6 bg-white rounded-lg shadow-sm p-4 border border-blue-100">
          <div className="flex justify-between items-center">
            <p className="text-gray-700 font-medium">
              <i className="fas fa-layer-group text-blue-500 mr-2"></i>
              {groups.length} group(s) found
            </p>
            {refreshing && (
              <div className="flex items-center text-blue-500">
                <i className="fas fa-spinner animate-spin mr-2"></i>
                <span>Refreshing...</span>
              </div>
            )}
          </div>
        </div>

        {/* Groups Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => (
            <div
              key={group._id}
              className="bg-white rounded-xl shadow-md p-6 cursor-pointer hover:shadow-xl transition-all duration-300 border border-blue-100 hover:border-blue-300 group"
              onClick={() => handleGroupClick(group)}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-start space-x-3">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <i className="fas fa-users text-blue-600"></i>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 group-hover:text-blue-600 transition-colors">{group.name}</h3>
                    <div className="flex items-center mt-1">
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">
                        {group.members?.length || 0} members
                      </span>
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-2 rounded-lg">
                  <i className="fas fa-book-open text-sm"></i>
                </div>
              </div>
              
              <p className="text-gray-600 mb-5 line-clamp-2">{group.description}</p>
              
              <div className="flex justify-between items-center text-sm text-gray-500 mb-3">
                <div className="flex items-center space-x-2 bg-blue-50 px-3 py-1 rounded-full">
                  <i className="fas fa-key text-blue-500"></i>
                  <span className="font-mono font-bold text-blue-700">{group.code}</span>
                </div>
                <div className="flex items-center space-x-1 bg-amber-50 px-3 py-1 rounded-full">
                  <i className="fas fa-crown text-amber-500"></i>
                  <span className="text-amber-700">{group.mentor?.name}</span>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                <p className="text-xs text-gray-500">
                  <i className="fas fa-clock mr-1"></i>
                  Click to enter
                </p>
                <div className="text-blue-500 group-hover:text-blue-700 transition-colors">
                  <i className="fas fa-arrow-right"></i>
                </div>
              </div>
            </div>
          ))}
        </div>

        {groups.length === 0 && !refreshing && (
          <div className="text-center py-16 bg-white rounded-xl shadow-md border border-blue-100">
            <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="fas fa-users text-4xl text-blue-500"></i>
            </div>
            <h3 className="text-2xl font-bold text-gray-700 mb-3">No study groups yet</h3>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">Start your learning journey by creating a new study group or joining an existing one to collaborate with peers!</p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-lg hover:from-green-600 hover:to-emerald-700 flex items-center space-x-3 shadow-md transition-all duration-200 hover:shadow-lg"
              >
                <i className="fas fa-plus-circle"></i>
                <span>Create Your First Group</span>
              </button>
              <button
                onClick={() => setShowJoinModal(true)}
                className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-3 rounded-lg hover:from-blue-600 hover:to-indigo-700 flex items-center space-x-3 shadow-md transition-all duration-200 hover:shadow-lg"
              >
                <i className="fas fa-user-plus"></i>
                <span>Join a Group</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-blue-100">
            <div className="flex items-center mb-4">
              <div className="bg-green-100 p-2 rounded-lg mr-3">
                <i className="fas fa-plus-circle text-green-600 text-xl"></i>
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Create Study Group</h2>
            </div>
            
            <form onSubmit={handleCreateGroup}>
              <div className="mb-5">
                <label className="block text-gray-700 text-sm font-bold mb-3">
                  <i className="fas fa-pencil-alt text-blue-500 mr-2"></i>
                  Group Name *
                </label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({...createForm, name: e.target.value})}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Enter group name"
                />
              </div>

              <div className="mb-5">
                <label className="block text-gray-700 text-sm font-bold mb-3">
                  <i className="fas fa-align-left text-blue-500 mr-2"></i>
                  Description
                </label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm({...createForm, description: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  rows="3"
                  placeholder="What is this group about? What subjects will you study?"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-2.5 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !createForm.name.trim()}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-5 py-2.5 rounded-lg hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-all shadow-md hover:shadow-lg"
                >
                  {loading ? (
                    <>
                      <i className="fas fa-spinner animate-spin"></i>
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <i className="fas fa-plus-circle"></i>
                      <span>Create Group</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Group Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-blue-100">
            <div className="flex items-center mb-4">
              <div className="bg-blue-100 p-2 rounded-lg mr-3">
                <i className="fas fa-user-plus text-blue-600 text-xl"></i>
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Join Study Group</h2>
            </div>

            <form onSubmit={handleJoinGroup}>
              <div className="mb-5">
                <label className="block text-gray-700 text-sm font-bold mb-3">
                  <i className="fas fa-key text-blue-500 mr-2"></i>
                  Group Code *
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  required
                  placeholder="Enter 6-digit code"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all uppercase text-center text-lg font-mono tracking-wider font-bold"
                  maxLength="6"
                  pattern="[A-Z0-9]{6}"
                  title="Enter 6-character group code"
                />
                <p className="text-xs text-gray-500 mt-2 text-center">
                  <i className="fas fa-info-circle text-blue-500 mr-1"></i>
                  Enter the 6-character code provided by the group mentor
                </p>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="px-5 py-2.5 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !joinCode.trim()}
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-5 py-2.5 rounded-lg hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-all shadow-md hover:shadow-lg"
                >
                  {loading ? (
                    <>
                      <i className="fas fa-spinner animate-spin"></i>
                      <span>Joining...</span>
                    </>
                  ) : (
                    <>
                      <i className="fas fa-user-plus"></i>
                      <span>Join Group</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;