import React, { useState } from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL;

const Login = ({ onLogin, onSwitchToRegister }) => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await axios.post(`${API_BASE}/auth/login`, formData);
      onLogin(response.data.user, response.data.token);
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-black/40 via-purple-900/30 to-blue-800/40 backdrop-blur-sm"></div>

      <div className="relative z-10 max-w-md w-full p-10 rounded-3xl bg-white/10 backdrop-blur-lg border border-white/30 shadow-lg">
        <h2 className="text-3xl font-bold text-white text-center mb-4">
          Welcome Back 👋
        </h2>
        <p className="text-center text-gray-300 text-sm mb-6">
          Don't have an account?{" "}
          <button
            onClick={onSwitchToRegister}
            className="text-pink-400 hover:text-pink-300 font-semibold transition"
          >
            Sign Up
          </button>
        </p>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded mb-3">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            name="email"
            type="email"
            placeholder="Email Address"
            value={formData.email}
            onChange={handleChange}
            className="w-full px-4 py-2 rounded-lg bg-white/30 text-white placeholder-gray-200 focus:ring-2 focus:ring-pink-500 outline-none"
            required
          />
          <input
            name="password"
            type="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            className="w-full px-4 py-2 rounded-lg bg-white/30 text-white placeholder-gray-200 focus:ring-2 focus:ring-pink-500 outline-none"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 text-white font-semibold bg-gradient-to-r from-pink-500 via-purple-600 to-blue-600 rounded-lg hover:opacity-90 transition"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
