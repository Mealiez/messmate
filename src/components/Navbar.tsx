import React, { useState } from 'react';
import { Menu, X, Rocket } from 'lucide-react';

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="bg-white shadow-lg fixed w-full top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <img src="/assets/logo.png" alt="Mealiez Logo" className="h-8 w-8" />
            <span className="ml-2 text-xl font-bold text-orange-600">Mealiez</span>
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            <a href="/index.html" className="text-gray-700 hover:text-blue-600 transition">Home</a>
            <a href="#features" className="text-gray-700 hover:text-blue-600 transition">Features</a>
            <a href="#pricing" className="text-gray-700 hover:text-blue-600 transition">Pricing</a>
            <a href="#browse" className="text-gray-700 hover:text-blue-600 transition">Browse</a>
            <a href="/internship.html" className="text-orange-600 font-bold hover:text-orange-700 transition flex items-center">
              <Rocket className="w-4 h-4 mr-1" />
              Internships
            </a>
            <a href="/login.html" className="text-gray-700 hover:text-blue-600 transition">Login</a>
            <a href="/register.html" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition">Register</a>
          </div>

          <div className="md:hidden flex items-center">
            <button 
              onClick={() => setIsOpen(!isOpen)} 
              className="text-gray-700 hover:text-gray-900 focus:outline-none"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden bg-white border-t px-4 py-2 space-y-2">
          <a href="/index.html" className="block text-gray-700 hover:bg-gray-100 rounded p-2">Home</a>
          <a href="#features" className="block text-gray-700 hover:bg-gray-100 rounded p-2">Features</a>
          <a href="#pricing" className="block text-gray-700 hover:bg-gray-100 rounded p-2">Pricing</a>
          <a href="#browse" className="block text-gray-700 hover:bg-gray-100 rounded p-2">Browse</a>
          <a href="/internship.html" className="block text-orange-600 font-bold hover:bg-gray-100 rounded p-2">Internships 🚀</a>
          <a href="/login.html" className="block text-gray-700 hover:bg-gray-100 rounded p-2">Login</a>
          <a href="/register.html" className="block bg-blue-600 text-white text-center rounded p-2 hover:bg-blue-700">Register</a>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
