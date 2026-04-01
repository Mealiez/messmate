import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-900 text-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center mb-4">
              <img src="/assets/logo.png" alt="Mealiez Logo" className="h-8 w-8" />
              <span className="ml-2 text-xl font-bold">Mealiez</span>
            </div>
            <p className="text-gray-400">Revolutionizing mess management with smart technology</p>
          </div>
          
          <div>
            <h4 className="font-bold mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li><a href="/index.html" className="text-gray-400 hover:text-white transition">Home</a></li>
              <li><a href="#features" className="text-gray-400 hover:text-white transition">Features</a></li>
              <li><a href="#pricing" className="text-gray-400 hover:text-white transition">Pricing</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold mb-4">Account</h4>
            <ul className="space-y-2">
              <li><a href="/login.html" className="text-gray-400 hover:text-white transition">Login</a></li>
              <li><a href="/register.html" className="text-gray-400 hover:text-white transition">Register</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold mb-4">Contact</h4>
            <ul className="space-y-2">
              <li className="text-gray-400">Email: Mealiez.customercare@gmail.com</li>
              <li className="text-gray-400">Phone: +91 9270398199</li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
          <p>&copy; Designed & Developed By <a href="https://www.instagram.com/harsh_potdar23" target="_blank" rel="noopener noreferrer" className="font-bold hover:text-white transition">Harsh Potdar</a></p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
