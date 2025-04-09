// Mock Storage Service for Browser Environment
// In production, these calls would go to a backend API that interfaces with Google Cloud Storage

const BUCKET_NAME = 'zeroshot-database-prod-puppet-calibration';

// Sample/mock data for development
const mockPuppets = [
  { id: 'puppet001', name: 'puppet001', hasMask: true, maskCreatedAt: new Date(2023, 5, 15).toISOString() },
  { id: 'puppet002', name: 'puppet002', hasMask: false },
  { id: 'puppet003', name: 'puppet003', hasMask: true, maskCreatedAt: new Date(2023, 8, 22).toISOString() },
  { id: 'puppet004', name: 'puppet004', hasMask: false },
];

// List puppets in the bucket
export const listPuppets = async () => {
  console.log('Listing puppets from mock data');
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return mockPuppets.map(({ hasMask, maskCreatedAt, ...puppet }) => puppet);
};

// Check if mask exists for a puppet
export const checkMaskExists = async (puppetId) => {
  console.log(`Checking mask for puppet ${puppetId}`);
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  const puppet = mockPuppets.find(p => p.id === puppetId);
  
  if (puppet) {
    return {
      exists: puppet.hasMask,
      createdAt: puppet.maskCreatedAt,
    };
  }
  
  return { exists: false };
};

// Get video frame from earliest timestamp folder
export const getVideoFrame = async (puppetId) => {
  console.log(`Getting video frame for puppet ${puppetId}`);
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // Return a placeholder image
  return {
    // Using a placeholder image from Unsplash or Placeholder.com for testing
    frameUrl: 'https://picsum.photos/800/600',
    videoPath: `${puppetId}/camera/1234567890/camera_video.mp4`,
  };
};

// Upload mask to storage
export const uploadMask = async (puppetId, maskData) => {
  console.log(`Uploading mask for puppet ${puppetId}`);
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1200));
  
  // In a real app, this would upload to Google Cloud Storage
  
  // Find puppet in mock data
  const puppetIndex = mockPuppets.findIndex(p => p.id === puppetId);
  
  if (puppetIndex >= 0) {
    // Update mock data
    mockPuppets[puppetIndex].hasMask = true;
    mockPuppets[puppetIndex].maskCreatedAt = new Date().toISOString();
  }
  
  return {
    success: true,
    url: `https://storage.googleapis.com/${BUCKET_NAME}/${puppetId}/camera/mask.png`,
  };
}; 