import React, { useState } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

const Login = ({ onLogin, onSwitchToRegister }) => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await axios.post(`${API_BASE}/auth/login`, formData);
      onLogin(response.data.user, response.data.token);
    } catch (error) {
      setError(error.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center relative overflow-hidden"
      style={{
        backgroundImage:
          "url('https://i.pinimg.com/originals/14/50/26/145026cf2e5423c8f2c0c344a68d3d25.jpg')",
      }}
    >
      {/* Anime shimmer and particles */}
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
            Welcome Back 👋
          </h2>
          <p className="mt-2 text-center text-sm text-gray-300">
            Continue your study journey or{' '}
            <button
              onClick={onSwitchToRegister}
              className="font-medium text-blue-400 hover:text-blue-300 transition-colors"
            >
              create a new account
            </button>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          <div className="rounded-md shadow-sm -space-y-px">
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="Email address"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-400 placeholder-gray-500 text-gray-900 rounded-t-md focus:ring-2 focus:ring-blue-400 bg-white/80"
            />
            <input
              id="password"
              name="password"
              type="password"
              required
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-400 placeholder-gray-500 text-gray-900 rounded-b-md focus:ring-2 focus:ring-blue-400 bg-white/80"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 text-sm font-semibold rounded-md text-white bg-gradient-to-r from-blue-500 to-purple-600 hover:from-purple-600 hover:to-blue-500 focus:ring-2 focus:ring-blue-300 transition-all duration-200 shadow-lg shadow-purple-500/30 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
