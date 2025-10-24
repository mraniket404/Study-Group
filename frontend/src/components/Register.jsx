import React, { useState } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

const Register = ({ onRegister, onSwitchToLogin }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await axios.post(`${API_BASE}/auth/register`, formData);
      onRegister(response.data.user, response.data.token);
    } catch (error) {
      setError(error.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center relative overflow-hidden"
      style={{
        backgroundImage:
          "url('https://i.pinimg.com/originals/d2/2a/29/d22a298b92898a91d92b7e08610c3b4c.jpg')",
      }}
    >
      {/* Floating shimmer & particles */}
      <div className="anime-bg"></div>
      {[...Array(25)].map((_, i) => (
        <div
          key={i}
          className="anime-particle"
          style={{
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 10}s`,
          }}
        />
      ))}

      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-0"></div>

      <div className="relative z-10 max-w-md w-full space-y-8 bg-white/10 p-10 rounded-2xl shadow-2xl backdrop-blur-lg border border-white/20 animate-fade-in">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white drop-shadow-lg">
            Join the Study Squad 📚
          </h2>
          <p className="mt-2 text-center text-sm text-gray-300">
            Or{' '}
            <button
              onClick={onSwitchToLogin}
              className="font-medium text-pink-400 hover:text-pink-300 transition-colors"
            >
              sign in to existing account
            </button>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="Full Name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-400 rounded-md bg-white/80 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-pink-400"
            />
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="Email address"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-400 rounded-md bg-white/80 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-pink-400"
            />
            <input
              id="password"
              name="password"
              type="password"
              required
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-400 rounded-md bg-white/80 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-pink-400"
            />
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-400 rounded-md bg-white/80 text-gray-900 focus:ring-2 focus:ring-pink-400"
            >
              <option value="student">Student</option>
              <option value="mentor">Mentor</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 text-sm font-semibold rounded-md text-white bg-gradient-to-r from-pink-500 to-purple-600 hover:from-purple-600 hover:to-pink-500 focus:ring-2 focus:ring-pink-300 transition-all duration-200 shadow-lg shadow-pink-500/30 disabled:opacity-50"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Register;
