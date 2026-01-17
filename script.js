// Global variables
let faceApiLoaded = false;
let modelsLoaded = false;

// Initialize face-api.js models
async function loadModels() {
    if (modelsLoaded) return;
    
    // Try multiple CDN sources in order of reliability
    const cdnSources = [
        'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/',
        'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights/',
        'https://unpkg.com/face-api.js@0.22.2/weights/'
    ];
    
    for (const modelBaseUrl of cdnSources) {
        try {
            console.log(`Attempting to load models from: ${modelBaseUrl}`);
            await faceapi.nets.tinyFaceDetector.loadFromUri(modelBaseUrl);
            await faceapi.nets.faceLandmark68Net.loadFromUri(modelBaseUrl);
            modelsLoaded = true;
            console.log('✓ Face detection models loaded successfully');
            return;
        } catch (error) {
            console.warn(`✗ Failed to load from ${modelBaseUrl}:`, error.message);
            continue;
        }
    }
    
    // If all CDN sources fail, show helpful error
    console.error('All CDN sources failed to load models');
    alert('Failed to load face detection models.\n\n' +
          'Possible causes:\n' +
          '• Internet connection issues\n' +
          '• CDN blocking (try a different network)\n' +
          '• Browser security settings\n\n' +
          'Please refresh the page or check your connection.');
}

// Check if face-api.js is available and load models
window.addEventListener('load', () => {
    if (typeof faceapi !== 'undefined') {
        faceApiLoaded = true;
        // Load models in background
        loadModels().catch(err => {
            console.error('Model loading failed:', err);
        });
    } else {
        console.error('face-api.js not loaded');
        alert('Failed to load face detection library. Please check your internet connection and refresh the page.');
    }
});

// DOM elements
const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const resultSection = document.getElementById('resultSection');
const loading = document.getElementById('loading');
const resultCanvas = document.getElementById('resultCanvas');
const canvasContainer = document.getElementById('canvasContainer');
const scoreValue = document.getElementById('scoreValue');
const scoreLabel = document.getElementById('scoreLabel');
const resetBtn = document.getElementById('resetBtn');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const zoomResetBtn = document.getElementById('zoomResetBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const toggleDotsBtn = document.getElementById('toggleDotsBtn');
const fullscreenModal = document.getElementById('fullscreenModal');
const fullscreenCanvas = document.getElementById('fullscreenCanvas');
const fullscreenCanvasContainer = document.getElementById('fullscreenCanvasContainer');
const closeFullscreenBtn = document.getElementById('closeFullscreenBtn');
const fsToggleDotsBtn = document.getElementById('fsToggleDotsBtn');
const fsZoomInBtn = document.getElementById('fsZoomInBtn');
const fsZoomOutBtn = document.getElementById('fsZoomOutBtn');
const fsZoomResetBtn = document.getElementById('fsZoomResetBtn');

// Global state
let showDots = true;
let originalImage = null;
let landmarkData = null;
let scoreData = null;

// Zoom and pan state for main canvas
let zoomLevel = 1;
let panX = 0;
let panY = 0;
let isDragging = false;
let lastPanX = 0;
let lastPanY = 0;
let startX = 0;
let startY = 0;
let lastTouchDistance = 0;

// Zoom and pan state for fullscreen canvas
let fsZoomLevel = 1;
let fsPanX = 0;
let fsPanY = 0;
let fsIsDragging = false;
let fsStartX = 0;
let fsStartY = 0;
let fsLastTouchDistance = 0;

// Upload area click handler
uploadArea.addEventListener('click', () => {
    fileInput.click();
});

// Drag and drop handlers
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
});

// File input change handler
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

// Handle file upload
function handleFile(file) {
    // Validate file type
    if (!file.type.match(/^image\/(jpeg|jpg|png)$/)) {
        alert('Please upload a JPG or PNG image.');
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        const imageUrl = e.target.result;
        await processImage(imageUrl);
    };
    reader.readAsDataURL(file);
}

// Process image and calculate symmetry
async function processImage(imageUrl) {
    // Show loading, hide upload area
    loading.style.display = 'block';
    uploadArea.style.display = 'none';
    resultSection.style.display = 'none';

    // Wait for models to load
    if (!modelsLoaded) {
        await loadModels();
    }

    try {
        // Create image element
        const img = new Image();
        img.src = imageUrl;

        await new Promise((resolve) => {
            img.onload = resolve;
        });

        // Detect face and landmarks
        const detection = await faceapi
            .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks();

        if (!detection) {
            alert('No face detected in the image. Please upload a photo with a clear face.');
            loading.style.display = 'none';
            uploadArea.style.display = 'block';
            return;
        }

        // Calculate symmetry score
        const score = calculateSymmetryScore(detection.landmarks, img.width, img.height);

        // Display results
        displayResults(img, detection.landmarks, score);

    } catch (error) {
        console.error('Error processing image:', error);
        alert('An error occurred while processing the image. Please try again.');
        loading.style.display = 'none';
        uploadArea.style.display = 'block';
    }
}

// Calculate symmetry score from landmarks
function calculateSymmetryScore(landmarks, imgWidth, imgHeight) {
    const positions = landmarks.positions;
    
    // Find the vertical midline of the face
    // Use nose tip and chin point to determine midline
    const noseTip = positions[30]; // Nose tip
    const chin = positions[8]; // Chin
    
    // Calculate midline x-coordinate
    const midlineX = (noseTip.x + chin.x) / 2;
    
    // Calculate face width for normalization
    const leftCheek = positions[1];
    const rightCheek = positions[15];
    const faceWidth = Math.abs(rightCheek.x - leftCheek.x);
    
    // Store symmetric pairs for visualization
    const symmetricPairs = [];
    
    // Mirror points across midline and calculate deviations
    const deviations = [];
    
    // Jaw points (0-16, symmetric pairs)
    const jawPairs = [
        [0, 16], [1, 15], [2, 14], [3, 13], [4, 12], [5, 11], [6, 10], [7, 9]
    ];
    jawPairs.forEach(([leftIdx, rightIdx]) => {
        const left = positions[leftIdx];
        const right = positions[rightIdx];
        const leftDist = Math.abs(left.x - midlineX);
        const rightDist = Math.abs(right.x - midlineX);
        deviations.push(Math.abs(leftDist - rightDist) / faceWidth);
        symmetricPairs.push({ left: leftIdx, right: rightIdx, type: 'jaw' });
    });
    
    // Eyebrow points (17-21 right, 22-26 left - mirrored)
    const eyebrowPairs = [
        [17, 26], [18, 25], [19, 24], [20, 23], [21, 22]
    ];
    eyebrowPairs.forEach(([leftIdx, rightIdx]) => {
        const left = positions[leftIdx];
        const right = positions[rightIdx];
        const leftDist = Math.abs(left.x - midlineX);
        const rightDist = Math.abs(right.x - midlineX);
        deviations.push(Math.abs(leftDist - rightDist) / faceWidth);
        symmetricPairs.push({ left: leftIdx, right: rightIdx, type: 'eyebrow' });
    });
    
    // Eye points (36-41 right eye, 42-47 left eye - mirrored)
    const eyePairs = [
        [36, 45], [37, 44], [38, 43], [39, 42], [40, 47], [41, 46]
    ];
    eyePairs.forEach(([leftIdx, rightIdx]) => {
        const left = positions[leftIdx];
        const right = positions[rightIdx];
        const leftDist = Math.abs(left.x - midlineX);
        const rightDist = Math.abs(right.x - midlineX);
        deviations.push(Math.abs(leftDist - rightDist) / faceWidth);
        symmetricPairs.push({ left: leftIdx, right: rightIdx, type: 'eye' });
    });
    
    // Nose points (27-35, using symmetric pairs)
    const nosePairs = [
        [31, 35], [32, 34] // Nose wings
    ];
    nosePairs.forEach(([leftIdx, rightIdx]) => {
        const left = positions[leftIdx];
        const right = positions[rightIdx];
        const leftDist = Math.abs(left.x - midlineX);
        const rightDist = Math.abs(right.x - midlineX);
        deviations.push(Math.abs(leftDist - rightDist) / faceWidth);
        symmetricPairs.push({ left: leftIdx, right: rightIdx, type: 'nose' });
    });
    
    // Mouth points (48-67, symmetric pairs)
    const mouthPairs = [
        [48, 54], [49, 53], [50, 52], [60, 64], [61, 63]
    ];
    mouthPairs.forEach(([leftIdx, rightIdx]) => {
        const left = positions[leftIdx];
        const right = positions[rightIdx];
        const leftDist = Math.abs(left.x - midlineX);
        const rightDist = Math.abs(right.x - midlineX);
        deviations.push(Math.abs(leftDist - rightDist) / faceWidth);
        symmetricPairs.push({ left: leftIdx, right: rightIdx, type: 'mouth' });
    });
    
    // Calculate average deviation
    const avgDeviation = deviations.reduce((sum, d) => sum + d, 0) / deviations.length;
    
    // Convert deviation to symmetry score (0-100)
    // Lower deviation = higher score
    // Use exponential scaling for better distribution
    const score = Math.max(0, Math.min(100, (1 - avgDeviation * 2) * 100));
    
    return {
        score: Math.round(score),
        midlineX: midlineX,
        faceWidth: faceWidth,
        symmetricPairs: symmetricPairs,
        positions: positions
    };
}

// Apply zoom and pan transformations
function applyTransform() {
    resultCanvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
    if (zoomLevel > 1 || panX !== 0 || panY !== 0) {
        canvasContainer.classList.add('zoomed');
    } else {
        canvasContainer.classList.remove('zoomed');
    }
}

// Zoom functions
function zoomIn() {
    const rect = canvasContainer.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const zoomBefore = zoomLevel;
    zoomLevel = Math.min(zoomLevel * 1.2, 5);
    
    if (zoomLevel > 1) {
        const zoomChange = zoomLevel / zoomBefore;
        panX = centerX - (centerX - panX) * zoomChange;
        panY = centerY - (centerY - panY) * zoomChange;
    }
    
    applyTransform();
}

function zoomOut() {
    const rect = canvasContainer.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const zoomBefore = zoomLevel;
    zoomLevel = Math.max(zoomLevel / 1.2, 1);
    
    if (zoomLevel > 1) {
        const zoomChange = zoomLevel / zoomBefore;
        panX = centerX - (centerX - panX) * zoomChange;
        panY = centerY - (centerY - panY) * zoomChange;
    } else {
        panX = 0;
        panY = 0;
    }
    
    applyTransform();
}

function resetZoom() {
    zoomLevel = 1;
    panX = 0;
    panY = 0;
    applyTransform();
}

// Calculate distance between two touch points
function getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

// Get center point between two touches
function getTouchCenter(touches) {
    return {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2
    };
}

// Draw canvas with or without dots
function drawCanvas(canvas, showDotsFlag) {
    if (!originalImage || !scoreData) return;
    
    canvas.width = originalImage.width;
    canvas.height = originalImage.height;
    
    const ctx = canvas.getContext('2d');
    
    // Draw original image
    ctx.drawImage(originalImage, 0, 0);
    
    // Draw midline
    ctx.strokeStyle = '#1d1d1f';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(scoreData.midlineX, 0);
    ctx.lineTo(scoreData.midlineX, originalImage.height);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    
    if (showDotsFlag) {
        // Draw symmetric connection lines
        const positions = scoreData.positions;
        const colorMap = {
            'jaw': '#86868b',
            'eyebrow': '#4ecdc4',
            'eye': '#ff6b6b',
            'nose': '#ffd93d',
            'mouth': '#95e1d3'
        };
        
        // Draw lines connecting symmetric pairs
        scoreData.symmetricPairs.forEach(pair => {
            const leftPoint = positions[pair.left];
            const rightPoint = positions[pair.right];
            const color = colorMap[pair.type] || '#86868b';
            
            // Draw line connecting symmetric points
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.moveTo(leftPoint.x, leftPoint.y);
            ctx.lineTo(rightPoint.x, rightPoint.y);
            ctx.stroke();
        });
        
        ctx.globalAlpha = 1;
        
        // Draw all landmark points with different colors by type
        scoreData.symmetricPairs.forEach(pair => {
            const color = colorMap[pair.type] || '#86868b';
            ctx.fillStyle = color;
            
            // Draw left point
            const leftPoint = positions[pair.left];
            ctx.beginPath();
            ctx.arc(leftPoint.x, leftPoint.y, 3, 0, 2 * Math.PI);
            ctx.fill();
            
            // Draw right point
            const rightPoint = positions[pair.right];
            ctx.beginPath();
            ctx.arc(rightPoint.x, rightPoint.y, 3, 0, 2 * Math.PI);
            ctx.fill();
        });
        
        // Draw remaining points (non-symmetric, like nose tip)
        ctx.fillStyle = '#1d1d1f';
        const allIndices = new Set();
        scoreData.symmetricPairs.forEach(pair => {
            allIndices.add(pair.left);
            allIndices.add(pair.right);
        });
        
        positions.forEach((point, index) => {
            if (!allIndices.has(index)) {
                ctx.beginPath();
                ctx.arc(point.x, point.y, 2.5, 0, 2 * Math.PI);
                ctx.fill();
            }
        });
        
        // Highlight key symmetry points with larger circles
        const keyPoints = [
            { index: 36, color: '#ff6b6b' }, // Left eye outer
            { index: 45, color: '#4ecdc4' }, // Right eye outer
            { index: 48, color: '#ff6b6b' }, // Left mouth
            { index: 54, color: '#4ecdc4' }, // Right mouth
            { index: 30, color: '#ffd93d' }, // Nose tip
        ];
        
        keyPoints.forEach(({ index, color }) => {
            const point = positions[index];
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
            ctx.fill();
        });
    }
}

// Display results with visual overlay
function displayResults(img, landmarks, scoreDataResult) {
    // Store globally for redrawing
    originalImage = img;
    scoreData = scoreDataResult;
    
    // Reset zoom and pan
    zoomLevel = 1;
    panX = 0;
    panY = 0;
    fsZoomLevel = 1;
    fsPanX = 0;
    fsPanY = 0;
    
    // Draw main canvas
    drawCanvas(resultCanvas, showDots);
    
    // Apply initial transform
    applyTransform();
    
    // Initialize toggle button state
    if (toggleDotsBtn) {
        toggleDotsBtn.classList.toggle('active', showDots);
    }
    
    // Display score as fraction
    scoreValue.textContent = `${scoreData.score}/100`;
    scoreLabel.textContent = getScoreLabel(scoreData.score);
    
    // Show results, hide loading
    loading.style.display = 'none';
    resultSection.style.display = 'block';
}

// Get descriptive label for score
function getScoreLabel(score) {
    if (score >= 90) return 'Highly Symmetrical';
    if (score >= 75) return 'Very Symmetrical';
    if (score >= 60) return 'Moderately Symmetrical';
    if (score >= 45) return 'Somewhat Asymmetrical';
    return 'Asymmetrical';
}

// Zoom button handlers
zoomInBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    zoomIn();
});

zoomOutBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    zoomOut();
});

zoomResetBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resetZoom();
});

// Mouse wheel zoom
canvasContainer.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const rect = canvasContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const zoomBefore = zoomLevel;
    zoomLevel = Math.max(1, Math.min(zoomLevel * delta, 5));
    
    if (zoomLevel > 1) {
        const zoomChange = zoomLevel / zoomBefore;
        panX = x - (x - panX) * zoomChange;
        panY = y - (y - panY) * zoomChange;
    } else {
        panX = 0;
        panY = 0;
    }
    
    applyTransform();
}, { passive: false });

// Mouse drag to pan
canvasContainer.addEventListener('mousedown', (e) => {
    if (zoomLevel > 1 && e.button === 0) {
        isDragging = true;
        startX = e.clientX - panX;
        startY = e.clientY - panY;
        canvasContainer.style.cursor = 'grabbing';
    }
});

canvasContainer.addEventListener('mousemove', (e) => {
    if (isDragging) {
        panX = e.clientX - startX;
        panY = e.clientY - startY;
        applyTransform();
    }
});

canvasContainer.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        justDragged = true;
        canvasContainer.style.cursor = zoomLevel > 1 ? 'grab' : 'default';
        // Reset justDragged after a short delay
        setTimeout(() => {
            justDragged = false;
        }, 100);
    }
});

canvasContainer.addEventListener('mouseleave', () => {
    if (isDragging) {
        isDragging = false;
        canvasContainer.style.cursor = zoomLevel > 1 ? 'grab' : 'default';
    }
});

// Touch events for mobile
let lastTouches = [];

canvasContainer.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
        // Single touch - pan
        const touch = e.touches[0];
        startX = touch.clientX - panX;
        startY = touch.clientY - panY;
        isDragging = true;
    } else if (e.touches.length === 2) {
        // Two touches - pinch zoom
        isDragging = false;
        lastTouchDistance = getTouchDistance(e.touches);
        lastTouches = Array.from(e.touches);
    }
}, { passive: false });

canvasContainer.addEventListener('touchmove', (e) => {
    e.preventDefault();
    
    if (e.touches.length === 1 && isDragging) {
        // Single touch - pan
        const touch = e.touches[0];
        panX = touch.clientX - startX;
        panY = touch.clientY - startY;
        applyTransform();
    } else if (e.touches.length === 2) {
        // Two touches - pinch zoom
        isDragging = false;
        const currentDistance = getTouchDistance(e.touches);
        const center = getTouchCenter(e.touches);
        const rect = canvasContainer.getBoundingClientRect();
        const centerX = center.x - rect.left;
        const centerY = center.y - rect.top;
        
        if (lastTouchDistance > 0) {
            const scale = currentDistance / lastTouchDistance;
            const zoomBefore = zoomLevel;
            zoomLevel = Math.max(1, Math.min(zoomLevel * scale, 5));
            
            if (zoomLevel > 1) {
                const zoomChange = zoomLevel / zoomBefore;
                panX = centerX - (centerX - panX) * zoomChange;
                panY = centerY - (centerY - panY) * zoomChange;
            } else {
                panX = 0;
                panY = 0;
            }
            
            applyTransform();
        }
        
        lastTouchDistance = currentDistance;
    }
}, { passive: false });

canvasContainer.addEventListener('touchend', () => {
    isDragging = false;
    lastTouchDistance = 0;
    lastTouches = [];
});

// Prevent zoom buttons from triggering canvas interactions
[zoomInBtn, zoomOutBtn, zoomResetBtn].forEach(btn => {
    btn.addEventListener('touchstart', (e) => e.stopPropagation());
    btn.addEventListener('touchmove', (e) => e.stopPropagation());
    btn.addEventListener('touchend', (e) => e.stopPropagation());
});

// Toggle dots function
function toggleDots() {
    showDots = !showDots;
    drawCanvas(resultCanvas, showDots);
    drawCanvas(fullscreenCanvas, showDots);
    
    // Update button states
    if (toggleDotsBtn) {
        toggleDotsBtn.classList.toggle('active', showDots);
    }
    if (fsToggleDotsBtn) {
        fsToggleDotsBtn.classList.toggle('active', showDots);
    }
}

// Fullscreen functions
function openFullscreen() {
    if (!originalImage || !scoreData) return;
    
    fullscreenModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Reset fullscreen zoom/pan
    fsZoomLevel = 1;
    fsPanX = 0;
    fsPanY = 0;
    
    // Draw fullscreen canvas
    drawCanvas(fullscreenCanvas, showDots);
    applyFullscreenTransform();
}

function closeFullscreen() {
    fullscreenModal.style.display = 'none';
    document.body.style.overflow = '';
}

// Apply fullscreen transform
function applyFullscreenTransform() {
    fullscreenCanvas.style.transform = `translate(${fsPanX}px, ${fsPanY}px) scale(${fsZoomLevel})`;
}

// Fullscreen zoom functions
function fsZoomIn() {
    const rect = fullscreenCanvasContainer.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const zoomBefore = fsZoomLevel;
    fsZoomLevel = Math.min(fsZoomLevel * 1.2, 5);
    
    if (fsZoomLevel > 1) {
        const zoomChange = fsZoomLevel / zoomBefore;
        fsPanX = centerX - (centerX - fsPanX) * zoomChange;
        fsPanY = centerY - (centerY - fsPanY) * zoomChange;
    }
    
    applyFullscreenTransform();
}

function fsZoomOut() {
    const rect = fullscreenCanvasContainer.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const zoomBefore = fsZoomLevel;
    fsZoomLevel = Math.max(fsZoomLevel / 1.2, 1);
    
    if (fsZoomLevel > 1) {
        const zoomChange = fsZoomLevel / zoomBefore;
        fsPanX = centerX - (centerX - fsPanX) * zoomChange;
        fsPanY = centerY - (centerY - fsPanY) * zoomChange;
    } else {
        fsPanX = 0;
        fsPanY = 0;
    }
    
    applyFullscreenTransform();
}

function fsResetZoom() {
    fsZoomLevel = 1;
    fsPanX = 0;
    fsPanY = 0;
    applyFullscreenTransform();
}

// Event listeners
fullscreenBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openFullscreen();
});

// Track if we just finished dragging to prevent accidental fullscreen
let justDragged = false;

// Click canvas to open fullscreen
canvasContainer.addEventListener('click', (e) => {
    // Only open if not clicking on buttons and didn't just drag
    if (!e.target.closest('.zoom-controls') && !e.target.closest('.canvas-actions') && !justDragged) {
        openFullscreen();
    }
    justDragged = false;
});

closeFullscreenBtn.addEventListener('click', closeFullscreen);
toggleDotsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDots();
});
fsToggleDotsBtn.addEventListener('click', toggleDots);
fsZoomInBtn.addEventListener('click', fsZoomIn);
fsZoomOutBtn.addEventListener('click', fsZoomOut);
fsZoomResetBtn.addEventListener('click', fsResetZoom);

// Close fullscreen on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && fullscreenModal.style.display === 'flex') {
        closeFullscreen();
    }
});

// Fullscreen mouse wheel zoom
fullscreenCanvasContainer.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const rect = fullscreenCanvasContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const zoomBefore = fsZoomLevel;
    fsZoomLevel = Math.max(1, Math.min(fsZoomLevel * delta, 5));
    
    if (fsZoomLevel > 1) {
        const zoomChange = fsZoomLevel / zoomBefore;
        fsPanX = x - (x - fsPanX) * zoomChange;
        fsPanY = y - (y - fsPanY) * zoomChange;
    } else {
        fsPanX = 0;
        fsPanY = 0;
    }
    
    applyFullscreenTransform();
}, { passive: false });

// Fullscreen mouse drag to pan
fullscreenCanvasContainer.addEventListener('mousedown', (e) => {
    if (fsZoomLevel > 1 && e.button === 0) {
        fsIsDragging = true;
        fsStartX = e.clientX - fsPanX;
        fsStartY = e.clientY - fsPanY;
        fullscreenCanvasContainer.style.cursor = 'grabbing';
    }
});

fullscreenCanvasContainer.addEventListener('mousemove', (e) => {
    if (fsIsDragging) {
        fsPanX = e.clientX - fsStartX;
        fsPanY = e.clientY - fsStartY;
        applyFullscreenTransform();
    }
});

fullscreenCanvasContainer.addEventListener('mouseup', () => {
    if (fsIsDragging) {
        fsIsDragging = false;
        fullscreenCanvasContainer.style.cursor = fsZoomLevel > 1 ? 'grab' : 'default';
    }
});

// Fullscreen touch events
let fsLastTouches = [];

fullscreenCanvasContainer.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
        const touch = e.touches[0];
        fsStartX = touch.clientX - fsPanX;
        fsStartY = touch.clientY - fsPanY;
        fsIsDragging = true;
    } else if (e.touches.length === 2) {
        fsIsDragging = false;
        fsLastTouchDistance = getTouchDistance(e.touches);
        fsLastTouches = Array.from(e.touches);
    }
}, { passive: false });

fullscreenCanvasContainer.addEventListener('touchmove', (e) => {
    e.preventDefault();
    
    if (e.touches.length === 1 && fsIsDragging) {
        const touch = e.touches[0];
        fsPanX = touch.clientX - fsStartX;
        fsPanY = touch.clientY - fsStartY;
        applyFullscreenTransform();
    } else if (e.touches.length === 2) {
        fsIsDragging = false;
        const currentDistance = getTouchDistance(e.touches);
        const center = getTouchCenter(e.touches);
        const rect = fullscreenCanvasContainer.getBoundingClientRect();
        const centerX = center.x - rect.left;
        const centerY = center.y - rect.top;
        
        if (fsLastTouchDistance > 0) {
            const scale = currentDistance / fsLastTouchDistance;
            const zoomBefore = fsZoomLevel;
            fsZoomLevel = Math.max(1, Math.min(fsZoomLevel * scale, 5));
            
            if (fsZoomLevel > 1) {
                const zoomChange = fsZoomLevel / zoomBefore;
                fsPanX = centerX - (centerX - fsPanX) * zoomChange;
                fsPanY = centerY - (centerY - fsPanY) * zoomChange;
            } else {
                fsPanX = 0;
                fsPanY = 0;
            }
            
            applyFullscreenTransform();
        }
        
        fsLastTouchDistance = currentDistance;
    }
}, { passive: false });

fullscreenCanvasContainer.addEventListener('touchend', () => {
    fsIsDragging = false;
    fsLastTouchDistance = 0;
    fsLastTouches = [];
});

// Reset button handler
resetBtn.addEventListener('click', () => {
    resetZoom();
    closeFullscreen();
    resultSection.style.display = 'none';
    uploadArea.style.display = 'block';
    fileInput.value = '';
    showDots = true;
    originalImage = null;
    scoreData = null;
});

