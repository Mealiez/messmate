import React from 'react';
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

const Pricing: React.FC = () => {
  return (
    <section id="pricing" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold text-gray-800 mb-4">Simple Pricing</h2>
          <p className="text-xl text-gray-600">Choose the plan that's right for your mess. No hidden fees.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
          
          {/* Free Plan */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white border-2 border-gray-200 rounded-xl p-8 hover:border-gray-400 transition flex flex-col"
          >
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Free Plan</h3>
            <div className="mb-6">
              <span className="text-4xl font-bold text-gray-800">₹0</span>
              <span className="text-gray-600">/forever</span>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              <li className="flex items-center text-gray-700"><Check className="h-5 w-5 text-green-500 mr-2" /> List on Marketplace</li>
              <li className="flex items-center text-gray-700"><Check className="h-5 w-5 text-green-500 mr-2" /> Basic Mess Info Page</li>
              <li className="flex items-center text-gray-700"><Check className="h-5 w-5 text-green-500 mr-2" /> Update or Add plans</li>
              <li className="flex items-center text-gray-400"><X className="h-5 w-5 mr-2" /> No Student Management</li>
              <li className="flex items-center text-gray-400"><X className="h-5 w-5 mr-2" /> No Attendance Tracking</li>
            </ul>
            <a href="/register.html" className="block text-center bg-gray-100 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition">
              Get Started
            </a>
          </motion.div>

          {/* Starter Plan */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="bg-white border-2 border-gray-200 rounded-xl p-8 hover:border-blue-500 transition flex flex-col"
          >
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Starter Plan</h3>
            <div className="mb-6">
              <span className="text-4xl font-bold text-gray-800">₹499</span>
              <span className="text-gray-600">/month</span>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              <li className="flex items-center text-gray-700"><Check className="h-5 w-5 text-green-500 mr-2" /> List on Marketplace</li>
              <li className="flex items-center text-gray-700"><Check className="h-5 w-5 text-green-500 mr-2" /> Up to 50 Students</li>
              <li className="flex items-center text-gray-700"><Check className="h-5 w-5 text-green-500 mr-2" /> QR Attendance System</li>
              <li className="flex items-center text-gray-700"><Check className="h-5 w-5 text-green-500 mr-2" /> Menu Management</li>
              <li className="flex items-center text-gray-700"><Check className="h-5 w-5 text-green-500 mr-2" /> Student Management</li>
            </ul>
            <a href="/register.html" className="block text-center bg-gray-200 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition">
              Choose Starter
            </a>
          </motion.div>

          {/* Pro Plan */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-xl p-8 shadow-xl md:scale-105 flex flex-col"
          >
            <div className="bg-yellow-400 text-blue-900 text-xs font-bold px-3 py-1 rounded-full inline-block mb-4 w-max">
              MOST POPULAR
            </div>
            <h3 className="text-2xl font-bold mb-2">Pro Plan</h3>
            <div className="mb-6">
              <span className="text-4xl font-bold">₹799</span>
              <span className="text-blue-200">/month</span>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              <li className="flex items-center"><Check className="h-5 w-5 text-yellow-300 mr-2" /> Everything in Starter</li>
              <li className="flex items-center"><Check className="h-5 w-5 text-yellow-300 mr-2" /> Up to 100 Students</li>
              <li className="flex items-center"><Check className="h-5 w-5 text-yellow-300 mr-2" /> Full Payment Management</li>
              <li className="flex items-center"><Check className="h-5 w-5 text-yellow-300 mr-2" /> Advanced Analytics</li>
              <li className="flex items-center"><Check className="h-5 w-5 text-yellow-300 mr-2" /> On-site Setup & Training</li>  
            </ul>
            <a href="/register.html" className="block text-center bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition">
              Choose Pro
            </a>
          </motion.div>

        </div>
      </div>
    </section>
  );
};

export default Pricing;
