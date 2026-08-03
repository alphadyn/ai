# Car Sketch Project

Convert car photos to beautiful pencil sketch artwork.

## Features

- **Pencil Sketch Effect** - Traditional pencil drawing style using blend modes
- **Edge Detection** - Clean line art using Canny edge detection
- **Cartoon Style** - Posterized cartoon effect with edge overlay
- **Batch Processing** - Process multiple images with custom output names

## Usage

### Basic Usage

Generate a pencil sketch from a car image:

```bash
python3 generate_sketch.py porsche_911.jpg
```

This creates `porsche_911_sketch.png` in the same folder.

### Advanced Usage

Specify output path and sketch style:

```bash
python3 generate_sketch.py input.jpg output.png edge
```

**Sketch Styles:**
- `pencil` (default) - Traditional pencil drawing effect
- `edge` - Line art with edge detection
- `cartoon` - Posterized cartoon effect

## Files

- `porsche_911.jpg` - Original Porsche 911 convertible photo
- `porsche_911_sketch.png` - Generated pencil sketch output
- `generate_sketch.py` - Python script for sketch generation
- `README.md` - This file

## Requirements

- Python 3.7+
- OpenCV (`opencv-python`)
- NumPy

Install dependencies:

```bash
pip3 install opencv-python numpy pillow
```

## Generated Report

```bash
python3 ../car_sketch_project/generate_report.py
```

This creates [generated_report.html](generated_report.html) with a project overview.

## Technical Details

The pencil sketch effect works by:
1. Converting the image to grayscale
2. Inverting the grayscale image
3. Applying Gaussian blur to the inverted image
4. Using blend division to create the sketch effect
5. Enhancing edges with sharpening filters
6. Normalizing to 0-255 range for output

This produces a realistic pencil drawing appearance while preserving fine details from the original image.
