import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const Browse: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [location, setLocation] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [messes, setMesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // In a full implementation, we would query the database here.
  // For the initial UI migration, we just set up the structure.
  
  return (
    <section id="browse" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl font-bold text-gray-800 mb-4">Find Your Perfect Mess</h2>
          <p className="text-xl text-gray-600">Search for messes near your college. Your next favorite meal is just a click away.</p>
        </motion.div>

        {/* Filters */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-lg shadow p-6 mb-8 grid grid-cols-1 md:grid-cols-3 gap-4 items-end"
        >
          <div>
            <label htmlFor="searchCollege" className="block text-sm font-medium text-gray-700">Nearby College</label>
            <input 
              type="text" 
              id="searchCollege" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Enter college name" 
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" 
            />
          </div>
          <div>
            <label htmlFor="searchLocation" className="block text-sm font-medium text-gray-700">Location Keyword</label>
            <input 
              type="text" 
              id="searchLocation" 
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Station Road, Downtown" 
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" 
            />
          </div>
          <div>
            <label htmlFor="maxPrice" className="block text-sm font-medium text-gray-700">Max Plan Price (₹)</label>
            <input 
              type="number" 
              id="maxPrice" 
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="e.g., 2000" 
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" 
            />
          </div>
        </motion.div>

        {/* Mess Listings Container */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {loading ? (
            <p className="text-center text-gray-500 col-span-full">Loading messes...</p>
          ) : messes.length > 0 ? (
            messes.map((mess, idx) => (
              <div key={idx} className="bg-white p-6 rounded-lg shadow">
                 <h3 className="text-xl font-bold">{mess.name}</h3>
              </div>
            ))
          ) : (
             <p className="text-center text-gray-500 col-span-full py-8">Use the filters above to search for messes.</p>
          )}
        </div>
      </div>
    </section>
  );
};

export default Browse;
