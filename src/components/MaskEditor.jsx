import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Stage, Layer, Circle, Line, Image as KonvaImage } from 'react-konva';
import { getVideoFrame, uploadMask, getExistingMask } from '../services/storageService.jsx';

function MaskEditor() {
  const { puppetId } = useParams();
  const navigate = useNavigate();
  const [frameImage, setFrameImage] = useState(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [mainCircle, setMainCircle] = useState({ x: 0, y: 0, radius: 100 });
  const [shapes, setShapes] = useState([]);
  const [currentShape, setCurrentShape] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedShapeIndex, setSelectedShapeIndex] = useState(null);
  const [transparent, setTransparent] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [, setLoadingMask] = useState(false);
  const [scale, setScale] = useState(1);
  const [multiSelect, setMultiSelect] = useState(false);
  const stageRef = useRef(null);
  const containerRef = useRef(null);
  const maskCanvasRef = useRef(document.createElement('canvas'));

  // Calculate scale based on container size and image dimensions
  const calculateScale = useCallback(() => {
    if (!containerRef.current || !imageSize.width || !imageSize.height) return;
    
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    
    // Calculate scale to fit the image within the container
    const scaleX = containerWidth / imageSize.width;
    const scaleY = containerHeight / imageSize.height;
    
    // Use the smaller scale to ensure the entire image fits
    const newScale = Math.min(scaleX, scaleY, 1); // Cap at 1 to avoid upscaling
    
    setScale(newScale);
  }, [imageSize.width, imageSize.height]);

  // Adjust coordinates from scaled view to original image
  const getOriginalCoordinates = (pos) => {
    if (!stageRef.current) return pos;
    
    const stage = stageRef.current;
    const pointerPos = stage.getPointerPosition();
    
    if (!pointerPos) return pos;
    
    // Convert from screen coordinates to original image coordinates
    return {
      x: pointerPos.x / scale,
      y: pointerPos.y / scale
    };
  };

  // Function to extract shapes from mask
  const extractShapesFromMask = useCallback((maskImage, width, height) => {
    console.log('Extracting shapes from mask...');
    const canvas = maskCanvasRef.current;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    // Draw the mask image
    ctx.drawImage(maskImage, 0, 0, width, height);
    
    // Get the image data
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // First extract the main circle (using center of mass of black pixels)
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    
    // Create a binary mask for analysis (1 for black pixels, 0 for white)
    const binaryMask = new Uint8Array(width * height);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        // Black pixels (0,0,0) are the mask area
        if (data[index] === 0 && data[index + 1] === 0 && data[index + 2] === 0) {
          binaryMask[y * width + x] = 1;
          sumX += x;
          sumY += y;
          count++;
        }
      }
    }
    
    if (count > 0) {
      const centerX = Math.round(sumX / count);
      const centerY = Math.round(sumY / count);
      
      // Calculate distances from center to all black pixels
      let totalDistance = 0;
      let distanceCount = 0;
      
      // Sample every 10th pixel for efficiency
      for (let y = 0; y < height; y += 10) {
        for (let x = 0; x < width; x += 10) {
          if (binaryMask[y * width + x] === 1) {
            const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
            totalDistance += distance;
            distanceCount++;
          }
        }
      }
      
      const avgRadius = distanceCount > 0 ? Math.round(totalDistance / distanceCount) : 100;
      
      // Set the main circle
      setMainCircle({
        x: centerX,
        y: centerY,
        radius: avgRadius
      });
      
      console.log(`Main circle set to: x=${centerX}, y=${centerY}, radius=${avgRadius}`);
      
      // For simplicity, let's just use the main circle and not try to extract additional shapes
      // This will prevent random noise from being interpreted as shapes
      setShapes([]);
      
      // If you want to extract additional shapes, uncomment the code below and adjust parameters
      /*
      // Create a circular mask for the main circle
      const circularMask = new Uint8Array(width * height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
          if (distance <= avgRadius) {
            circularMask[y * width + x] = 1;
          }
        }
      }
      
      // Find pixels that are in binaryMask but not in circularMask
      const differenceMask = new Uint8Array(width * height);
      for (let i = 0; i < width * height; i++) {
        if (binaryMask[i] === 1 && circularMask[i] === 0) {
          differenceMask[i] = 1;
        }
      }
      
      // Simple boundary tracing for additional shapes
      const visited = new Set();
      const newShapes = [];
      
      // Helper for flood fill
      const getNeighbors = (x, y) => {
        const neighbors = [];
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        
        for (const [dx, dy] of directions) {
          const nx = x + dx;
          const ny = y + dy;
          
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const index = ny * width + nx;
            if (differenceMask[index] === 1 && !visited.has(`${nx},${ny}`)) {
              neighbors.push([nx, ny]);
            }
          }
        }
        
        return neighbors;
      };
      
      // Function to trace the boundary of a shape
      const traceBoundary = (startX, startY) => {
        const queue = [[startX, startY]];
        const boundaryPoints = [];
        
        while (queue.length > 0) {
          const [x, y] = queue.shift();
          const key = `${x},${y}`;
          
          if (visited.has(key)) continue;
          
          visited.add(key);
          
          // Check if this is a boundary point
          let isBoundary = false;
          const directions = [[-1, 0], [1, 0], [0, -1], [0, 1], 
                             [-1, -1], [-1, 1], [1, -1], [1, 1]];
          
          for (const [dx, dy] of directions) {
            const nx = x + dx;
            const ny = y + dy;
            
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
              isBoundary = true;
              break;
            }
            
            const index = ny * width + nx;
            if (differenceMask[index] === 0) {
              isBoundary = true;
              break;
            }
          }
          
          if (isBoundary) {
            boundaryPoints.push(x, y);
          }
          
          // Add neighbors to queue
          const neighbors = getNeighbors(x, y);
          queue.push(...neighbors);
        }
        
        return boundaryPoints;
      };
      
      // Find and trace connected regions
      for (let y = 0; y < height; y += 10) { // Increased step to reduce sensitivity
        for (let x = 0; x < width; x += 10) { // Increased step to reduce sensitivity
          const index = y * width + x;
          if (differenceMask[index] === 1 && !visited.has(`${x},${y}`)) {
            const boundaryPoints = traceBoundary(x, y);
            
            // Only add shapes with significant number of points
            if (boundaryPoints.length > 50) { // Increased threshold
              // Calculate the area of the shape
              let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
              for (let i = 0; i < boundaryPoints.length; i += 2) {
                minX = Math.min(minX, boundaryPoints[i]);
                minY = Math.min(minY, boundaryPoints[i + 1]);
                maxX = Math.max(maxX, boundaryPoints[i]);
                maxY = Math.max(maxY, boundaryPoints[i + 1]);
              }
              
              const area = (maxX - minX) * (maxY - minY);
              // Only add shapes with significant area (at least 1% of the image)
              if (area > (width * height * 0.01)) {
                // Simplify more aggressively by sampling fewer points
                const simplified = [];
                for (let i = 0; i < boundaryPoints.length; i += 40) { // Increased sampling interval
                  simplified.push(boundaryPoints[i], boundaryPoints[i + 1]);
                }
                
                // Close the shape
                if (simplified.length > 4) {
                  simplified.push(simplified[0], simplified[1]);
                  newShapes.push({
                    points: simplified,
                    closed: true
                  });
                }
              }
            }
          }
        }
      }
      
      console.log(`Extracted ${newShapes.length} additional shapes after filtering`);
      if (newShapes.length > 0) {
        setShapes(newShapes);
      }
      */
    }
  }, []);

  // Create a Promise-based mask loading function
  const loadExistingMaskAsync = useCallback(() => {
    return new Promise(async (resolve) => {
      try {
        setLoadingMask(true);
        const maskData = await getExistingMask(puppetId);
        
        if (maskData && maskData.maskData) {
          console.log('Existing mask found, loading...');
          
          // Create an image from the mask data
          const maskImg = new window.Image();
          
          // Use a Promise to wait for image load
          await new Promise((resolveImage) => {
            maskImg.onload = () => {
              // Extract shapes from the mask image
              if (imageSize.width > 0 && imageSize.height > 0) {
                extractShapesFromMask(maskImg, imageSize.width, imageSize.height);
              }
              resolveImage();
            };
            
            maskImg.onerror = () => {
              console.error('Failed to load mask image');
              resolveImage();
            };
            
            maskImg.src = maskData.maskData;
          });
        } else {
          console.log('No existing mask found');
        }
      } catch (err) {
        console.error('Error loading existing mask:', err);
      } finally {
        setLoadingMask(false);
        resolve();
      }
    });
  }, [puppetId, imageSize.width, imageSize.height, extractShapesFromMask]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      calculateScale();
    };
    
    window.addEventListener('resize', handleResize);
    calculateScale();
    
    return () => window.removeEventListener('resize', handleResize);
  }, [calculateScale]);

  // Calculate scale when image size changes
  useEffect(() => {
    calculateScale();
  }, [imageSize, calculateScale]);

  const moveSelectedShape = useCallback((dx, dy) => {
    if (selectedShapeIndex === null) return;
    
    setShapes(prevShapes => {
      const newShapes = [...prevShapes];
      const shape = newShapes[selectedShapeIndex];
      
      const movedPoints = shape.points.map((point, i) => {
        if (i % 2 === 0) {
          return point + dx;
        } else {
          return point + dy;
        }
      });
      
      newShapes[selectedShapeIndex] = {
        ...shape,
        points: movedPoints,
      };
      
      return newShapes;
    });
  }, [selectedShapeIndex]);

  const resizeSelectedShape = useCallback((scale) => {
    if (selectedShapeIndex === null) return;
    
    setShapes(prevShapes => {
      const newShapes = [...prevShapes];
      const shape = newShapes[selectedShapeIndex];
      
      // Find center of shape
      let sumX = 0;
      let sumY = 0;
      
      for (let i = 0; i < shape.points.length; i += 2) {
        sumX += shape.points[i];
        sumY += shape.points[i + 1];
      }
      
      const centerX = sumX / (shape.points.length / 2);
      const centerY = sumY / (shape.points.length / 2);
      
      // Scale points relative to center
      const scaledPoints = shape.points.map((point, i) => {
        if (i % 2 === 0) {
          return centerX + (point - centerX) * scale;
        } else {
          return centerY + (point - centerY) * scale;
        }
      });
      
      newShapes[selectedShapeIndex] = {
        ...shape,
        points: scaledPoints,
      };
      
      return newShapes;
    });
  }, [selectedShapeIndex]);

  useEffect(() => {
    const loadFrame = async () => {
      try {
        setLoading(true);
        setError(null);
        // Clear any existing shapes or drawing state when loading a new image
        setShapes([]);
        setCurrentShape([]);
        setIsDrawing(false);
        setSelectedShapeIndex(null);
        console.log(`Loading frame for puppet: ${puppetId}`);
        
        const frameData = await getVideoFrame(puppetId);
        console.log('Frame data received:', frameData);
        
        if (!frameData.frameData) {
          console.error('No frameData in response:', frameData);
          setError(`No frame data received. ${frameData.error || ''}`);
          setLoading(false);
          return;
        }
        
        // Use the base64 frame data directly
        const img = new window.Image();
        
        img.onload = async () => {
          console.log(`Image loaded successfully: ${img.width}x${img.height}`);
          setFrameImage(img);
          setImageSize({
            width: img.width,
            height: img.height,
          });
          
          // Initialize main circle at the center
          setMainCircle({
            x: img.width / 2,
            y: img.height / 2,
            radius: Math.min(img.width, img.height) / 4,
          });
          
          // Keep loading true until mask is loaded
          // Load existing mask once the frame is loaded and sized
          await loadExistingMaskAsync();
          
          // Now set loading to false after both image and mask are loaded
          setLoading(false);
        };
        
        img.onerror = (e) => {
          console.error('Image failed to load:', e);
          const errorMsg = frameData.error 
            ? `Failed to load image: ${frameData.error}` 
            : 'Failed to load image. Please check server logs for details.';
          
          setError(errorMsg);
          setLoading(false);
        };
        
        // Set the src after setting up event handlers
        img.src = frameData.frameData;
      } catch (err) {
        console.error('Error loading frame:', err);
        const errorMessage = err.message || 'Unknown error';
        const errorDetails = err.response?.data?.details || '';
        setError(`Failed to load video frame: ${errorMessage}. ${errorDetails}`);
        setLoading(false);
      }
    };

    loadFrame();
  }, [puppetId, loadExistingMaskAsync]);

  useEffect(() => {
    // Keyboard event handler
    const handleKeyDown = (e) => {
      if (!imageSize.width) return;
      
      // Handle Ctrl+A to select all shapes
      if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setMultiSelect(true);
        return;
      }
      
      switch (e.key) {
        case 'ArrowUp':
          if (selectedShapeIndex === null) {
            setMainCircle(c => ({ ...c, y: c.y - 5 }));
          } else {
            moveSelectedShape(0, -5);
          }
          break;
        case 'ArrowDown':
          if (selectedShapeIndex === null) {
            setMainCircle(c => ({ ...c, y: c.y + 5 }));
          } else {
            moveSelectedShape(0, 5);
          }
          break;
        case 'ArrowLeft':
          if (selectedShapeIndex === null) {
            setMainCircle(c => ({ ...c, x: c.x - 5 }));
          } else {
            moveSelectedShape(-5, 0);
          }
          break;
        case 'ArrowRight':
          if (selectedShapeIndex === null) {
            setMainCircle(c => ({ ...c, x: c.x + 5 }));
          } else {
            moveSelectedShape(5, 0);
          }
          break;
        case '+':
        case '=':
          if (selectedShapeIndex === null) {
            setMainCircle(c => ({ ...c, radius: c.radius + 5 }));
          } else {
            resizeSelectedShape(1.05);
          }
          break;
        case '-':
          if (selectedShapeIndex === null) {
            setMainCircle(c => ({ ...c, radius: Math.max(10, c.radius - 5) }));
          } else {
            resizeSelectedShape(0.95);
          }
          break;
        case 'T':
        case 't':
          setTransparent(prev => !prev);
          break;
        case 'Escape':
          if (isDrawing) {
            setCurrentShape([]);
            setIsDrawing(false);
          } else {
            setSelectedShapeIndex(null);
            setMultiSelect(false);
          }
          break;
        case 'Delete':
        case 'Backspace': // Add support for Backspace key for Mac users
          console.log('Delete/Backspace pressed', { multiSelect, selectedShapeIndex, shapes: shapes.length });
          if (multiSelect) {
            // Delete all shapes
            setShapes([]);
            setMultiSelect(false);
            console.log('Deleted all shapes');
          } else if (selectedShapeIndex !== null) {
            const newShapes = [...shapes];
            newShapes.splice(selectedShapeIndex, 1);
            setShapes(newShapes);
            setSelectedShapeIndex(null);
            console.log(`Deleted shape at index ${selectedShapeIndex}`);
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [imageSize, selectedShapeIndex, isDrawing, shapes, moveSelectedShape, resizeSelectedShape, multiSelect]);

  const handleMouseDown = (e) => {
    if (isDrawing) {
      // Continue drawing current shape
      const pos = getOriginalCoordinates(e.target.getStage().getPointerPosition());
      const newPoint = snapToImageBorder(pos);
      setCurrentShape([...currentShape, newPoint.x, newPoint.y]);
    } else {
      // Start a new shape
      const pos = getOriginalCoordinates(e.target.getStage().getPointerPosition());
      setCurrentShape([pos.x, pos.y]);
      setIsDrawing(true);
      setSelectedShapeIndex(null);
    }
  };

  const handleMouseMove = (e) => {
    if (!isDrawing) return;
    
    // Add point for freeform drawing - only add a point every few pixels to reduce complexity
    const pos = getOriginalCoordinates(e.target.getStage().getPointerPosition());
    const newPoint = snapToImageBorder(pos);
    
    // Only add a point if we've moved at least 5 pixels from the last point
    if (currentShape.length >= 2) {
      const lastX = currentShape[currentShape.length - 2];
      const lastY = currentShape[currentShape.length - 1];
      
      const distance = Math.sqrt(
        Math.pow(newPoint.x - lastX, 2) + Math.pow(newPoint.y - lastY, 2)
      );
      
      if (distance < 5) {
        return; // Skip this point if too close to the last one
      }
    }
    
    setCurrentShape([...currentShape, newPoint.x, newPoint.y]);
  };

  const simplifyShape = (points, tolerance = 5) => {
    // If fewer than 3 points, can't simplify
    if (points.length < 6) return points;
    
    const simplified = [points[0], points[1]]; // Always keep the first point
    
    // Use a simple distance-based simplification
    for (let i = 2; i < points.length - 2; i += 2) {
      const lastX = simplified[simplified.length - 2];
      const lastY = simplified[simplified.length - 1];
      const currentX = points[i];
      const currentY = points[i+1];
      
      const distance = Math.sqrt(
        Math.pow(currentX - lastX, 2) + Math.pow(currentY - lastY, 2)
      );
      
      if (distance >= tolerance) {
        simplified.push(currentX, currentY);
      }
    }
    
    // Always keep the last point
    simplified.push(points[points.length - 2], points[points.length - 1]);
    
    return simplified;
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    
    // Check if shape is closed (first point near last point)
    if (currentShape.length >= 4) {
      const firstX = currentShape[0];
      const firstY = currentShape[1];
      const lastX = currentShape[currentShape.length - 2];
      const lastY = currentShape[currentShape.length - 1];
      
      const distance = Math.sqrt(
        Math.pow(lastX - firstX, 2) + Math.pow(lastY - firstY, 2)
      );
      
      if (distance < 20) {
        // Simplify the shape to reduce number of points
        const simplifiedShape = simplifyShape(currentShape);
        
        // Close the shape by adding the first point at the end
        const closedShape = [...simplifiedShape, firstX, firstY];
        const newShape = { points: closedShape, closed: true };
        console.log(`Closing shape with ${closedShape.length/2} points (simplified from ${currentShape.length/2})`);
        setShapes(prevShapes => [...prevShapes, newShape]);
        setCurrentShape([]);
        setIsDrawing(false);
      }
    }
  };

  const snapToImageBorder = (pos) => {
    const snapDistance = 10;
    const result = { x: pos.x, y: pos.y };
    
    if (pos.x < snapDistance) result.x = 0;
    if (pos.y < snapDistance) result.y = 0;
    if (pos.x > imageSize.width - snapDistance) result.x = imageSize.width;
    if (pos.y > imageSize.height - snapDistance) result.y = imageSize.height;
    
    return result;
  };

  const handleShapeClick = (index) => {
    setSelectedShapeIndex(index);
    setIsDrawing(false);
    setCurrentShape([]);
    setMultiSelect(false);
    console.log(`Selected shape at index ${index}`);
  };

  const generateMask = () => {
    if (!stageRef.current) return;
    
    // Create a temporary canvas to draw the mask
    const canvas = document.createElement('canvas');
    canvas.width = imageSize.width;
    canvas.height = imageSize.height;
    const ctx = canvas.getContext('2d');
    
    // Fill with white (unused area)
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw black for used area (the main circle and all closed shapes)
    ctx.fillStyle = 'black';
    
    // Draw the main circle
    ctx.beginPath();
    ctx.arc(mainCircle.x, mainCircle.y, mainCircle.radius, 0, Math.PI * 2);
    ctx.fill();
    
    console.log(`Drawing ${shapes.length} shapes in the mask`);
    
    // Draw all shapes
    shapes.forEach((shape, index) => {
      if (!shape.closed) {
        console.log(`Shape ${index} is not closed, skipping`);
        return;
      }
      
      if (shape.points.length < 6) { // Need at least 3 points (x,y pairs) to form a polygon
        console.log(`Shape ${index} has too few points (${shape.points.length}), skipping`);
        return;
      }
      
      console.log(`Drawing shape ${index} with ${shape.points.length/2} points`);
      
      ctx.beginPath();
      ctx.moveTo(shape.points[0], shape.points[1]);
      
      for (let i = 2; i < shape.points.length; i += 2) {
        ctx.lineTo(shape.points[i], shape.points[i + 1]);
      }
      
      ctx.closePath(); // Ensure path is closed
      ctx.fill();
    });
    
    return canvas.toDataURL();
  };

  const handleSaveMask = async () => {
    try {
      setUploadStatus('uploading');
      console.log(`Saving mask with ${shapes.length} shapes`);
      
      const maskData = generateMask();
      
      if (!maskData) {
        setError('Failed to generate mask');
        setUploadStatus('error');
        return;
      }
      
      const result = await uploadMask(puppetId, maskData);
      
      if (result.success) {
        setUploadStatus('success');
        console.log('Mask uploaded successfully');
      } else {
        setUploadStatus('error');
        setError('Failed to upload mask');
        console.error('Failed to upload mask', result);
      }
    } catch (err) {
      setUploadStatus('error');
      setError('Failed to save mask: ' + err.message);
      console.error('Error saving mask:', err);
    }
  };

  const selectAllShapes = () => {
    setMultiSelect(true);
    setSelectedShapeIndex(null);
  };

  const clearAllShapes = () => {
    setShapes([]);
    setMultiSelect(false);
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="bg-gray-800 text-white p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">Mask Editor - Puppet {puppetId}</h1>
        <div className="flex space-x-2">
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
          >
            Back to Dashboard
          </button>
          <button
            onClick={selectAllShapes}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            Select All
          </button>
          <button
            onClick={clearAllShapes}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
          >
            Clear All
          </button>
          <button
            onClick={handleSaveMask}
            disabled={loading || !frameImage || uploadStatus === 'uploading'}
            className={`${
              loading || !frameImage || uploadStatus === 'uploading'
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
            } text-white px-4 py-2 rounded`}
          >
            {uploadStatus === 'uploading' ? 'Saving...' : 'Save Mask'}
          </button>
        </div>
      </div>

      <div 
        ref={containerRef} 
        className="flex-1 overflow-auto bg-gray-900 flex justify-center items-center relative"
      >
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white"></div>
          </div>
        ) : error ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded absolute top-4 right-4" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        ) : frameImage ? (
          <div className="relative w-full h-full flex justify-center items-center" style={{ overflow: 'hidden' }}>
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}>
              <Stage
                ref={stageRef}
                width={imageSize.width}
                height={imageSize.height}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                scale={{ x: 1, y: 1 }}
              >
                <Layer>
                  <KonvaImage image={frameImage} />
                </Layer>
                
                <Layer opacity={transparent ? 0.5 : 1}>
                  {/* Main circle */}
                  <Circle
                    x={mainCircle.x}
                    y={mainCircle.y}
                    radius={mainCircle.radius}
                    fill={transparent ? 'rgba(0, 0, 255, 0.3)' : 'black'}
                    stroke={selectedShapeIndex === null && !multiSelect ? 'yellow' : 'blue'}
                    strokeWidth={2}
                    onClick={() => {
                      setSelectedShapeIndex(null);
                      setMultiSelect(false);
                    }}
                  />
                  
                  {/* Completed shapes */}
                  {shapes.map((shape, i) => (
                    <Line
                      key={i}
                      points={shape.points}
                      fill={transparent ? 'rgba(0, 0, 255, 0.3)' : 'black'}
                      stroke={selectedShapeIndex === i || multiSelect ? 'yellow' : 'blue'}
                      strokeWidth={2}
                      closed={shape.closed}
                      onClick={() => handleShapeClick(i)}
                    />
                  ))}
                  
                  {/* Current shape being drawn */}
                  {currentShape.length > 0 && (
                    <Line
                      points={currentShape}
                      stroke="red"
                      strokeWidth={2}
                    />
                  )}
                </Layer>
              </Stage>
            </div>
            
            {uploadStatus === 'success' && (
              <div className="absolute top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded" role="alert">
                <span className="block sm:inline">Mask saved successfully!</span>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="bg-gray-800 text-white p-4">
        <div className="flex justify-between">
          <div>
            <h3 className="font-bold mb-2">Controls:</h3>
            <ul className="text-sm">
              <li>Arrow Keys: Move selected shape</li>
              <li>+ / -: Resize selected shape</li>
              <li>T: Toggle transparency</li>
              <li>Ctrl+A: Select all shapes</li>
              <li>Esc: Cancel current shape / Deselect</li>
              <li>Delete: Remove selected shape(s)</li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold mb-2">Drawing:</h3>
            <ul className="text-sm">
              <li>Click to start a shape</li>
              <li>Click to add points</li>
              <li>Drag to draw freeform</li>
              <li>Connect back to first point to close shape</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MaskEditor; 