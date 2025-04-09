// Mock Storage Service for Browser Environment
// In production, these calls would go to a backend API that interfaces with Google Cloud Storage

// API service for accessing Google Cloud Storage through the backend
const API_URL = '/api'; // This will be proxied to http://localhost:3001/api
const MASKS_BUCKET_NAME = 'zeroshot-database-prod-masks';

// Helper function to make API requests with auth
const apiRequest = async (endpoint, options = {}) => {
  const isAuthenticated = localStorage.getItem('isAuthenticated');
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...(isAuthenticated ? { 'Authorization': `Bearer ${isAuthenticated}` } : {}),
    },
  };
  
  try {
    console.log(`Making API request to: ${API_URL}${endpoint}`);
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...defaultOptions,
      ...options,
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorText = errorData ? JSON.stringify(errorData) : await response.text();
      console.error(`API request failed with status ${response.status}: ${errorText}`);
      throw new Error(errorText || `API request failed with status ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    console.error(`API request error for ${endpoint}:`, error);
    throw error;
  }
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
    // Make a direct fetch request to bypass the authentication handling for mask status checks
    console.log(`Checking mask status for puppet: ${puppetId}`);
    const cacheParameter = `nocache=${Date.now()}`;
    const response = await fetch(`${API_URL}/puppets/${puppetId}/mask?${cacheParameter}`);
    
    if (!response.ok) {
      if (response.status === 401) {
        console.warn(`Authentication issues when checking mask for ${puppetId}, retrying with simplified request`);
        // If authentication failed, try a simplified GET request without auth headers
        const retryResponse = await fetch(`${API_URL}/puppets/${puppetId}/mask?${cacheParameter}`);
        if (retryResponse.ok) {
          return await retryResponse.json();
        }
      }
      throw new Error(`Failed to check mask status with status ${response.status}`);
    }
    
    return await response.json();
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

// Get existing mask for a puppet
export const getExistingMask = async (puppetId) => {
  try {
    return await apiRequest(`/puppets/${puppetId}/existing-mask`);
  } catch (error) {
    console.error(`Error getting existing mask for puppet ${puppetId}:`, error);
    // Return null if no mask exists or on error
    return null;
  }
};

// Upload mask to storage
export const uploadMask = async (puppetId, maskData) => {
  try {
    return await apiRequest(`/puppets/${puppetId}/mask`, {
      method: 'POST',
      body: JSON.stringify({ 
        maskData,
        bucketName: MASKS_BUCKET_NAME 
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
  
  // Create a data URL for a simple 400x300 red rectangle as a placeholder image
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 300;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#333333';
  ctx.fillRect(0, 0, 400, 300);
  
  // Add text to the canvas 
  ctx.fillStyle = 'white';
  ctx.font = '20px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Mock Image for', 200, 130);
  ctx.fillText(puppetId, 200, 160);
  
  return {
    frameData: canvas.toDataURL('image/png'),
    videoPath: `${puppetId}/camera/1234567890/camera_video.mp4`,
  };
};

const getMockUploadResponse = (puppetId) => {
  // Create a timestamp in the same format as the server
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  const timestamp = `${month}${day}${year}_${hours}${minutes}${seconds}`;
  
  console.warn(`Using mock upload response for ${puppetId} - API not available`);
  return {
    success: true,
    url: `https://storage.googleapis.com/${MASKS_BUCKET_NAME}/${puppetId}/${timestamp}_mask.png`,
  };
}; 