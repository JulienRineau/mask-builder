import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listPuppets, checkMaskExists } from '../services/storageService';

function Dashboard() {
  const [puppets, setPuppets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPuppets = async () => {
      try {
        setLoading(true);
        const puppetList = await listPuppets();
        
        // Check mask status for each puppet
        const puppetsWithStatus = await Promise.all(
          puppetList.map(async (puppet) => {
            const maskStatus = await checkMaskExists(puppet.id);
            return {
              ...puppet,
              hasMask: maskStatus.exists,
              maskCreatedAt: maskStatus.createdAt,
            };
          })
        );
        
        setPuppets(puppetsWithStatus);
        setLoading(false);
      } catch (err) {
        setError('Failed to load puppets. Please try again later.');
        setLoading(false);
        console.error('Error fetching puppets:', err);
      }
    };

    fetchPuppets();
  }, []);

  const handlePuppetSelect = (puppetId) => {
    navigate(`/editor/${puppetId}`);
  };

  const handleLogout = () => {
    localStorage.removeItem('googleToken');
    navigate('/login');
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Mask Builder Dashboard</h1>
        <button
          onClick={handleLogout}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
        >
          Logout
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900"></div>
        </div>
      ) : error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Puppet ID
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mask Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created Date
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {puppets.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500">
                    No puppets found
                  </td>
                </tr>
              ) : (
                puppets.map((puppet) => (
                  <tr key={puppet.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {puppet.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {puppet.hasMask ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          Available
                        </span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          Not Available
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {puppet.maskCreatedAt ? new Date(puppet.maskCreatedAt).toLocaleString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handlePuppetSelect(puppet.id)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        {puppet.hasMask ? 'Edit Mask' : 'Create Mask'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Dashboard; 