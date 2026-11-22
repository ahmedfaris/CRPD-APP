# =============================================================================
# Production image: web app + Letters Archive document capture toolchain
#   - OCRmyPDF 16 (Tesseract 5 OCR in Arabic + English, unpaper deskew/despeckle,
#     Ghostscript PDF/A-2b output), zbar (barcodes / QR), qpdf, poppler, img2pdf
#   - optional: Tesseract "best" Arabic/English models (more accurate, slower)
# Build:  docker build -t crpd-app .
#         docker build -t crpd-app --build-arg TESSDATA=best .
# =============================================================================

# Stage 1: build the frontend and the server bundle
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: runtime
FROM node:22-bookworm-slim AS runner
ARG TESSDATA=standard
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    OCRMYPDF_BIN=/opt/ocrmypdf/bin/ocrmypdf \
    LAS_ARCHIVE_ROOT=/data/archive \
    CAPTURE_ROOT=/data/capture

# OCR / PDF tools from Debian; OCRmyPDF itself in its own Python environment (same versions as tested).
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      tesseract-ocr tesseract-ocr-ara tesseract-ocr-eng tesseract-ocr-osd \
      unpaper ghostscript qpdf poppler-utils zbar-tools pngquant \
      python3 python3-venv ca-certificates curl fonts-noto-core \
 && python3 -m venv /opt/ocrmypdf \
 && /opt/ocrmypdf/bin/pip install --no-cache-dir "ocrmypdf==16.10.4" "pikepdf==9.11.0" "img2pdf==0.5.1" \
 && ln -s /opt/ocrmypdf/bin/img2pdf /usr/local/bin/img2pdf \
 && if [ "$TESSDATA" = "best" ]; then \
      d=$(dirname "$(find /usr/share/tesseract-ocr -name eng.traineddata | head -1)"); \
      for l in ara eng; do curl -fsSL -o "$d/$l.traineddata" "https://github.com/tesseract-ocr/tessdata_best/raw/main/$l.traineddata"; done; \
    fi \
 && apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*
# Optional: independent PDF/A validation of every file. Install veraPDF (https://verapdf.org) in a
# derived image or a mounted volume and set VERAPDF_BIN to its "verapdf" script.

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/db ./src/db
COPY --from=builder /app/src/server/db ./src/server/db
COPY --from=builder /app/init-db.sql ./init-db.sql

# Archive files, capture work area and hot folders live on volumes, owned by the unprivileged user.
RUN mkdir -p /data/archive /data/capture /hotfolders /app/logs && chown -R node:node /data /hotfolders /app/logs
USER node
VOLUME ["/data/archive", "/data/capture"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "dist/server.cjs"]
