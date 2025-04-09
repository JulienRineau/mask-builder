// Mock Storage Service for Browser Environment
// In production, these calls would go to a backend API that interfaces with Google Cloud Storage

import axios from 'axios';

// Base API URL for accessing Google Cloud Storage
// You would need to create a small backend service to handle these requests
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const BUCKET_NAME = 'zeroshot-database-prod-puppet-calibration';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Intercept requests to add auth token if available
api.interceptors.request.use(config => {
  const isAuthenticated = localStorage.getItem('isAuthenticated');
  if (isAuthenticated) {
    config.headers.Authorization = `Bearer ${isAuthenticated}`;
  }
  return config;
});

// List puppets in the bucket
export const listPuppets = async () => {
  try {
    const response = await api.get('/puppets');
    return response.data;
  } catch (error) {
    console.error('Error listing puppets:', error);
    // Fallback to mock data if API is not available
    return getMockPuppets();
  }
};

// Check if mask exists for a puppet
export const checkMaskExists = async (puppetId) => {
  try {
    const response = await api.get(`/puppets/${puppetId}/mask`);
    return response.data;
  } catch (error) {
    console.error(`Error checking mask for puppet ${puppetId}:`, error);
    // Fallback to mock data
    return getMockMaskStatus(puppetId);
  }
};

// Get video frame from earliest timestamp folder
export const getVideoFrame = async (puppetId) => {
  try {
    const response = await api.get(`/puppets/${puppetId}/frame`);
    return response.data;
  } catch (error) {
    console.error(`Error getting video frame for puppet ${puppetId}:`, error);
    // Fallback to mock data
    return getMockVideoFrame(puppetId);
  }
};

// Upload mask to storage
export const uploadMask = async (puppetId, maskData) => {
  try {
    const response = await api.post(`/puppets/${puppetId}/mask`, { 
      maskData,
      bucketName: BUCKET_NAME 
    });
    return response.data;
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