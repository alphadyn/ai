#!/usr/bin/env python3
"""
Convert a car image to a pencil sketch style.
Usage: python3 car_sketch.py <input_image> <output_image>
"""

import cv2
import numpy as np
import sys
from pathlib import Path

def create_sketch(image_path, output_path=None, sketch_type='pencil'):
    """
    Convert an image to a sketch style.
    
    Args:
        image_path: Path to input image
        output_path: Path to save sketch (optional)
        sketch_type: 'pencil' or 'edge' or 'cartoon'
    """
    
    # Read the image
    img = cv2.imread(str(image_path))
    if img is None:
        print(f"Error: Could not load image from {image_path}")
        return None
    
    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    if sketch_type == 'pencil':
        # Pencil sketch effect using Laplacian
        inv_gray = 255 - gray
        blurred = cv2.GaussianBlur(inv_gray, (21, 21), 0)
        sketch = cv2.divide(gray, 255 - blurred, scale=256)
        
    elif sketch_type == 'edge':
        # Edge detection (Canny)
        edges = cv2.Canny(gray, 100, 200)
        sketch = 255 - edges
        
    elif sketch_type == 'cartoon':
        # Cartoon effect: posterize with edge overlay
        blur = cv2.bilateralFilter(img, 9, 75, 75)
        edges = cv2.Canny(gray, 100, 200)
        sketch = cv2.cvtColor(edges, cv2.COLOR_GRAY2BGR)
        sketch = cv2.bitwise_and(blur, sketch)
        gray = cv2.cvtColor(sketch, cv2.COLOR_BGR2GRAY)
    
    # Apply sharpening
    kernel = np.array([[-1, -1, -1],
                       [-1,  9, -1],
                       [-1, -1, -1]])
    sketch = cv2.filter2D(gray, -1, kernel)
    
    # Normalize to 0-255 range
    sketch = cv2.normalize(sketch, None, 0, 255, cv2.NORM_MINMAX)
    
    # Save if output path provided
    if output_path:
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(output_path), sketch)
        print(f"Sketch saved to: {output_path}")
        return str(output_path)
    
    return sketch

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 car_sketch.py <input_image> [output_image] [sketch_type]")
        print("Sketch types: pencil (default), edge, cartoon")
        sys.exit(1)
    
    input_image = sys.argv[1]
    output_image = sys.argv[2] if len(sys.argv) > 2 else None
    sketch_type = sys.argv[3] if len(sys.argv) > 3 else 'pencil'
    
    if not output_image:
        input_path = Path(input_image)
        output_image = input_path.parent / f"{input_path.stem}_sketch.png"
    
    create_sketch(input_image, output_image, sketch_type)
