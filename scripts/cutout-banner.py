"""
Cut the produce illustration strip out of its flat off-white background.

    python3 scripts/cutout-banner.py <input.jpeg> src/web/assets/produce-strip.webp [--width 2200]

Background is taken as the median colour of the image border. A pixel counts as background
only if it is close to that colour AND connected to the image border, so pale fills enclosed
by an outline (garlic, pear highlights) stay opaque. Soft alpha is computed only in a thin band
along the background edge, colours there are un-mixed from the cream, and the downscale runs on
premultiplied pixels so no light fringe survives on a dark page.
"""
import argparse

import numpy as np
import scipy.ndimage as ndi
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('src')
ap.add_argument('dst')
ap.add_argument('--width', type=int, default=2200)
ap.add_argument('--noise', type=float, default=7.0, help='distance below which a pixel is pure background')
ap.add_argument('--fill', type=float, default=20.0, help='distance below which a pixel may be background')
ap.add_argument('--edge', type=float, default=70.0, help='distance at which an edge pixel is fully opaque')
ap.add_argument('--band', type=int, default=3, help='edge band width in source pixels')
ap.add_argument('--pad', type=int, default=16)
a = ap.parse_args()

rgb = np.asarray(Image.open(a.src).convert('RGB')).astype(np.float32)
H, W, _ = rgb.shape
border = np.concatenate([rgb[:40].reshape(-1, 3), rgb[-40:].reshape(-1, 3), rgb[:, :40].reshape(-1, 3), rgb[:, -40:].reshape(-1, 3)])
bg = np.median(border, axis=0)
dist = np.sqrt(((rgb - bg) ** 2).sum(-1))

# background = near-bg pixels connected to the border, plus large enclosed pockets of pure background
cand = dist < a.fill
labels, n = ndi.label(cand, structure=np.ones((3, 3)))
touching = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
bg_region = np.isin(labels, touching[touching > 0])
sizes = ndi.sum(cand, labels, index=np.arange(1, n + 1))
means = ndi.mean(dist, labels, index=np.arange(1, n + 1))
pockets = np.where((sizes > 400) & (means < a.noise))[0] + 1
bg_region |= np.isin(labels, pockets)

# alpha: 0 in background, soft ramp in a thin band around it, 1 elsewhere
band = ndi.binary_dilation(bg_region, iterations=a.band)
ramp = np.clip((dist - a.noise) / (a.edge - a.noise), 0, 1)
alpha = np.ones((H, W), np.float32)
alpha[band] = ramp[band]
alpha[bg_region] = np.minimum(alpha[bg_region], np.clip((dist[bg_region] - a.noise) / (a.fill - a.noise), 0, 1))

# drop isolated specks of JPEG noise
speck_labels, m = ndi.label(alpha > 0.05, structure=np.ones((3, 3)))
speck_sizes = ndi.sum(np.ones_like(alpha), speck_labels, index=np.arange(1, m + 1))
alpha[np.isin(speck_labels, np.where(speck_sizes < 40)[0] + 1)] = 0

# un-mix the cream from semi-transparent edge pixels: c = a*fg + (1-a)*bg
safe = np.maximum(alpha, 1e-3)[..., None]
fg = np.clip((rgb - (1 - alpha[..., None]) * bg) / safe, 0, 255)
fg[alpha <= 0] = 0

ys, xs = np.where(alpha > 0.05)
y0, y1 = max(ys.min() - a.pad, 0), min(ys.max() + a.pad + 1, H)
x0, x1 = max(xs.min() - a.pad, 0), min(xs.max() + a.pad + 1, W)
out = np.dstack([fg, alpha * 255])[y0:y1, x0:x1].round().astype(np.uint8)

img = Image.fromarray(out, 'RGBA')
if a.width and img.width > a.width:
    h = round(img.height * a.width / img.width)
    img = img.convert('RGBa').resize((a.width, h), Image.LANCZOS).convert('RGBA')
img.save(a.dst, 'WEBP', quality=90, alpha_quality=100, method=6)
print(f'bg {bg.round().astype(int).tolist()}  crop x {x0}..{x1} y {y0}..{y1}  out {img.width}x{img.height}')
