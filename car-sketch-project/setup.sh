#!/bin/bash
# Car Sketch Project Setup Guide
# 
# This folder contains a Python-based image-to-sketch converter for car photos.
#
# NEXT STEPS:
# 1. Save the Porsche 911 image as "porsche_911.jpg" in this folder
# 2. Run: python3 generate_sketch.py
# 3. View the result: porsche_911_sketch.png
#
# To use with your own images:
#    python3 generate_sketch.py your_image.jpg your_output.png [style]
#
# Supported styles: pencil, edge, cartoon
#
# Requirements:
#    pip3 install opencv-python numpy pillow

echo "🚗 Car Sketch Project Setup"
echo "=============================="
echo ""
echo "Files in this project:"
ls -lh *.py *.md 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}'
echo ""
echo "Status:"
if [ -f "porsche_911.jpg" ]; then
    echo "  ✅ Image file found: porsche_911.jpg"
else
    echo "  ⏳ Waiting for: porsche_911.jpg"
fi

if [ -f "generated_report.html" ]; then
    echo "  ✅ Report generated: generated_report.html"
fi

if [ -f "porsche_911_sketch.png" ]; then
    echo "  ✅ Sketch generated: porsche_911_sketch.png"
fi

echo ""
echo "Next: Save porsche_911.jpg to this folder, then run:"
echo "  python3 generate_sketch.py"
