#!/usr/bin/env python3
"""
Convert a car image to a pencil sketch style.
Supports multiple sketch effects: pencil, edge, and cartoon styles.
"""

import cv2
import numpy as np
from pathlib import Path
import sys

def create_pencil_sketch(input_path, output_path, style='pencil'):
    """
    Convert an image to sketch style.
    
    Args:
        input_path: Path to input image
        output_path: Path to save output
        style: 'pencil', 'edge', or 'cartoon'
    """
    
    # Read image
    img = cv2.imread(str(input_path))
    if img is None:
        print(f"❌ Error: Could not load image from {input_path}")
        return False
    
    print(f"📷 Image loaded: {img.shape[1]}x{img.shape[0]} pixels")
    
    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    if style == 'pencil':
        # Pencil sketch: blend grayscale with inverted blur
        inv_gray = 255 - gray
        blurred = cv2.GaussianBlur(inv_gray, (21, 21), 0)
        sketch = cv2.divide(gray, 255 - blurred, scale=256)
        
    elif style == 'edge':
        # Edge detection: Canny edge detector
        edges = cv2.Canny(gray, 100, 200)
        sketch = 255 - edges
        
    elif style == 'cartoon':
        # Cartoon: bilateral filter + edge overlay
        blur = cv2.bilateralFilter(img, 9, 75, 75)
        edges = cv2.Canny(gray, 100, 200)
        edges = cv2.cvtColor(edges, cv2.COLOR_GRAY2BGR)
        sketch = cv2.bitwise_and(blur, edges)
        gray = cv2.cvtColor(sketch, cv2.COLOR_BGR2GRAY)
    
    # Enhance with sharpening filter
    kernel = np.array([[-1, -1, -1],
                       [-1,  9, -1],
                       [-1, -1, -1]], dtype=np.float32) / 1.5
    sketch = cv2.filter2D(gray, -1, kernel)
    sketch = cv2.normalize(sketch, None, 0, 255, cv2.NORM_MINMAX)
    
    # Save output
    output_path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(output_path), sketch)
    print(f"✅ Sketch saved: {output_path.name}")
    print(f"   Style: {style}")
    print(f"   Size: {sketch.shape[1]}x{sketch.shape[0]} pixels")
    
    return True

if __name__ == '__main__':
    # Default paths
    project_dir = Path(__file__).parent
    input_image = project_dir / "porsche_911.jpg"
    output_image = project_dir / "porsche_911_sketch.png"
    
    # Parse arguments
    if len(sys.argv) > 1:
        input_image = Path(sys.argv[1])
    
    if len(sys.argv) > 2:
        output_image = Path(sys.argv[2])
    
    style = sys.argv[3] if len(sys.argv) > 3 else 'pencil'
    
    if not input_image.exists():
        print(f"❌ Input image not found: {input_image}")
        print(f"\nUsage: python3 generate_sketch.py [input.jpg] [output.png] [style]")
        print(f"Styles: pencil (default), edge, cartoon")
        sys.exit(1)
    
    create_pencil_sketch(input_image, output_image, style)
