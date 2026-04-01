import React from 'react';
import { motion } from 'framer-motion';
import { Users, QrCode, Receipt, Menu } from 'lucide-react';

const Features: React.FC = () => {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <section id="features" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold text-gray-800 mb-4">Powerful Features</h2>
          <p className="text-xl text-gray-600">Everything you need to manage your mess efficiently</p>
        </motion.div>

        <motion.div 
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid md:grid-cols-2 lg:grid-cols-4 gap-8"
        >
          <motion.div variants={item} className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition">
            <div className="bg-blue-100 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Student Management</h3>
            <p className="text-gray-600">Complete student profiles, attendence logs, payment history and plan management</p>
          </motion.div>

          <motion.div variants={item} className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition">
            <div className="bg-green-100 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
              <QrCode className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Smart Attendance</h3>
            <p className="text-gray-600">QR code based high-speed automatic attendance tracking with real-time analytics</p>
          </motion.div>

          <motion.div variants={item} className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition">
            <div className="bg-yellow-100 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
              <Receipt className="h-8 w-8 text-yellow-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Billing & Payments</h3>
            <p className="text-gray-600">Automated billing with payment tracking and receipt generation</p>
          </motion.div>

          <motion.div variants={item} className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition">
            <div className="bg-red-100 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
              <Menu className="h-8 w-8 text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Menu Management</h3>
            <p className="text-gray-600">Daily menu planning and display for breakfast, lunch, and dinner</p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default Features;
