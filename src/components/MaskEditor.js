import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Stage, Layer, Circle, Line, Image as KonvaImage } from 'react-konva';
import { getVideoFrame, uploadMask } from '../services/storageService';

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
  const stageRef = useRef(null);

  useEffect(() => {
    const loadFrame = async () => {
      try {
        setLoading(true);
        const frameData = await getVideoFrame(puppetId);
        
        // In a real implementation, we'd extract the frame on the server-side
        // For this demo, we'll use a placeholder image loader
        const img = new window.Image();
        img.src = frameData.frameUrl;
        
        img.onload = () => {
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
          
          setLoading(false);
        };
        
        img.onerror = () => {
          setError('Failed to load image. Please try again.');
          setLoading(false);
        };
      } catch (err) {
        setError('Failed to load video frame. Please try again later.');
        setLoading(false);
        console.error('Error loading frame:', err);
      }
    };

    loadFrame();
  }, [puppetId]);

  useEffect(() => {
    // Keyboard event handler
    const handleKeyDown = (e) => {
      if (!imageSize.width) return;
      
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
          }
          break;
        case 'Delete':
          if (selectedShapeIndex !== null) {
            const newShapes = [...shapes];
            newShapes.splice(selectedShapeIndex, 1);
            setShapes(newShapes);
            setSelectedShapeIndex(null);
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [imageSize, selectedShapeIndex, isDrawing, shapes, moveSelectedShape, resizeSelectedShape]);

  const moveSelectedShape = (dx, dy) => {
    if (selectedShapeIndex === null) return;
    
    const newShapes = [...shapes];
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
    
    setShapes(newShapes);
  };

  const resizeSelectedShape = (scale) => {
    if (selectedShapeIndex === null) return;
    
    const newShapes = [...shapes];
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
    
    setShapes(newShapes);
  };

  const handleMouseDown = (e) => {
    if (isDrawing) {
      // Continue drawing current shape
      const pos = e.target.getStage().getPointerPosition();
      const newPoint = snapToImageBorder(pos);
      setCurrentShape([...currentShape, newPoint.x, newPoint.y]);
    } else {
      // Start a new shape
      const pos = e.target.getStage().getPointerPosition();
      setCurrentShape([pos.x, pos.y]);
      setIsDrawing(true);
      setSelectedShapeIndex(null);
    }
  };

  const handleMouseMove = (e) => {
    if (!isDrawing) return;
    
    // Add point for freeform drawing
    const pos = e.target.getStage().getPointerPosition();
    const newPoint = snapToImageBorder(pos);
    setCurrentShape([...currentShape, newPoint.x, newPoint.y]);
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
        // Close the shape
        const closedShape = [...currentShape, firstX, firstY];
        setShapes([...shapes, { points: closedShape, closed: true }]);
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
    
    // Draw all shapes
    shapes.forEach(shape => {
      if (!shape.closed) return;
      
      ctx.beginPath();
      ctx.moveTo(shape.points[0], shape.points[1]);
      
      for (let i = 2; i < shape.points.length; i += 2) {
        ctx.lineTo(shape.points[i], shape.points[i + 1]);
      }
      
      ctx.fill();
    });
    
    return canvas.toDataURL();
  };

  const handleSaveMask = async () => {
    try {
      setUploadStatus('uploading');
      const maskData = generateMask();
      
      if (!maskData) {
        setError('Failed to generate mask');
        setUploadStatus('error');
        return;
      }
      
      const result = await uploadMask(puppetId, maskData);
      
      if (result.success) {
        setUploadStatus('success');
      } else {
        setUploadStatus('error');
        setError('Failed to upload mask');
      }
    } catch (err) {
      setUploadStatus('error');
      setError('Failed to save mask: ' + err.message);
      console.error('Error saving mask:', err);
    }
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

      <div className="flex-1 overflow-hidden bg-gray-900 flex justify-center items-center relative">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white"></div>
          </div>
        ) : error ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded absolute top-4 right-4" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        ) : frameImage ? (
          <div className="relative">
            <Stage
              ref={stageRef}
              width={imageSize.width}
              height={imageSize.height}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
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
                  stroke={selectedShapeIndex === null ? 'yellow' : 'blue'}
                  strokeWidth={2}
                  onClick={() => setSelectedShapeIndex(null)}
                />
                
                {/* Completed shapes */}
                {shapes.map((shape, i) => (
                  <Line
                    key={i}
                    points={shape.points}
                    fill={transparent ? 'rgba(0, 0, 255, 0.3)' : 'black'}
                    stroke={selectedShapeIndex === i ? 'yellow' : 'blue'}
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
              <li>Esc: Cancel current shape / Deselect</li>
              <li>Delete: Remove selected shape</li>
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