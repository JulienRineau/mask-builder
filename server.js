const express = require('express');
const cors = require('cors');
const { Storage } = require('@google-cloud/storage');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3001;
const BUCKET_NAME = 'zeroshot-database-prod-puppet-calibration';

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'build')));

// Initialize Google Cloud Storage
let storage;
try {
  // Try to use service account key file
  const keyFilePath = path.join(__dirname, 'key.json');
  if (fs.existsSync(keyFilePath)) {
    storage = new Storage({
      keyFilename: keyFilePath,
    });
    console.log('Using service account from key.json');
  } else {
    // Try to use application default credentials
    storage = new Storage();
    console.log('Using application default credentials');
  }
} catch (error) {
  console.error('Error initializing Google Cloud Storage:', error);
  process.exit(1);
}

const bucket = storage.bucket(BUCKET_NAME);

// API Routes
const apiRouter = express.Router();

// Authentication middleware
const authenticate = (req, res, next) => {
  // Simple authentication for demo purposes
  // In production, use a proper authentication system
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
};

// List all puppets in the bucket
apiRouter.get('/puppets', authenticate, async (req, res) => {
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

    res.json(puppets);
  } catch (error) {
    console.error('Error listing puppets:', error);
    res.status(500).json({ error: 'Failed to list puppets' });
  }
});

// Check if mask exists for a puppet
apiRouter.get('/puppets/:puppetId/mask', authenticate, async (req, res) => {
  try {
    const puppetId = req.params.puppetId;
    const maskPath = `${puppetId}/camera/mask.png`;
    const [exists] = await bucket.file(maskPath).exists();
    
    if (exists) {
      const [metadata] = await bucket.file(maskPath).getMetadata();
      res.json({
        exists,
        createdAt: metadata.timeCreated,
      });
    } else {
      res.json({ exists: false });
    }
  } catch (error) {
    console.error(`Error checking mask for puppet ${req.params.puppetId}:`, error);
    res.status(500).json({ error: 'Failed to check mask' });
  }
});

// Extract a frame from the video for a puppet
apiRouter.get('/puppets/:puppetId/frame', authenticate, async (req, res) => {
  try {
    const puppetId = req.params.puppetId;
    
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
      return res.status(404).json({ error: 'No timestamp folders found' });
    }
    
    const earliestFolder = timestampFolders[0].name;
    
    // Get video file
    const videoPath = `${earliestFolder}camera_video.mp4`;
    const [videoExists] = await bucket.file(videoPath).exists();
    
    if (!videoExists) {
      return res.status(404).json({ error: 'Video file not found' });
    }
    
    // Generate a signed URL for the video
    const [url] = await bucket.file(videoPath).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    });
    
    // In a real implementation, we would extract the frame at 10 seconds
    // For this demo, we'll return the video URL and client can extract frame
    res.json({
      frameUrl: url, // URL to video file
      videoPath: videoPath,
    });
  } catch (error) {
    console.error(`Error getting video frame for puppet ${req.params.puppetId}:`, error);
    res.status(500).json({ error: 'Failed to get video frame' });
  }
});

// Upload mask for a puppet
apiRouter.post('/puppets/:puppetId/mask', authenticate, async (req, res) => {
  try {
    const puppetId = req.params.puppetId;
    const { maskData } = req.body;
    
    if (!maskData) {
      return res.status(400).json({ error: 'No mask data provided' });
    }
    
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
    
    res.json({ 
      success: true, 
      url: publicUrl 
    });
  } catch (error) {
    console.error(`Error uploading mask for puppet ${req.params.puppetId}:`, error);
    res.status(500).json({ error: 'Failed to upload mask' });
  }
});

// Mount API router
app.use('/api', apiRouter);

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 