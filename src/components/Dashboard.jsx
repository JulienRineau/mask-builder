import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listPuppets, checkMaskExists } from '../services/storageService.jsx';

function Dashboard() {
  const [puppets, setPuppets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPuppets = async () => {
      try {
        setLoading(true);
        const data = await listPuppets();
        
        // Fetch mask status for each puppet
        const puppetsWithStatus = await Promise.all(
          data.map(async (puppet) => {
            try {
              // Add cache-busting parameter for forced refresh
              const statusUrl = `/api/puppets/${puppet.id}/mask${refreshKey > 0 ? '?nocache=' + Date.now() : ''}`;
              const status = await fetch(statusUrl).then(res => res.json());
              return { ...puppet, maskStatus: status };
            } catch (err) {
              console.error(`Error fetching mask status for ${puppet.id}:`, err);
              return { ...puppet, maskStatus: { exists: false, error: err.message } };
            }
          })
        );
        
        setPuppets(puppetsWithStatus);
      } catch (err) {
        console.error('Error fetching puppets:', err);
        setError('Failed to load puppets. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchPuppets();
  }, [refreshKey]);

  const handleRefresh = () => {
    // Increment refreshKey to force re-fetch with cache busting
    setRefreshKey(prev => prev + 1);
  };

  const handlePuppetSelect = (puppetId) => {
    navigate(`/editor/${puppetId}`);
  };

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    navigate('/login');
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Mask Builder Dashboard</h1>
        <button
          onClick={handleRefresh}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
        >
          Refresh Mask Status
        </button>
        <button
          onClick={handleLogout}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
        >
          Logout
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {puppets.map((puppet) => (
            <div
              key={puppet.id}
              className="bg-white shadow-md rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => handlePuppetSelect(puppet.id)}
            >
              <div className="p-4">
                <h2 className="text-lg font-semibold mb-2">{puppet.id}</h2>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-gray-600">Mask Status:</p>
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                        puppet.maskStatus && puppet.maskStatus.exists
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {puppet.maskStatus && puppet.maskStatus.exists ? 'Available' : 'Not Created'}
                    </span>
                  </div>
                  <button
                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePuppetSelect(puppet.id);
                    }}
                  >
                    Edit Mask
                  </button>
                </div>
                {puppet.maskStatus && puppet.maskStatus.exists && puppet.maskStatus.createdAt && (
                  <p className="text-gray-500 text-sm mt-2">
                    Created: {new Date(puppet.maskStatus.createdAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Dashboard; 