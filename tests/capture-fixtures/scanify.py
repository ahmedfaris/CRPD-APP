# Make clean renders look like real scans: greyscale, skew, speckle noise, 200 dpi.
# Writes one multi-page TIFF (what an MFP sends to a hot folder) and a PDF version.
import random
import sys
from pathlib import Path
from PIL import Image, ImageFilter

src = Path(sys.argv[1])
out_dir = Path(sys.argv[2])
out_dir.mkdir(parents=True, exist_ok=True)
random.seed(7)
pages = []
for i, f in enumerate(sorted(src.glob('*.png'))):
    im = Image.open(f).convert('L')
    # skew 1.5 - 3.5 degrees, alternating direction (separator sheets too)
    angle = (1.5 + (i % 3)) * (1 if i % 2 else -1)
    im = im.rotate(angle, resample=Image.BICUBIC, expand=True, fillcolor=255)
    px = im.load()
    w, h = im.size
    # speckle: scattered dark dots like dust on the glass
    for _ in range(int(w * h * 0.0008)):
        x, y = random.randrange(w), random.randrange(h)
        r = random.choice([1, 1, 2])
        for dx in range(-r, r + 1):
            for dy in range(-r, r + 1):
                if 0 <= x + dx < w and 0 <= y + dy < h:
                    px[x + dx, y + dy] = random.randrange(0, 90)
    im = im.filter(ImageFilter.GaussianBlur(0.6))
    pages.append(im)
dpi = (150, 150)
pages[0].save(out_dir / 'mfp-batch.tif', save_all=True, append_images=pages[1:], compression='tiff_lzw', dpi=dpi)
pages[0].save(out_dir / 'mfp-batch.pdf', save_all=True, append_images=pages[1:], resolution=150)
# a single skewed letter page without separators (for "upload into a record" conversion)
pages[1].save(out_dir / 'single-letter.jpg', quality=85, dpi=dpi)
print('written', [p.name for p in out_dir.iterdir()])
