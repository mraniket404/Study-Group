import React, { useState } from "react";
import axios from "axios";

const API_BASE = "http://localhost:5000/api";

const Register = ({ onRegister, onSwitchToLogin }) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "student",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await axios.post(`${API_BASE}/auth/register`, formData);
      onRegister(response.data.user, response.data.token);
    } catch (error) {
      setError(error.response?.data?.message || "Registration failed");
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
      {/* Overlay for glow effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/40 via-pink-900/30 to-purple-700/40 backdrop-blur-sm"></div>

      {/* Floating Particles */}
      {[...Array(25)].map((_, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 bg-gradient-to-r from-purple-400 to-pink-500 rounded-full opacity-70 animate-ping"
          style={{
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            animationDuration: `${2 + Math.random() * 4}s`,
          }}
        />
      ))}

      {/* Register Card */}
      <div className="relative z-10 max-w-md w-full p-10 rounded-3xl bg-white/10 backdrop-blur-lg border border-white/30 shadow-[0_0_60px_rgba(236,72,153,0.4)] animate-fade-in">
        <h2 className="text-4xl font-extrabold text-white text-center mb-3 tracking-wide drop-shadow-[0_0_15px_#EC4899]">
          Join the Squad 📚
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

        <form onSubmit={handleSubmit} className="space-y-5">
          <input
            name="name"
            type="text"
            placeholder="Full Name"
            value={formData.name}
            onChange={handleChange}
            className="w-full px-4 py-3 rounded-lg bg-white/30 text-white placeholder-gray-200 focus:ring-2 focus:ring-pink-500 outline-none"
          />
          <input
            name="email"
            type="email"
            placeholder="Email Address"
            value={formData.email}
            onChange={handleChange}
            className="w-full px-4 py-3 rounded-lg bg-white/30 text-white placeholder-gray-200 focus:ring-2 focus:ring-pink-500 outline-none"
          />
          <input
            name="password"
            type="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            className="w-full px-4 py-3 rounded-lg bg-white/30 text-white placeholder-gray-200 focus:ring-2 focus:ring-pink-500 outline-none"
          />
          <select
            name="role"
            value={formData.role}
            onChange={handleChange}
            className="w-full px-4 py-3 rounded-lg bg-ring-pink-500 text-black placeholder-gray-200 focus:ring-2 focus:ring-pink-500 outline-none"
          >
            <option value="student">Student</option>
            <option value="mentor">Mentor</option>
          </select>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 text-lg font-semibold text-white bg-gradient-to-r from-pink-500 via-purple-600 to-blue-600 rounded-lg shadow-lg hover:opacity-90 transition-all duration-300"
          >
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Register;
