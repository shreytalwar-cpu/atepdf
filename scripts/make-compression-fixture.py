"""Recreate the synthetic image-heavy benchmark from the handoff's synthetic raster.
No customer input. Requires Pillow, numpy and reportlab. Output is a new test PDF.
"""
from pathlib import Path
import io
import numpy as np
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
source = Image.open('tests/fixtures/image-input.png').convert('RGB').resize((2000, 2827))
pixels = np.array(source).astype(np.int16)
noise = np.random.default_rng(4281).integers(-6, 7, pixels.shape)
raster = Image.fromarray(np.clip(pixels + noise, 0, 255).astype(np.uint8))
encoded = io.BytesIO()
raster.save(encoded, format='JPEG', quality=99, subsampling=0)
encoded.seek(0)
output = Path('tests/fixtures/image-heavy.pdf')
pdf = canvas.Canvas(str(output), pagesize=(595.28, 841.89), invariant=1)
pdf.drawImage(ImageReader(encoded), 0, 0, width=595.28, height=841.89)
pdf.showPage()
pdf.save()
print(output)
