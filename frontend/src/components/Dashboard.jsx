import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

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
      const response = await axios.get(`${API_BASE}/groups/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Groups fetched:', response.data);
      setGroups(response.data);
    } catch (error) {
      console.error('Error fetching groups:', error);
      addNotification('Error loading groups', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE}/groups/create`, createForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Groups refresh karo aur automatically group me redirect karo
      await fetchGroups();
      
      // Newly created group me automatically redirect karo
      const newGroup = response.data.group;
      setShowCreateModal(false);
      setCreateForm({ name: '', description: '' });
      
      addNotification('Group created successfully!', 'success');
      
      // 1 second baad automatically group me redirect karo
      setTimeout(() => {
        onGroupSelect(newGroup);
      }, 1000);
      
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
      
      // Groups refresh karo
      await fetchGroups();
      
      // Joined group me automatically redirect karo
      const joinedGroup = response.data.group;
      setShowJoinModal(false);
      setJoinCode('');
      
      addNotification(`Successfully joined ${joinedGroup.name}!`, 'success');
      
      // 1 second baad automatically group me redirect karo
      setTimeout(() => {
        onGroupSelect(joinedGroup);
      }, 1000);
      
    } catch (error) {
      console.error('Error joining group:', error);
      console.log('Error response:', error.response);
      
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
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Study Groups</h1>
            <p className="text-gray-600">Welcome, {user.name} ({user.role})</p>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={handleRefreshGroups}
              disabled={refreshing}
              className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 disabled:opacity-50 flex items-center space-x-2"
            >
              <i className={`fas fa-sync ${refreshing ? 'animate-spin' : ''}`}></i>
              <span>Refresh</span>
            </button>
            <button
              onClick={onLogout}
              className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 flex items-center space-x-2"
            >
              <i className="fas fa-sign-out-alt"></i>
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Action Buttons */}
        <div className="mb-6 flex space-x-4">
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 flex items-center space-x-2"
          >
            <i className="fas fa-plus"></i>
            <span>Create Group</span>
          </button>
          <button
            onClick={() => setShowJoinModal(true)}
            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 flex items-center space-x-2"
          >
            <i className="fas fa-user-plus"></i>
            <span>Join Group</span>
          </button>
        </div>

        {/* Groups Count */}
        <div className="mb-4">
          <p className="text-gray-600">
            {groups.length} group(s) found
            {refreshing && <span className="ml-2 text-blue-500">Refreshing...</span>}
          </p>
        </div>

        {/* Groups Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => (
            <div
              key={group._id}
              className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow duration-200 border-2 border-transparent hover:border-blue-300"
              onClick={() => handleGroupClick(group)}
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-xl font-semibold text-gray-800">{group.name}</h3>
                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                  {group.members?.length || 0} members
                </span>
              </div>
              
              <p className="text-gray-600 mb-4 line-clamp-2">{group.description}</p>
              
              <div className="flex justify-between items-center text-sm text-gray-500">
                <div className="flex items-center space-x-2">
                  <i className="fas fa-key"></i>
                  <span>Code: <strong>{group.code}</strong></span>
                </div>
                <div className="flex items-center space-x-1">
                  <i className="fas fa-crown text-yellow-500"></i>
                  <span>{group.mentor?.name}</span>
                </div>
              </div>
              
              {/* Last active info */}
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400">
                  <i className="fas fa-users mr-1"></i>
                  {group.members?.length || 0} members • Click to enter
                </p>
              </div>
            </div>
          ))}
        </div>

        {groups.length === 0 && !refreshing && (
          <div className="text-center py-12 bg-white rounded-lg shadow-md">
            <i className="fas fa-users text-6xl text-gray-300 mb-4"></i>
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No groups yet</h3>
            <p className="text-gray-500 mb-6">Create a new group or join an existing one to get started!</p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 flex items-center space-x-2"
              >
                <i className="fas fa-plus"></i>
                <span>Create Your First Group</span>
              </button>
              <button
                onClick={() => setShowJoinModal(true)}
                className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 flex items-center space-x-2"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create Study Group</h2>
            
            <form onSubmit={handleCreateGroup}>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Group Name *
                </label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({...createForm, name: e.target.value})}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter group name"
                />
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Description
                </label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm({...createForm, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  placeholder="What is this group about?"
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !createForm.name.trim()}
                  className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {loading ? (
                    <>
                      <i className="fas fa-spinner animate-spin"></i>
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <i className="fas fa-plus"></i>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Join Study Group</h2>

            <form onSubmit={handleJoinGroup}>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Group Code *
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  required
                  placeholder="Enter 6-digit code"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase text-center text-lg font-mono tracking-wider"
                  maxLength="6"
                  pattern="[A-Z0-9]{6}"
                  title="Enter 6-character group code"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter the 6-character code provided by the group mentor
                </p>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !joinCode.trim()}
                  className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
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