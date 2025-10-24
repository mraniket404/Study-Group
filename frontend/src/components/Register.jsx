import React, { useState } from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL;

const Register = ({ onRegister, onSwitchToLogin }) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "student",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await axios.post(`${API_BASE}/auth/register`, formData);

      // Show success message
      setSuccess("Account created successfully! Logging in...");

      // Automatic login
      onRegister(response.data.user, response.data.token);
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-black/40 via-pink-900/30 to-purple-700/40 backdrop-blur-sm"></div>

      <div className="relative z-10 max-w-md w-full p-10 rounded-3xl bg-white/10 backdrop-blur-lg border border-white/30 shadow-lg">
        <h2 className="text-3xl font-bold text-white text-center mb-4">
          Join  Squad 📚
        </h2>
        <p className="text-center text-gray-300 text-sm mb-6">
          Already have an account?{" "}
          <button
            onClick={onSwitchToLogin}
            className="text-blue-400 hover:text-blue-300 font-semibold transition"
          >
            Sign In
          </button>
        </p>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded mb-3">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-3 py-2 rounded mb-3">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            name="name"
            type="text"
            placeholder="Full Name"
            value={formData.name}
            onChange={handleChange}
            className="w-full px-4 py-2 rounded-lg bg-white/30 text-white placeholder-gray-200 focus:ring-2 focus:ring-pink-500 outline-none"
            required
          />
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
          <select
            name="role"
            value={formData.role}
            onChange={handleChange}
            className="w-full px-4 py-2 rounded-lg bg-white/30 text-black focus:ring-2 focus:ring-pink-500 outline-none"
          >
            <option value="student">Student</option>
            <option value="mentor">Mentor</option>
          </select>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 text-white font-semibold bg-gradient-to-r from-pink-500 via-purple-600 to-blue-600 rounded-lg hover:opacity-90 transition"
          >
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Register;
