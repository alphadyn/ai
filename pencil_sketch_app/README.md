# Pencil Sketch Studio

A simple browser app for turning uploaded images into pencil-style sketches. It supports both black-and-white and color pencil effects and lets the user tune how closely the result matches the original, how fine or coarse the pencil strokes feel, and how the image is balanced by brightness and RGB color filters.

The sketch engine follows the same core idea used in the GeeksforGeeks example:
grayscale conversion, invert, blur, and color-dodge blending.

## Features

- Upload an image file from your device
- Choose between black-and-white and color sketch modes
- Adjust the sketch accuracy from more artistic to more faithful to the source image
- Adjust the pencil stroke length (maps to blur radius in the invert+blur stage)
- Adjust color pencil blurriness to control how soft the color sketch appears
- Adjust brightness to make the sketch lighter or darker
- Use red, green, and blue filters to tint and balance the color output
- Preview the original image and generated sketch side by side
- Download the final sketch as a PNG

## Run locally

From the project root, go to the app folder and start a simple local server:

```bash
cd pencil_sketch_app
python3 -m http.server 8000
```

Then open this in a browser:

```text
http://localhost:8000/
```

## How to use

1. Click “Choose an image” and select a photo.
2. Pick a sketch style: black-and-white or color pencil.
3. Move the “Accuracy to original” slider:
   - Lower values create a more stylized, artistic sketch
   - Higher values keep more of the original image’s detail and shading
4. Move the “Pencil stroke length” slider:
   - Lower values use a smaller blur radius for harder, tighter lines
   - Higher values use a larger blur radius for softer, broader shading
5. Move the “Color pencil blurriness” slider:
   - Lower values keep color edges more defined
   - Higher values make color strokes softer and more blended
6. Adjust the “Brightness” slider:
   - Lower values darken the sketch
   - Higher values lighten the sketch
7. Use the red, green, and blue filter sliders to tint the sketch and balance its color channels.
8. Click “Generate Sketch” if needed.
9. Use “Download PNG” to save the result.

## Files

- `index.html` – page layout and controls
- `styles.css` – visual styling and responsive layout
- `app.js` – image rendering and sketch generation logic

## Sketch method

The black-and-white sketch is generated with this pipeline:

1. Convert source image to grayscale.
2. Invert the grayscale image.
3. Blur the inverted image.
4. Apply a color-dodge style blend using:

   sketch = gray * 256 / (255 - blurredInvert)

5. Clamp output values to 0-255.

Color mode applies the same pencil tone as a luminance mask, then applies an extra blur pass controlled by the blurriness slider.
