# Face Symmetry Analyzer

![Face Symmetry Analyzer](test.png)

A lightweight web application that analyzes facial symmetry from uploaded photos. All processing happens locally in your browser - no images are uploaded or stored.

## Features

- **Image Upload**: Accept JPG/PNG images via click or drag-and-drop
- **Face Detection**: Automatically detects faces using face-api.js
- **Symmetry Analysis**: Calculates a 0-100 symmetry score based on facial landmarks
- **Visual Overlay**: Displays midline and landmark points to show how the score was calculated
- **Privacy-First**: All processing happens client-side - no server, no storage

For detailed testing instructions, see [TESTING.md](TESTING.md).

## Technical Details

- **Tech Stack**: HTML5, CSS3, JavaScript (ES6+)
- **Face Detection**: face-api.js (TinyFaceDetector + 68-point landmarks)
- **Symmetry Algorithm**: 
  - Calculates vertical midline from nose tip and chin
  - Mirrors key landmarks across midline
  - Computes average deviation normalized by face width
  - Converts to 0-100 score

## Browser Requirements

- Modern browser with JavaScript enabled
- Internet connection (for loading face-api.js models on first use)
- WebAssembly support (available in all modern browsers)

## Privacy

All image processing happens entirely in your browser. No images are uploaded to any server, and no data is stored. The face detection models are loaded from CDN but run locally.

## License

See LICENSE file for details.
