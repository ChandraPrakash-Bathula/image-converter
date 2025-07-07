import React, { useState, useRef, useCallback } from 'react';
import { Upload, Download, RefreshCw, Sun, Moon, ImageIcon, AlertCircle } from 'lucide-react';

// Custom hook for theme management
const useTheme = () => {
  const [isDark, setIsDark] = useState(true);
  
  const toggleTheme = () => setIsDark(!isDark);
  
 const themeClasses = isDark
    ? 'bg-gray-900 text-white'
    : 'bg-gradient-to-br from-black via-neutral-900 to-black text-white';

  const glassMorphism = isDark
    ? 'bg-black/20 backdrop-blur-xl border border-white/10'
    : 'bg-white/10 backdrop-blur-xl border border-white/10';


 return { isDark, toggleTheme, themeClasses, glassMorphism };
};
// Custom hook for file operations
const useFileOperations = () => {
  const [currentFile, setCurrentFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [originalFileType, setOriginalFileType] = useState(null);
  const [error, setError] = useState('');

  const SUPPORTED_FORMATS = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 
    'image/bmp', 'image/webp', 'image/tiff', 'image/svg+xml'
  ];

  const validateFile = (file) => {
    if (!file) return false;
    
    if (!SUPPORTED_FORMATS.includes(file.type)) {
      setError(`Unsupported format: ${file.type}. Please use JPG, PNG, GIF, BMP, WebP, TIFF, or SVG.`);
      return false;
    }
    
    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      setError('File size too large. Please use files smaller than 50MB.');
      return false;
    }
    
    setError('');
    return true;
  };

  const handleFile = (file) => {
    if (!validateFile(file)) return;
    
    setCurrentFile(file);
    setOriginalFileType(file.type);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target.result);
    };
    reader.onerror = () => {
      setError('Failed to read file. Please try again.');
    };
    reader.readAsDataURL(file);
  };

  const resetFile = () => {
    setCurrentFile(null);
    setPreviewUrl(null);
    setOriginalFileType(null);
    setError('');
  };

  return {
    currentFile,
    previewUrl,
    originalFileType,
    error,
    handleFile,
    resetFile,
    SUPPORTED_FORMATS
  };
};

// Custom hook for image conversion
const useImageConverter = () => {
  const [convertedBlob, setConvertedBlob] = useState(null);
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [conversionInfo, setConversionInfo] = useState('');
  const [error, setError] = useState('');

  const convertImage = async (file, outputFormat, quality, originalFileType) => {
    if (!file) return;

    setIsConverting(true);
    setProgress(0);
    setStatusMessage('Processing image...');
    setError('');

    try {
      let convertedBlob;

      // Handle animated GIFs specially
      if (originalFileType === 'image/gif' && outputFormat === 'gif') {
        // Keep original GIF with all frames
        convertedBlob = file;
        setProgress(100);
        setStatusMessage('GIF preserved with all frames!');
      } else if (originalFileType === 'image/gif' && outputFormat !== 'gif') {
        // Convert GIF to static image (first frame)
        convertedBlob = await convertGifToStatic(file, outputFormat, quality);
      } else if (originalFileType === 'image/svg+xml') {
        // Handle SVG conversion
        convertedBlob = await convertSvgToRaster(file, outputFormat, quality);
      } else {
        // Regular image conversion
        convertedBlob = await convertRegularImage(file, outputFormat, quality);
      }

      const originalSize = file.size;
      const newSize = convertedBlob.size;
      const compressionRatio = ((originalSize - newSize) / originalSize * 100).toFixed(1);

      setTimeout(() => {
        setProgress(100);
        setStatusMessage('Conversion completed!');
        
        setTimeout(() => {
          const originalSizeMB = (originalSize / 1024 / 1024).toFixed(2);
          const newSizeMB = (newSize / 1024 / 1024).toFixed(2);
          const originalFormatName = originalFileType.split('/')[1].toUpperCase();
          const newFormatName = outputFormat.toUpperCase();
          
          setConversionInfo(`${originalFormatName} → ${newFormatName} | Original: ${originalSizeMB} MB | New: ${newSizeMB} MB | ${compressionRatio > 0 ? `Compressed by ${compressionRatio}%` : `Expanded by ${Math.abs(compressionRatio)}%`}`);
          
          setConvertedBlob(convertedBlob);
          setIsConverting(false);
          setStatusMessage('');
          setProgress(0);
        }, 500);
      }, 300);

    } catch (err) {
      console.error('Conversion failed:', err);
      setError('Conversion failed. The image format may not be supported or the file may be corrupted.');
      setIsConverting(false);
      setProgress(0);
      setStatusMessage('');
    }
  };

  const convertRegularImage = async (file, outputFormat, quality) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });

    setProgress(30);
    setStatusMessage('Analyzing image properties...');

    canvas.width = img.width;
    canvas.height = img.height;
    
    // Handle transparency for formats that don't support it
    if (outputFormat === 'jpeg' || outputFormat === 'bmp') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    ctx.drawImage(img, 0, 0);
    
    setProgress(60);
    setStatusMessage(`Converting to ${outputFormat.toUpperCase()}...`);

    const convertedBlob = await new Promise((resolve, reject) => {
      const mimeType = `image/${outputFormat}`;
      const callback = (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to convert image'));
      };
      
      if (outputFormat === 'jpeg' || outputFormat === 'webp') {
        canvas.toBlob(callback, mimeType, quality / 100);
      } else {
        canvas.toBlob(callback, mimeType);
      }
    });

    URL.revokeObjectURL(img.src);
    return convertedBlob;
  };

  const convertGifToStatic = async (file, outputFormat, quality) => {
    setProgress(40);
    setStatusMessage('Converting GIF to static image (first frame)...');
    
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Failed to load GIF'));
      img.src = URL.createObjectURL(file);
    });

    canvas.width = img.width;
    canvas.height = img.height;
    
    if (outputFormat === 'jpeg' || outputFormat === 'bmp') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    ctx.drawImage(img, 0, 0);
    
    setProgress(80);
    setStatusMessage('Finalizing static image...');

    const convertedBlob = await new Promise((resolve, reject) => {
      const mimeType = `image/${outputFormat}`;
      const callback = (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to convert GIF'));
      };
      
      if (outputFormat === 'jpeg' || outputFormat === 'webp') {
        canvas.toBlob(callback, mimeType, quality / 100);
      } else {
        canvas.toBlob(callback, mimeType);
      }
    });

    URL.revokeObjectURL(img.src);
    return convertedBlob;
  };

  const convertSvgToRaster = async (file, outputFormat, quality) => {
    setProgress(40);
    setStatusMessage('Converting SVG to raster image...');
    
    const svgText = await file.text();
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Failed to load SVG'));
      const blob = new Blob([svgText], { type: 'image/svg+xml' });
      img.src = URL.createObjectURL(blob);
    });

    // Set default size if SVG doesn't have explicit dimensions
    const width = img.width || 800;
    const height = img.height || 600;
    
    canvas.width = width;
    canvas.height = height;
    
    if (outputFormat === 'jpeg' || outputFormat === 'bmp') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    ctx.drawImage(img, 0, 0);
    
    setProgress(80);
    setStatusMessage('Finalizing raster image...');

    const convertedBlob = await new Promise((resolve, reject) => {
      const mimeType = `image/${outputFormat}`;
      const callback = (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to convert SVG'));
      };
      
      if (outputFormat === 'jpeg' || outputFormat === 'webp') {
        canvas.toBlob(callback, mimeType, quality / 100);
      } else {
        canvas.toBlob(callback, mimeType);
      }
    });

    URL.revokeObjectURL(img.src);
    return convertedBlob;
  };

  const resetConverter = () => {
    setConvertedBlob(null);
    setIsConverting(false);
    setProgress(0);
    setStatusMessage('');
    setConversionInfo('');
    setError('');
  };

  return {
    convertedBlob,
    isConverting,
    progress,
    statusMessage,
    conversionInfo,
    error,
    convertImage,
    resetConverter
  };
};

// Custom hook for drag and drop
const useDragAndDrop = (onFileSelect) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      onFileSelect(files[0]);
    }
  }, [onFileSelect]);

  return {
    isDragOver,
    handleDragOver,
    handleDragLeave,
    handleDrop
  };
};

const ImageConverter = () => {
  const { isDark, toggleTheme, themeClasses, glassMorphism } = useTheme();
  const { 
    currentFile, 
    previewUrl, 
    originalFileType, 
    error: fileError, 
    handleFile, 
    resetFile 
  } = useFileOperations();
  const { 
    convertedBlob, 
    isConverting, 
    progress, 
    statusMessage, 
    conversionInfo, 
    error: convertError, 
    convertImage, 
    resetConverter 
  } = useImageConverter();
  
  const [convertFormat, setConvertFormat] = useState('png');
  const [quality, setQuality] = useState(90);
  const fileInputRef = useRef(null);

  const { isDragOver, handleDragOver, handleDragLeave, handleDrop } = useDragAndDrop(handleFile);

  const handleFileSelect = (e) => {
    if (e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const handleConvert = () => {
    convertImage(currentFile, convertFormat, quality, originalFileType);
  };

  const downloadImage = () => {
    if (!convertedBlob) return;

    const originalName = currentFile.name.split('.')[0];
    const downloadName = `${originalName}_converted.${convertFormat}`;

    const url = URL.createObjectURL(convertedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const resetAll = () => {
    resetFile();
    resetConverter();
    setQuality(90);
    setConvertFormat('png');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const currentError = fileError || convertError;

  return (
    <div className={`min-h-screen transition-all duration-300 ${themeClasses}`}>
      <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600;700&display=swap" rel="stylesheet" />
      <script src="https://cdn.tailwindcss.com"></script>
      
      <div className="relative min-h-screen flex items-center justify-center p-5">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className={`fixed top-6 right-6 p-3 rounded-full transition-all duration-300 ${glassMorphism} hover:scale-110 z-10`}
        >
          {isDark ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
        </button>

        {/* Main Container */}
        <div className={`${glassMorphism} rounded-3xl p-8 max-w-2xl w-full shadow-2xl`} style={{ fontFamily: 'Crimson Pro, serif' }}>
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Real Image Converter
            </h1>
            <p className="text-lg opacity-80">
              Convert images with full format support including animated GIFs
            </p>
          </div>

          {/* Error Display */}
          {currentError && (
            <div className={`${glassMorphism} border border-red-500/30 rounded-2xl p-4 mb-6 flex items-center gap-3 text-red-400`}>
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{currentError}</span>
            </div>
          )}

          {/* Upload Area */}
          <div
            className={`${glassMorphism} border-2 border-dashed rounded-2xl p-10 mb-8 cursor-pointer transition-all duration-300 hover:scale-[1.02] ${
              isDragOver ? 'border-purple-400 bg-purple-500/10' : 'border-white/20 hover:border-white/40'
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="text-center">
              <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-70" />
              <div className="text-xl font-semibold mb-2">
                Drop your image here or click to browse
              </div>
              <div className="text-sm opacity-70">
                Supports JPG, PNG, GIF, BMP, WebP, TIFF, SVG (max 50MB)
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Preview */}
          {previewUrl && (
            <div className={`${glassMorphism} rounded-2xl p-6 mb-8`}>
              <img
                src={previewUrl}
                alt="Preview"
                className="max-w-full max-h-80 rounded-xl mx-auto shadow-lg"
              />
              <div className="text-center mt-4 text-sm opacity-80">
                {currentFile && (
                  <>
                    File: {currentFile.name} | Size: {(currentFile.size / 1024 / 1024).toFixed(2)} MB | 
                    Type: {currentFile.type.split('/')[1].toUpperCase()}
                    {originalFileType === 'image/gif' && (
                      <span className="block mt-1 text-yellow-400">
                        🎬 Animated GIF detected - converting to {convertFormat.toUpperCase()} will use first frame only
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Controls */}
          {currentFile && (
            <div className="flex flex-wrap gap-6 items-center justify-center mb-8">
              <div className="flex flex-col items-center">
                <label className="text-sm font-semibold mb-2 opacity-80">Original Format</label>
                <select
                  disabled
                  className={`${glassMorphism} px-4 py-3 rounded-xl text-center cursor-not-allowed opacity-70`}
                >
                  <option>{originalFileType?.split('/')[1].toUpperCase()}</option>
                </select>
              </div>

              <div className="flex flex-col items-center">
                <label className="text-sm font-semibold mb-2 opacity-80">Convert To</label>
                <select
                  value={convertFormat}
                  onChange={(e) => setConvertFormat(e.target.value)}
                  className={`${glassMorphism} px-4 py-3 rounded-xl cursor-pointer hover:bg-white/5 transition-colors`}
                >
                  <option value="png">PNG</option>
                  <option value="jpeg">JPEG</option>
                  <option value="webp">WebP</option>
                  <option value="gif">GIF</option>
                  <option value="bmp">BMP</option>
                </select>
              </div>

              {(convertFormat === 'jpeg' || convertFormat === 'webp') && (
                <div className="flex flex-col items-center">
                  <label className="text-sm font-semibold mb-2 opacity-80">Quality</label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={quality}
                    onChange={(e) => setQuality(parseInt(e.target.value))}
                    className="w-32 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="text-xs opacity-70 mt-1">{quality}%</div>
                </div>
              )}
            </div>
          )}

          {/* Convert Button */}
          {currentFile && !convertedBlob && (
            <div className="text-center mb-8">
              <button
                onClick={handleConvert}
                disabled={isConverting || !!currentError}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed px-8 py-4 rounded-2xl font-semibold text-lg transition-all duration-300 hover:scale-105 shadow-lg"
              >
                {isConverting ? (
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Converting...
                  </div>
                ) : (
                  'Convert Image'
                )}
              </button>
            </div>
          )}

          {/* Progress Bar */}
          {isConverting && (
            <div className="mb-6">
              <div className={`${glassMorphism} rounded-full h-3 overflow-hidden`}>
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {statusMessage && (
                <div className="text-center text-sm opacity-80 mt-2">{statusMessage}</div>
              )}
            </div>
          )}

          {/* Download Area */}
          {convertedBlob && (
            <div className={`${glassMorphism} rounded-2xl p-6 text-center`}>
              <div className="text-lg font-semibold mb-3 text-green-400">
                ✅ Conversion completed successfully!
              </div>
              {conversionInfo && (
                <div className={`${glassMorphism} rounded-xl p-4 mb-4 text-sm`}>
                  <strong>Conversion Details:</strong><br />
                  {conversionInfo}
                </div>
              )}
              <div className="flex gap-3 justify-center">
                <button
                  onClick={downloadImage}
                  className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 px-6 py-3 rounded-xl font-semibold transition-all duration-300 hover:scale-105 shadow-lg flex items-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Download
                </button>
                <button
                  onClick={resetAll}
                  className={`${glassMorphism} hover:bg-white/5 px-6 py-3 rounded-xl font-semibold transition-all duration-300 hover:scale-105`}
                >
                  Convert Another
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          background: linear-gradient(135deg, #a855f7, #ec4899);
          border-radius: 50%;
          cursor: pointer;
        }
        
        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          background: linear-gradient(135deg, #a855f7, #ec4899);
          border-radius: 50%;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
};

export default ImageConverter;