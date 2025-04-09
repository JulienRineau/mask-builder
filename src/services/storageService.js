// Mock Storage Service for Browser Environment
// In production, these calls would go to a backend API that interfaces with Google Cloud Storage

// API service for accessing Google Cloud Storage through the backend
const API_URL = '/api'; // This will be proxied to http://localhost:3001/api
const BUCKET_NAME = 'zeroshot-database-prod-puppet-calibration';

// Helper function to make API requests with auth
const apiRequest = async (endpoint, options = {}) => {
  const isAuthenticated = localStorage.getItem('isAuthenticated');
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...(isAuthenticated ? { 'Authorization': `Bearer ${isAuthenticated}` } : {}),
    },
  };
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...defaultOptions,
    ...options,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'API request failed');
  }
  
  return response.json();
};

// List puppets in the bucket
export const listPuppets = async () => {
  try {
    return await apiRequest('/puppets');
  } catch (error) {
    console.error('Error listing puppets:', error);
    // Fallback to mock data if API is not available
    return getMockPuppets();
  }
};

// Check if mask exists for a puppet
export const checkMaskExists = async (puppetId) => {
  try {
    return await apiRequest(`/puppets/${puppetId}/mask`);
  } catch (error) {
    console.error(`Error checking mask for puppet ${puppetId}:`, error);
    // Fallback to mock data
    return getMockMaskStatus(puppetId);
  }
};

// Get video frame from earliest timestamp folder
export const getVideoFrame = async (puppetId) => {
  try {
    return await apiRequest(`/puppets/${puppetId}/frame`);
  } catch (error) {
    console.error(`Error getting video frame for puppet ${puppetId}:`, error);
    // Fallback to mock data
    return getMockVideoFrame(puppetId);
  }
};

// Upload mask to storage
export const uploadMask = async (puppetId, maskData) => {
  try {
    return await apiRequest(`/puppets/${puppetId}/mask`, {
      method: 'POST',
      body: JSON.stringify({ 
        maskData,
        bucketName: BUCKET_NAME 
      }),
    });
  } catch (error) {
    console.error(`Error uploading mask for puppet ${puppetId}:`, error);
    // Fallback to mock upload response
    return getMockUploadResponse(puppetId);
  }
};

// Mock data functions for fallback
const getMockPuppets = () => {
  const mockPuppets = [
    { id: 'puppet001', name: 'puppet001' },
    { id: 'puppet002', name: 'puppet002' },
    { id: 'puppet003', name: 'puppet003' },
    { id: 'puppet004', name: 'puppet004' },
  ];
  
  console.warn('Using mock puppet data - API not available');
  return mockPuppets;
};

const getMockMaskStatus = (puppetId) => {
  const mockData = {
    'puppet001': { exists: true, createdAt: new Date(2023, 5, 15).toISOString() },
    'puppet002': { exists: false },
    'puppet003': { exists: true, createdAt: new Date(2023, 8, 22).toISOString() },
    'puppet004': { exists: false },
  };
  
  console.warn(`Using mock mask status for ${puppetId} - API not available`);
  return mockData[puppetId] || { exists: false };
};

const getMockVideoFrame = (puppetId) => {
  console.warn(`Using mock video frame for ${puppetId} - API not available`);
  return {
    frameUrl: 'https://picsum.photos/800/600',
    videoPath: `${puppetId}/camera/1234567890/camera_video.mp4`,
  };
};

const getMockUploadResponse = (puppetId) => {
  console.warn(`Using mock upload response for ${puppetId} - API not available`);
  return {
    success: true,
    url: `https://storage.googleapis.com/${BUCKET_NAME}/${puppetId}/camera/mask.png`,
  };
}; 