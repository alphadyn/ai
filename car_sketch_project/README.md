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

### Source Images
- `porsche_911.jpg` - Original high-resolution Porsche 911 convertible photo (255 KB)

### Sketch Outputs
- `Car.png` - Professional pencil sketch (3.8 MB, high-quality RGBA)
- `Car.jpg` - Professional pencil sketch in JPEG format (708 KB, compressed)
- `Car_high_quality_sketch.png` - Museum-quality sketch with advanced processing (1.0 MB)
  - Multi-scale edge detection (Canny + Sobel)
  - CLAHE contrast enhancement
  - Unsharp masking
  - Professional sharpening kernel
- `Car_sketch.png` - Abstracted line-art version (5.0 KB, high-contrast)

### Generation Scripts
- `generate_sketch.py` - Basic sketch converter with style options
- `create_and_sketch.py` - Automated image creation and sketching
- `create_realistic_sketch.py` - Realistic car image generator with professional sketch
- `setup.sh` - Project setup guide

### Documentation
- `README.md` - This file
- `generate_report.py` - HTML report generator
- `generated_report.html` - Project overview

## Test the project

Run the repository-wide test suite from the project root:

```bash
./run_tests.sh
```

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

### Pencil Sketch Effect (Car.png, Car.jpg)
The professional sketches use the classic Dodge & Burn technique:
1. Converting the image to grayscale
2. Inverting the grayscale image
3. Applying Gaussian blur (21x21) to the inverted image
4. Using blend division to create the sketch effect
5. Enhancing edges with morphological operations
6. Applying bilateral filtering to preserve edge sharpness
7. Normalizing to 0-255 range for output

This produces a realistic pencil drawing appearance while preserving fine details.

### High-Quality Sketch Effect (Car_high_quality_sketch.png)
Museum-quality sketch using advanced multi-step processing:
1. **CLAHE Enhancement** - Local contrast enhancement for detail preservation
2. **Multi-Scale Edge Detection** - Combined Canny and Sobel edge maps
3. **Dodge & Burn Blending** - Classic pencil sketch base effect
4. **Bilateral Filtering** - Smooth surfaces while preserving edges
5. **Advanced Sharpening** - Custom kernel for line definition
6. **Unsharp Masking** - Professional sharpening technique
7. **Contrast Normalization** - Optimal tonal range distribution
8. **Noise Reduction** - Final smoothing pass

Suitable for professional prints, gallery display, or high-end reproduction.

### Line-Art Sketch Effect (Car_sketch.png)
Abstracted sketch emphasizing structural lines:
1. Edge detection on existing sketch
2. Morphological operations to strengthen lines
3. Bilateral filtering for smoothing
4. Advanced sharpening kernel
5. Creates high-contrast technical drawing style

## Output Quality Comparison

| File | Format | Size | Quality | Use Case |
|------|--------|------|---------|----------|
| Car_high_quality_sketch.png | PNG | 1.0 MB | ⭐⭐⭐⭐⭐ Museum-grade | Professional prints, galleries, high-res display |
| Car.png | PNG (RGBA) | 3.8 MB | ⭐⭐⭐⭐ Professional | Web display, archives, transparency support |
| Car.jpg | JPEG | 708 KB | ⭐⭐⭐⭐ Professional | Web distribution, email, social media |
| Car_sketch.png | PNG | 5.0 KB | ⭐⭐⭐ Stylized | Technical drawing, fast web delivery |
