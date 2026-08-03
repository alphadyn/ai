#!/usr/bin/env python3
"""
Generate a realistic car image and convert to professional sketch.
Creates a detailed car similar to a Porsche 911 convertible.
"""

import cv2
import numpy as np
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageOps
import random

def create_realistic_car_image(output_path):
    """Create a more realistic car image resembling a Porsche 911."""
    
    # High-resolution canvas
    width, height = 1200, 800
    img = Image.new('RGB', (width, height), color='#F5F5F5')
    draw = ImageDraw.Draw(img, 'RGBA')
    
    # Add gradient background
    for y in range(height):
        blend = int(255 * (1 - y / height * 0.3))
        color = (blend, blend, blend)
        draw.line([(0, y), (width, y)], fill=color)
    
    # Add ground shadow
    draw.ellipse([200, 550, 1000, 750], fill=(0, 0, 0, 30))
    
    # Car position
    car_x, car_y = 300, 250
    
    # ===== Main Body =====
    # Car chassis (sleek sports car shape)
    body_points = [
        (car_x + 100, car_y + 150),      # Front
        (car_x + 600, car_y + 140),      # Back
        (car_x + 620, car_y + 250),      # Rear bottom
        (car_x + 80, car_y + 260),       # Front bottom
    ]
    draw.polygon(body_points, fill='#1a5fa0', outline='#0a3f80')
    
    # Rear spoiler
    draw.rectangle([car_x + 580, car_y + 80, car_x + 620, car_y + 140], fill='#0a3f80')
    draw.polygon([(car_x + 590, car_y + 80), (car_x + 650, car_y + 60), 
                  (car_x + 650, car_y + 90), (car_x + 600, car_y + 100)], 
                 fill='#0a3f80', outline='#000')
    
    # Hood/Front
    hood_points = [
        (car_x + 80, car_y + 150),
        (car_x + 150, car_y + 110),
        (car_x + 200, car_y + 105),
        (car_x + 100, car_y + 150)
    ]
    draw.polygon(hood_points, fill='#2875c4', outline='#0a3f80')
    
    # ===== Convertible Top =====
    draw.ellipse([car_x + 180, car_y + 80, car_x + 500, car_y + 200], 
                 fill='#444444', outline='#222222', width=2)
    draw.polygon([(car_x + 180, car_y + 140), (car_x + 500, car_y + 140),
                  (car_x + 480, car_y + 160), (car_x + 200, car_y + 160)],
                 fill='#333333', outline='#1a1a1a')
    
    # Top frame
    draw.rectangle([car_x + 175, car_y + 135, car_x + 505, car_y + 145], 
                   fill='#888888', outline='#666666')
    
    # ===== Windows/Windshield =====
    # Windshield
    windshield = [
        (car_x + 150, car_y + 140),
        (car_x + 200, car_y + 110),
        (car_x + 250, car_y + 108),
        (car_x + 200, car_y + 150)
    ]
    draw.polygon(windshield, fill='#87CEEB', outline='#4a4a4a', width=2)
    
    # Side windows
    draw.rectangle([car_x + 280, car_y + 130, car_x + 380, car_y + 200], 
                   fill='#87CEEB', outline='#4a4a4a', width=2)
    
    # ===== Wheels =====
    # Front wheel
    wheel_front_x, wheel_front_y = car_x + 180, car_y + 260
    draw.ellipse([wheel_front_x - 45, wheel_front_y - 50, wheel_front_x + 45, wheel_front_y + 50],
                 fill='#1a1a1a', outline='#000000', width=2)
    draw.ellipse([wheel_front_x - 35, wheel_front_y - 40, wheel_front_x + 35, wheel_front_y + 40],
                 fill='#333333', outline='#555555', width=1)
    # Rim details
    for angle in range(0, 360, 45):
        rad = np.radians(angle)
        x1 = wheel_front_x + 20 * np.cos(rad)
        y1 = wheel_front_y + 20 * np.sin(rad)
        x2 = wheel_front_x + 30 * np.cos(rad)
        y2 = wheel_front_y + 30 * np.sin(rad)
        draw.line([(x1, y1), (x2, y2)], fill='#666666', width=1)
    
    # Rear wheel
    wheel_rear_x, wheel_rear_y = car_x + 520, car_y + 270
    draw.ellipse([wheel_rear_x - 50, wheel_rear_y - 55, wheel_rear_x + 50, wheel_rear_y + 55],
                 fill='#1a1a1a', outline='#000000', width=2)
    draw.ellipse([wheel_rear_x - 38, wheel_rear_y - 43, wheel_rear_x + 38, wheel_rear_y + 43],
                 fill='#2a2a2a', outline='#555555', width=1)
    # Rim details
    for angle in range(0, 360, 45):
        rad = np.radians(angle)
        x1 = wheel_rear_x + 22 * np.cos(rad)
        y1 = wheel_rear_y + 22 * np.sin(rad)
        x2 = wheel_rear_x + 33 * np.cos(rad)
        y2 = wheel_rear_y + 33 * np.sin(rad)
        draw.line([(x1, y1), (x2, y2)], fill='#666666', width=1)
    
    # ===== Lights =====
    # Headlights
    draw.ellipse([car_x + 85, car_y + 155, car_x + 120, car_y + 185], 
                 fill='#FFFF99', outline='#888888', width=2)
    draw.ellipse([car_x + 88, car_y + 158, car_x + 117, car_y + 182], 
                 fill='#FFFF55', outline='#CCCC00', width=1)
    
    # Taillights
    draw.rectangle([car_x + 615, car_y + 180, car_x + 635, car_y + 210], 
                   fill='#FF4444', outline='#CC0000', width=2)
    draw.rectangle([car_x + 615, car_y + 220, car_x + 635, car_y + 240], 
                   fill='#FF4444', outline='#CC0000', width=2)
    
    # ===== Details =====
    # Grille
    draw.rectangle([car_x + 65, car_y + 180, car_x + 110, car_y + 230], 
                   fill='#444444', outline='#000000', width=1)
    for i in range(4):
        draw.line([(car_x + 65, car_y + 180 + i * 13), 
                   (car_x + 110, car_y + 180 + i * 13)], fill='#222222', width=1)
    
    # Door line
    draw.line([(car_x + 280, car_y + 130), (car_x + 280, car_y + 250)], 
              fill='#0a3f80', width=2)
    
    # Mirror
    draw.ellipse([car_x + 275, car_y + 165, car_x + 305, car_y + 195], 
                 fill='#888888', outline='#333333', width=1)
    
    # Exhaust
    draw.ellipse([car_x + 625, car_y + 245, car_x + 645, car_y + 260], 
                 fill='#555555', outline='#333333', width=1)
    
    # Blur slightly for photorealism
    img = img.filter(ImageFilter.GaussianBlur(radius=0.5))
    
    # Add subtle noise
    img_array = np.array(img)
    noise = np.random.normal(0, 3, img_array.shape).astype(np.uint8)
    img_array = np.clip(img_array.astype(int) + noise, 0, 255).astype(np.uint8)
    img = Image.fromarray(img_array)
    
    img.save(str(output_path))
    print(f"✅ Realistic car image created: {output_path.name}")
    return output_path

def create_professional_sketch(input_path, output_path):
    """
    Convert to professional pencil sketch with enhanced edges and details.
    """
    
    img = cv2.imread(str(input_path))
    if img is None:
        print(f"❌ Error loading image")
        return False
    
    print(f"📷 Processing: {input_path.name}")
    print(f"   Dimensions: {img.shape[1]}x{img.shape[0]} pixels")
    
    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Method 1: Dodge and Burn (Pencil Sketch)
    # Create inverted grayscale
    inv_gray = 255 - gray
    
    # Apply Gaussian blur to the inverted image
    blurred = cv2.GaussianBlur(inv_gray, (25, 25), 0)
    
    # Divide grayscale by inverted blurred for sketch effect
    sketch = cv2.divide(gray, 255 - blurred, scale=256)
    
    # Method 2: Enhance edges with bilateral filter for detail
    bilateral = cv2.bilateralFilter(sketch.astype(np.uint8), 9, 75, 75)
    
    # Method 3: Enhance line definition with morphological operations
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    sketch_enhanced = cv2.morphologyEx(bilateral, cv2.MORPH_CLOSE, kernel)
    
    # Method 4: Sharpen to bring out fine details
    sharpening_kernel = np.array([
        [-1, -1, -1],
        [-1, 10, -1],
        [-1, -1, -1]
    ], dtype=np.float32) / 2.0
    
    sketch_sharp = cv2.filter2D(sketch_enhanced, -1, sharpening_kernel)
    
    # Method 5: Contrast enhancement
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    sketch_contrast = clahe.apply(sketch_sharp.astype(np.uint8))
    
    # Normalize output
    sketch_final = cv2.normalize(sketch_contrast, None, 0, 255, cv2.NORM_MINMAX)
    
    # Apply slight Gaussian blur to smooth while keeping edges
    sketch_final = cv2.GaussianBlur(sketch_final, (1, 1), 0)
    
    # Save
    cv2.imwrite(str(output_path), sketch_final)
    print(f"✅ Professional sketch created: {output_path.name}")
    
    return True

if __name__ == '__main__':
    project_dir = Path(__file__).parent
    image_path = project_dir / "porsche_911.jpg"
    output_path = project_dir / "porsche_911_sketch.png"
    
    print("🎨 Creating realistic car image...")
    create_realistic_car_image(image_path)
    
    print("\n✏️  Generating professional sketch...")
    create_professional_sketch(image_path, output_path)
    
    print(f"\n✨ Complete! Sketch saved to: {output_path}")
