#!/usr/bin/env python3
"""
Save image from clipboard/attachment and convert to pencil sketch.
"""

import cv2
import numpy as np
from pathlib import Path
import sys

def create_pencil_sketch(input_path, output_path):
    """Convert image to pencil sketch."""
    
    # Read the image
    img = cv2.imread(str(input_path))
    if img is None:
        print(f"Error: Could not load image from {input_path}")
        return False
    
    print(f"Image loaded: {img.shape}")
    
    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Create pencil sketch using Laplacian method
    inv_gray = 255 - gray
    blurred = cv2.GaussianBlur(inv_gray, (21, 21), 0)
    sketch = cv2.divide(gray, 255 - blurred, scale=256)
    
    # Enhance edges with slight sharpening
    kernel = np.array([[-1, -1, -1],
                       [-1,  9, -1],
                       [-1, -1, -1]], dtype=np.float32) / 1.5
    
    sketch = cv2.filter2D(sketch, -1, kernel)
    sketch = cv2.normalize(sketch, None, 0, 255, cv2.NORM_MINMAX)
    
    # Save result
    output_path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(output_path), sketch)
    print(f"✓ Sketch saved: {output_path}")
    print(f"  Output size: {sketch.shape}")
    
    return True

if __name__ == '__main__':
    workspace = Path("/Users/kanayo/Documents/GitHub/ai")
    
    # Try to find the most recently modified image
    image_files = list(workspace.glob("*.jpg")) + list(workspace.glob("*.png")) + list(workspace.glob("*.jpeg"))
    
    if not image_files:
        print("No image files found in workspace. Checking Desktop...")
        desktop = Path.home() / "Desktop"
        image_files = list(desktop.glob("*.jpg")) + list(desktop.glob("*.png"))
    
    if not image_files:
        print("Usage: python3 porsche_911_sketch_gen.py <input_image>")
        print("Or place an image in the workspace directory")
        sys.exit(1)
    
    # Use the most recently modified image
    input_image = max(image_files, key=lambda p: p.stat().st_mtime)
    output_image = workspace / "porsche_911_sketch.png"
    
    print(f"Processing: {input_image.name}")
    create_pencil_sketch(input_image, output_image)
