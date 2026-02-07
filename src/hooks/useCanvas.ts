import { useEffect, useRef } from 'react';
import type { FormData, PrinterConfig } from '../types';

const mmToPx = (mm: number): number => mm * 203 / 25.4;

export const useCanvas = (formData: FormData, printerConfig: PrinterConfig) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Apply orientation to preview dimensions
    const isLandscape = printerConfig.orientation === 'landscape';
    const displayWidth = isLandscape ? printerConfig.paperHeight : printerConfig.paperWidth;
    const displayHeight = isLandscape ? printerConfig.paperWidth : printerConfig.paperHeight;
    
    const widthPx = mmToPx(displayWidth);
    const heightPx = mmToPx(displayHeight);

    canvas.width = widthPx;
    canvas.height = heightPx;

    // Clear and draw white background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw SVG template if present
    if (printerConfig.svgTemplate && printerConfig.svgTextFields) {
      drawSVGTemplate(ctx, canvas, printerConfig.svgTemplate, printerConfig.svgTextFields);
      // If using template, skip the legacy drawing methods
      return;
    }

    // Draw uploaded image if present
    if (formData.image) {
      drawImage(ctx, canvas, formData.image);
    }

    // Draw QR code
    if (formData.qrText.trim()) {
      drawQRCode(ctx, canvas, formData.qrText);
    }

    // Draw date
    if (formData.useDate && formData.date) {
      drawDate(ctx, canvas, formData.date);
    }

    // Draw centered text
    if (formData.centeredText.trim()) {
      drawCenteredText(ctx, canvas, formData.centeredText, formData.qrText.trim() !== '');
    }
  }, [formData, printerConfig]);

  return canvasRef;
};

const drawSVGTemplate = (
  ctx: CanvasRenderingContext2D, 
  canvas: HTMLCanvasElement, 
  svgTemplate: string, 
  textFields: Record<string, string>
): void => {
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgTemplate, 'image/svg+xml');
  const svgElement = svgDoc.querySelector('svg');
  
  if (!svgElement) return;

  // Update text elements with new values
  Object.entries(textFields).forEach(([id, value]) => {
    const textElement = svgDoc.getElementById(id);
    if (!textElement) return;

    // Check if it's a multi-line text (has tspan children)
    const tspans = textElement.querySelectorAll('tspan');
    if (tspans.length > 0) {
      // Multi-line: split value by newlines and update tspans
      const lines = value.split('\n');
      tspans.forEach((tspan, index) => {
        if (index < lines.length) {
          tspan.textContent = lines[index];
        } else {
          tspan.textContent = '';
        }
      });
    } else {
      // Single-line: just update the text content
      textElement.textContent = value;
    }
  });

  // Serialize the updated SVG
  const serializer = new XMLSerializer();
  const updatedSvgString = serializer.serializeToString(svgDoc);

  // Convert SVG to image and draw on canvas
  const img = new Image();
  const blob = new Blob([updatedSvgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);

  img.onload = () => {
    // Draw SVG to fill the canvas
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);

    // Apply dithering to convert to black and white
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Floyd-Steinberg Dithering
    for (let i = 0; i < data.length; i += 4) {
      let oldPixel = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      const newPixel = oldPixel < 128 ? 0 : 255;
      const quantError = oldPixel - newPixel;

      data[i] = data[i + 1] = data[i + 2] = newPixel;

      if (i + 4 < data.length) data[i + 4] += quantError * 7 / 16;
      if (i + canvas.width * 4 - 4 < data.length) data[i + canvas.width * 4 - 4] += quantError * 3 / 16;
      if (i + canvas.width * 4 < data.length) data[i + canvas.width * 4] += quantError * 5 / 16;
      if (i + canvas.width * 4 + 4 < data.length) data[i + canvas.width * 4 + 4] += quantError * 1 / 16;
    }

    ctx.putImageData(imageData, 0, 0);
  };

  img.src = url;
};

const drawImage = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, file: File): void => {
  const img = new Image();
  const reader = new FileReader();

  reader.onload = (event) => {
    if (!event.target?.result) return;
    
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Check if already black and white
      let isBlackAndWhite = true;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] !== data[i + 1] || data[i] !== data[i + 2]) {
          isBlackAndWhite = false;
          break;
        }
      }

      if (!isBlackAndWhite) {
        // Floyd-Steinberg Dithering
        for (let i = 0; i < data.length; i += 4) {
          let oldPixel = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          const newPixel = oldPixel < 128 ? 0 : 255;
          const quantError = oldPixel - newPixel;

          data[i] = data[i + 1] = data[i + 2] = newPixel;

          if (i + 4 < data.length) data[i + 4] += quantError * 7 / 16;
          if (i + canvas.width * 4 - 4 < data.length) data[i + canvas.width * 4 - 4] += quantError * 3 / 16;
          if (i + canvas.width * 4 < data.length) data[i + canvas.width * 4] += quantError * 5 / 16;
          if (i + canvas.width * 4 + 4 < data.length) data[i + canvas.width * 4 + 4] += quantError * 1 / 16;
        }
      }

      ctx.putImageData(imageData, 0, 0);
    };
    img.src = event.target.result as string;
  };

  reader.readAsDataURL(file);
};

const drawQRCode = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, text: string): void => {
  const qrSize = 0.5 * canvas.height;
  
  // Use canvas-based QR code generation
  import('qrcode').then((QRCode) => {
    const qrCanvas = document.createElement('canvas');
    QRCode.toCanvas(qrCanvas, text, {
      width: qrSize,
      margin: 0,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    }, (error?: Error | null) => {
      if (!error) {
        ctx.drawImage(qrCanvas, 10, 10, qrSize, qrSize);
      }
    });
  });
};

const drawDate = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, date: string): void => {
  ctx.font = '24px Arial';
  ctx.fillStyle = '#000';
  ctx.textAlign = 'right';
  ctx.fillText(date, canvas.width - 10, 20);
};

const drawCenteredText = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, text: string, hasQRCode: boolean): void => {
  const lines = text.split('\n');
  ctx.font = '32pt Arial';
  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const lineHeight = 40;
  let centerY = canvas.height / 2 - (lineHeight * (lines.length - 1)) / 2;

  if (hasQRCode) {
    centerY = centerY + canvas.height / 4;
  }

  lines.forEach((line, i) => {
    ctx.fillText(line, canvas.width / 2, centerY + i * lineHeight);
  });
};
