#!/usr/bin/env python3
"""
Create a test image or work with uploaded image to generate sketch.
"""

import cv2
import numpy as np
from pathlib import Path
from PIL import Image, ImageDraw

def create_test_car_image(output_path):
    """Create a simple test car image for demonstration."""
    
    # Create a white canvas
    img = Image.new('RGB', (800, 600), color='white')
    draw = ImageDraw.Draw(img)
    
    # Draw a simple car silhouette
    # Car body
    draw.ellipse([150, 200, 650, 350], outline='black', width=3, fill='lightblue')
    
    # Windows
    draw.rectangle([200, 220, 350, 280], outline='black', width=2, fill='lightcyan')
    draw.rectangle([400, 220, 550, 280], outline='black', width=2, fill='lightcyan')
    
    # Wheels
    draw.ellipse([180, 330, 280, 430], outline='black', width=3, fill='gray')
    draw.ellipse([520, 330, 620, 430], outline='black', width=3, fill='gray')
    
    # Wheel rims
    draw.ellipse([200, 350, 260, 410], outline='black', width=1, fill='white')
    draw.ellipse([540, 350, 600, 410], outline='black', width=1, fill='white')
    
    # Headlights
    draw.ellipse([160, 260, 200, 290], outline='black', width=2, fill='yellow')
    draw.ellipse([600, 260, 640, 290], outline='black', width=2, fill='red')
    
    # Add some detail lines
    draw.line([400, 200, 400, 350], fill='black', width=2)
    draw.line([250, 350, 250, 430], fill='black', width=1)
    draw.line([550, 350, 550, 430], fill='black', width=1)
    
    # Save
    img.save(str(output_path))
    return output_path

def create_sketch(input_path, output_path):
    """Convert image to pencil sketch."""
    
    img = cv2.imread(str(input_path))
    if img is None:
        print(f"❌ Error: Could not load image")
        return False
    
    print(f"📷 Processing: {input_path.name}")
    print(f"   Size: {img.shape[1]}x{img.shape[0]} pixels")
    
    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Pencil sketch using Laplacian method
    inv_gray = 255 - gray
    blurred = cv2.GaussianBlur(inv_gray, (21, 21), 0)
    sketch = cv2.divide(gray, 255 - blurred, scale=256)
    
    # Sharpen
    kernel = np.array([[-1, -1, -1],
                       [-1,  9, -1],
                       [-1, -1, -1]], dtype=np.float32) / 1.5
    sketch = cv2.filter2D(sketch, -1, kernel)
    sketch = cv2.normalize(sketch, None, 0, 255, cv2.NORM_MINMAX)
    
    # Save
    cv2.imwrite(str(output_path), sketch)
    print(f"✅ Sketch generated: {output_path.name}")
    
    return True

if __name__ == '__main__':
    project_dir = Path(__file__).parent
    image_path = project_dir / "porsche_911.jpg"
    output_path = project_dir / "porsche_911_sketch.png"
    
    # Check if actual image exists
    if not image_path.exists():
        print("⚠️  Image not found: porsche_911.jpg")
        print("📝 Creating test image for demonstration...")
        create_test_car_image(image_path)
        print(f"✅ Test image created: {image_path.name}")
    
    # Generate sketch
    create_sketch(image_path, output_path)
    print(f"\n📊 Result saved to: {output_path}")
