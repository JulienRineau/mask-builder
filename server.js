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
const MASKS_BUCKET_NAME = 'zeroshot-database-prod-masks';

// Processing locks to prevent race conditions
const processingLocks = {};

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

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
const masksBucket = storage.bucket(MASKS_BUCKET_NAME);

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
    // Using the delimiter parameter with the Storage API to list top-level folders
    const [files, _, apiResponse] = await bucket.getFiles({
      autoPaginate: false,
      delimiter: '/',
    });
    
    // The prefixes array contains the folder names
    const puppets = apiResponse.prefixes ? apiResponse.prefixes.map(prefix => {
      const puppetId = prefix.replace('/', '');
      return {
        id: puppetId,
        name: puppetId,
      };
    }) : [];

    res.json(puppets);
  } catch (error) {
    console.error('Error listing puppets:', error);
    res.status(500).json({ error: 'Failed to list puppets' });
  }
});

// Check if mask exists for a puppet
apiRouter.get('/puppets/:puppetId/mask', authenticate, async (req, res) => {
  const puppetId = req.params.puppetId;
  
  // Set cache control headers to prevent caching
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  
  try {
    console.log(`Checking mask existence for puppet: ${puppetId}`);
    
    // Check for masks in the puppet's folder in the masks bucket
    const maskPrefix = `${puppetId}/`;
    const [files] = await masksBucket.getFiles({ prefix: maskPrefix });
    
    const exists = files.length > 0;
    console.log(`Mask for puppet ${puppetId} exists: ${exists} (found ${files.length} masks)`);
    
    if (exists) {
      // Sort files by name (timestamp) in descending order to get the latest
      files.sort((a, b) => b.name.localeCompare(a.name));
      const latestMask = files[0];
      console.log(`Latest mask: ${latestMask.name}`);
      
      const [fileMetadata] = await latestMask.getMetadata();
      
      res.json({
        exists: true,
        createdAt: fileMetadata.timeCreated
      });
    } else {
      res.json({
        exists: false
      });
    }
  } catch (error) {
    console.error(`Error checking mask for puppet ${puppetId}:`, error);
    res.status(500).json({
      error: 'Failed to check mask existence',
      details: error.message
    });
  }
});

// Extract a frame from the video for a puppet
apiRouter.get('/puppets/:puppetId/frame', authenticate, async (req, res) => {
  try {
    const puppetId = req.params.puppetId;
    const tempDir = path.join(os.tmpdir(), 'mask-builder');
    
    console.log(`Processing frame extraction for puppet: ${puppetId}`);
    console.log(`Using temp directory: ${tempDir}`);
    
    // Check if this puppet is already being processed
    if (processingLocks[puppetId]) {
      console.log(`Puppet ${puppetId} is already being processed, waiting...`);
      // Wait for the existing process to complete and use its result
      try {
        const result = await processingLocks[puppetId];
        return res.json(result);
      } catch (err) {
        console.error(`Error from existing process for ${puppetId}:`, err);
        // Continue with a new attempt if the existing process failed
      }
    }
    
    // Create a promise for this processing operation
    let resolveProcessing, rejectProcessing;
    processingLocks[puppetId] = new Promise((resolve, reject) => {
      resolveProcessing = resolve;
      rejectProcessing = reject;
    });
    
    // Create temp directory if it doesn't exist
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
      console.log('Created temp directory');
    }
    
    // Get files from the camera folder to find timestamp directories
    const [allFiles] = await bucket.getFiles({
      prefix: `${puppetId}/camera/`,
    });
    
    console.log(`Found ${allFiles.length} files in camera folder`);
    
    // Extract the timestamp directory names
    const timestampDirectories = new Set();
    allFiles.forEach(file => {
      // Extract paths like puppet_id/camera/TIMESTAMP_DIR/any_file
      const match = file.name.match(/^[^\/]+\/camera\/([^\/]+)\//);
      if (match && match[1]) {
        timestampDirectories.add(match[1]);
      }
    });
    
    const sortedTimestamps = Array.from(timestampDirectories).sort();
    console.log('Found timestamp directories:', sortedTimestamps);
    
    if (sortedTimestamps.length === 0) {
      console.log('No timestamp directories found');
      const [allFilesInPuppet] = await bucket.getFiles({
        prefix: `${puppetId}/`,
        maxResults: 20
      });
      console.log('First 20 files in puppet directory:');
      allFilesInPuppet.forEach(file => console.log(`- ${file.name}`));
      
      return res.status(404).json({ error: 'No timestamp folders found' });
    }
    
    // Use the earliest timestamp folder
    const earliestTimestamp = sortedTimestamps[0];
    console.log(`Using earliest timestamp folder: ${earliestTimestamp}`);
    
    // Get video file
    const videoPath = `${puppetId}/camera/${earliestTimestamp}/camera_video.mp4`;
    console.log(`Looking for video at: ${videoPath}`);
    
    const [videoExists] = await bucket.file(videoPath).exists();
    console.log(`Video exists: ${videoExists}`);
    
    if (!videoExists) {
      // Try to list files in the folder to see what's available
      const [folderFiles] = await bucket.getFiles({
        prefix: `${puppetId}/camera/${earliestTimestamp}/`
      });
      console.log(`Files in earliest folder (${folderFiles.length}):`);
      folderFiles.forEach(file => console.log(`- ${file.name}`));
      
      return res.status(404).json({ error: 'Video file not found' });
    }
    
    // Download the video file to a temporary location
    const tempVideoPath = path.join(tempDir, `${puppetId}_video.mp4`);
    const tempFramePath = path.join(tempDir, `${puppetId}_frame.png`);
    
    console.log(`Downloading video to: ${tempVideoPath}`);
    await bucket.file(videoPath).download({ destination: tempVideoPath });
    console.log('Video download complete');
    
    // Use ffmpeg to extract frame at 10 seconds
    const ffmpegCmd = `ffmpeg -i "${tempVideoPath}" -ss 00:00:10 -frames:v 1 "${tempFramePath}" -y`;
    console.log(`Running ffmpeg command: ${ffmpegCmd}`);
    
    return new Promise((resolve, reject) => {
      exec(ffmpegCmd, async (error, stdout, stderr) => {
        if (error) {
          console.error('Error extracting frame:', error);
          console.error('ffmpeg stderr:', stderr);
          
          // Don't delete the video file on error to help with debugging
          const error = { 
            error: 'Failed to extract frame from video',
            details: stderr
          };
          rejectProcessing(error);
          return res.status(500).json(error);
        }
        
        try {
          console.log(`Frame extracted to: ${tempFramePath}`);
          
          // Check if frame file exists and has content
          if (!fs.existsSync(tempFramePath)) {
            console.error('Frame file was not created');
            const error = { error: 'Frame file was not created' };
            rejectProcessing(error);
            return res.status(500).json(error);
          }
          
          const fileStats = fs.statSync(tempFramePath);
          console.log(`Frame file size: ${fileStats.size} bytes`);
          
          if (fileStats.size === 0) {
            console.error('Frame file is empty');
            const error = { error: 'Frame file is empty' };
            rejectProcessing(error);
            return res.status(500).json(error);
          }
          
          // Read the frame file and convert to base64
          const frameBuffer = fs.readFileSync(tempFramePath);
          const base64Frame = `data:image/png;base64,${frameBuffer.toString('base64')}`;
          console.log(`Base64 frame length: ${base64Frame.length}`);
          
          // Clean up temporary files
          fs.unlinkSync(tempVideoPath);
          fs.unlinkSync(tempFramePath);
          console.log('Temporary files cleaned up');
          
          // Return the frame data
          const result = {
            frameData: base64Frame,
            videoPath: videoPath,
          };
          
          resolveProcessing(result);
          res.json(result);
          
          resolve();
        } catch (err) {
          console.error('Error reading frame:', err);
          const error = { 
            error: 'Failed to process extracted frame',
            details: err.message
          };
          rejectProcessing(error);
          res.status(500).json(error);
          reject(err);
        } finally {
          // Remove the lock after some time to allow for potential retries
          setTimeout(() => {
            delete processingLocks[puppetId];
          }, 5000);
        }
      });
    });
  } catch (error) {
    console.error(`Error getting video frame for puppet ${req.params.puppetId}:`, error);
    res.status(500).json({ 
      error: 'Failed to get video frame',
      details: error.message
    });
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
    
    // Check if upload is already in progress
    if (processingLocks[`upload-${puppetId}`]) {
      console.log(`Mask upload for puppet ${puppetId} is already in progress, waiting...`);
      try {
        const result = await processingLocks[`upload-${puppetId}`];
        return res.json(result);
      } catch (err) {
        console.error(`Error from existing upload process for ${puppetId}:`, err);
        // Continue with a new attempt if the existing process failed
      }
    }
    
    // Create a promise for this upload operation
    let resolveUpload, rejectUpload;
    processingLocks[`upload-${puppetId}`] = new Promise((resolve, reject) => {
      resolveUpload = resolve;
      rejectUpload = reject;
    });
    
    try {
      // Create timestamped filename in puppet folder: <puppetId>/<timestamp>_mask.png
      const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
      const maskPath = `${puppetId}/${timestamp}_mask.png`;
      console.log(`Saving mask to path: ${maskPath}`);
      
      const file = masksBucket.file(maskPath);
      
      // Convert base64 data to buffer
      const base64Data = maskData.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Upload file
      await file.save(buffer, {
        contentType: 'image/png',
        metadata: {
          contentType: 'image/png',
          puppetId: puppetId,
          createdAt: timestamp
        },
      });
      
      // Get the public URL
      const publicUrl = `https://storage.googleapis.com/${MASKS_BUCKET_NAME}/${maskPath}`;
      
      const result = { 
        success: true, 
        url: publicUrl 
      };
      
      resolveUpload(result);
      res.json(result);
    } catch (error) {
      console.error(`Error uploading mask for puppet ${puppetId}:`, error);
      const errorResult = { error: 'Failed to upload mask' };
      rejectUpload(errorResult);
      res.status(500).json(errorResult);
    } finally {
      // Remove the lock after some time
      setTimeout(() => {
        delete processingLocks[`upload-${puppetId}`];
      }, 5000);
    }
  } catch (error) {
    console.error(`Error uploading mask for puppet ${req.params.puppetId}:`, error);
    res.status(500).json({ error: 'Failed to upload mask' });
  }
});

// Get existing mask for a puppet
apiRouter.get('/puppets/:puppetId/existing-mask', authenticate, async (req, res) => {
  try {
    const puppetId = req.params.puppetId;
    
    // Check if retrieval is already in progress
    if (processingLocks[`get-mask-${puppetId}`]) {
      console.log(`Mask retrieval for puppet ${puppetId} is already in progress, waiting...`);
      try {
        const result = await processingLocks[`get-mask-${puppetId}`];
        return res.json(result);
      } catch (err) {
        console.error(`Error from existing mask retrieval for ${puppetId}:`, err);
        // Continue with a new attempt if the existing process failed
      }
    }
    
    // Create a promise for this retrieval operation
    let resolveRetrieval, rejectRetrieval;
    processingLocks[`get-mask-${puppetId}`] = new Promise((resolve, reject) => {
      resolveRetrieval = resolve;
      rejectRetrieval = reject;
    });
    
    try {
      // Check for masks in the puppet's folder
      const maskPrefix = `${puppetId}/`;
      const tempDir = path.join(os.tmpdir(), 'mask-builder');
      const tempMaskPath = path.join(tempDir, `${puppetId}_mask.png`);
      
      console.log(`Retrieving existing mask for puppet: ${puppetId}`);
      
      // Create temp directory if it doesn't exist
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
        console.log('Created temp directory');
      }
      
      // Find all masks for this puppet
      const [files] = await masksBucket.getFiles({ prefix: maskPrefix });
      
      if (files.length === 0) {
        console.log(`No existing mask found for puppet ${puppetId}`);
        const errorResult = { error: 'Mask not found' };
        // Don't reject the promise when sending a 404 response
        // This is a normal condition, not an error in promise terms
        resolveRetrieval(errorResult);
        return res.status(404).json(errorResult);
      }
      
      // Sort files by name (timestamp) in descending order to get the latest
      files.sort((a, b) => b.name.localeCompare(a.name));
      const latestMask = files[0];
      console.log(`Downloading latest mask: ${latestMask.name}`);
      
      // Download the mask file
      console.log(`Downloading mask to: ${tempMaskPath}`);
      await latestMask.download({ destination: tempMaskPath });
      
      // Read the mask file and convert to base64
      const maskBuffer = fs.readFileSync(tempMaskPath);
      const base64Mask = `data:image/png;base64,${maskBuffer.toString('base64')}`;
      
      // Clean up the temporary file
      fs.unlinkSync(tempMaskPath);
      
      // Return the mask data
      const result = { 
        maskData: base64Mask
      };
      
      resolveRetrieval(result);
      res.json(result);
    } catch (err) {
      console.error(`Error retrieving mask for puppet ${puppetId}:`, err);
      const errorResult = { error: 'Failed to retrieve mask' };
      rejectRetrieval(errorResult);
      res.status(500).json(errorResult);
    } finally {
      // Remove the lock after some time
      setTimeout(() => {
        delete processingLocks[`get-mask-${puppetId}`];
      }, 5000);
    }
  } catch (error) {
    console.error(`Error getting mask for puppet ${req.params.puppetId}:`, error);
    res.status(500).json({ error: 'Failed to get mask' });
  }
});

// Mount API router
app.use('/api', apiRouter);

// Check if we're in production
const isProduction = process.env.NODE_ENV === 'production';

// Serve React app in production only
if (isProduction) {
  // Serve static files
  app.use(express.static(path.join(__dirname, 'build')));

  // Serve React app for all other routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
} else {
  // In development, only serve the API
  app.get('/', (req, res) => {
    res.send('API server running. Frontend is served separately in development mode.');
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  if (!isProduction) {
    console.log(`API available at http://localhost:${PORT}/api`);
  }
}); 