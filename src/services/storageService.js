import { Storage } from '@google-cloud/storage';

const BUCKET_NAME = 'zeroshot-database-prod-puppet-calibration';

// Initialize storage client with service account key
// The key file should be placed in the public folder
let storageConfig = {};

try {
  // In development, try to load the service account key
  if (process.env.NODE_ENV === 'development') {
    storageConfig = {
      keyFilename: './service-account-key.json',
    };
  } else {
    // In production, key might be provided through environment variables or other means
    storageConfig = {
      credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS || '{}'),
    };
  }
} catch (error) {
  console.error('Error loading service account key:', error);
}

const storage = new Storage(storageConfig);
const bucket = storage.bucket(BUCKET_NAME);

// List puppets in the bucket
export const listPuppets = async () => {
  try {
    const [files] = await bucket.getFiles({
      prefix: '',
      delimiter: '/',
    });

    const puppets = files
      .filter(file => file.name.endsWith('/'))
      .map(file => {
        const puppetId = file.name.replace('/', '');
        return {
          id: puppetId,
          name: puppetId,
        };
      });

    return puppets;
  } catch (error) {
    console.error('Error listing puppets:', error);
    throw error;
  }
};

// Check if mask exists for a puppet
export const checkMaskExists = async (puppetId) => {
  try {
    const maskPath = `${puppetId}/camera/mask.png`;
    const [exists] = await bucket.file(maskPath).exists();
    
    if (exists) {
      const [metadata] = await bucket.file(maskPath).getMetadata();
      return {
        exists,
        createdAt: metadata.timeCreated,
      };
    }
    
    return { exists: false };
  } catch (error) {
    console.error(`Error checking mask for puppet ${puppetId}:`, error);
    throw error;
  }
};

// Get video frame from earliest timestamp folder
export const getVideoFrame = async (puppetId) => {
  try {
    // Get all folders under camera
    const [files] = await bucket.getFiles({
      prefix: `${puppetId}/camera/`,
      delimiter: '/',
    });
    
    // Filter and sort timestamp folders
    const timestampFolders = files
      .filter(file => file.name.match(/camera\/\d+\/$/))
      .sort((a, b) => a.name.localeCompare(b.name));
    
    if (timestampFolders.length === 0) {
      throw new Error('No timestamp folders found');
    }
    
    const earliestFolder = timestampFolders[0].name;
    
    // Get video file
    const videoPath = `${earliestFolder}camera_video.mp4`;
    const [videoExists] = await bucket.file(videoPath).exists();
    
    if (!videoExists) {
      throw new Error('Video file not found');
    }
    
    // Process video to extract frame (this would require server-side processing)
    // For the frontend, we'd need a serverless function or backend API to handle this
    // This is a placeholder for the actual implementation
    const frameUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${videoPath}`;
    
    return {
      frameUrl,
      videoPath,
    };
  } catch (error) {
    console.error(`Error getting video frame for puppet ${puppetId}:`, error);
    throw error;
  }
};

// Upload mask to storage
export const uploadMask = async (puppetId, maskData) => {
  try {
    const maskPath = `${puppetId}/camera/mask.png`;
    const file = bucket.file(maskPath);
    
    // Convert base64 data to buffer
    const base64Data = maskData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Upload file
    await file.save(buffer, {
      contentType: 'image/png',
      metadata: {
        contentType: 'image/png',
      },
    });
    
    // Get the public URL
    const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${maskPath}`;
    
    return { success: true, url: publicUrl };
  } catch (error) {
    console.error(`Error uploading mask for puppet ${puppetId}:`, error);
    throw error;
  }
}; 