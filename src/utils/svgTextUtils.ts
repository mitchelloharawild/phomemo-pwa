// Shared utilities for handling SVG text elements

export interface TextFieldInfo {
  ids: string[];
  defaults: Record<string, string>;
}

/**
 * Extract text field IDs and their default values from SVG content
 */
export const extractTextFieldIds = (svgContent: string): TextFieldInfo => {
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
  const textElements = svgDoc.querySelectorAll('text[id]');
  
  const ids: string[] = [];
  const defaults: Record<string, string> = {};
  
  textElements.forEach(el => {
    const id = el.getAttribute('id');
    if (id) {
      ids.push(id);
      
      // Check if text element has tspan children (multi-line)
      const tspans = el.querySelectorAll('tspan');
      if (tspans.length > 0) {
        const lines: string[] = [];
        tspans.forEach(tspan => {
          lines.push(tspan.textContent || '');
        });
        defaults[id] = lines.join('\n'); // Use actual newline
      } else {
        defaults[id] = el.textContent || '';
      }
    }
  });
  
  return { ids, defaults };
};

/**
 * Update text elements in SVG with new values
 */
export const updateSVGTextFields = (
  svgDoc: Document,
  textFields: Record<string, string>,
  maxTextWidth: number
): void => {
  // Get SVG dimensions for padding calculation
  const svgElement = svgDoc.querySelector('svg');
  if (!svgElement) return;

  Object.entries(textFields).forEach(([id, value]) => {
    const textElement = svgDoc.getElementById(id) as SVGTextElement;
    if (!textElement) return;

    // Get original font size
    const originalFontSize = parseFloat(textElement.getAttribute('font-size') || '32');
    let adjustedFontSize = originalFontSize;

    // Check if it's a multi-line text (has tspan children)
    const tspans = textElement.querySelectorAll('tspan');
    if (tspans.length > 0) {
      // Multi-line: split value by newlines and update tspans
      const lines = value.split('\n'); // Use actual newline
      
      // Find the longest line
      let maxLineLength = 0;
      let longestLine = '';
      lines.forEach(line => {
        if (line.length > maxLineLength) {
          maxLineLength = line.length;
          longestLine = line;
        }
      });

      // Calculate required font size based on longest line
      if (longestLine) {
        adjustedFontSize = calculateFontSize(
          longestLine,
          maxTextWidth,
          originalFontSize,
          textElement
        );
      }

      // Update font size
      textElement.setAttribute('font-size', adjustedFontSize.toString());

      // Get the first tspan's y position and x position to use as baseline
      const firstTspan = tspans[0];
      const baseY = parseFloat(firstTspan.getAttribute('y') || '100');
      const baseX = firstTspan.getAttribute('x') || '192';
      
      // Store the style attribute from the first tspan to preserve formatting
      const tspanStyle = firstTspan.getAttribute('style') || '';
      
      // Calculate original line spacing from the first two tspans
      let lineHeight = originalFontSize * 1.25; // fallback based on original font size
      if (tspans.length > 1) {
        const firstY = parseFloat(tspans[0].getAttribute('y') || '0');
        const secondY = parseFloat(tspans[1].getAttribute('y') || '0');
        lineHeight = secondY - firstY; // Use original spacing as-is
      }

      // Remove all existing tspans
      tspans.forEach(tspan => tspan.remove());

      // Create new tspans for all lines
      lines.forEach((line, index) => {
        const tspan = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'tspan');
        tspan.textContent = line;
        
        // Set absolute y position for each line
        const yPosition = baseY + (index * lineHeight);
        tspan.setAttribute('y', yPosition.toString());
        
        // Use consistent x position for all lines
        tspan.setAttribute('x', baseX);
        
        // Preserve the original style attributes for proper alignment
        if (tspanStyle) {
          tspan.setAttribute('style', tspanStyle);
        }
        
        textElement.appendChild(tspan);
      });
    } else {
      // Single-line: update text and calculate font size
      const text = value || '';
      adjustedFontSize = calculateFontSize(
        text,
        maxTextWidth,
        originalFontSize,
        textElement
      );
      
      textElement.setAttribute('font-size', adjustedFontSize.toString());
      textElement.textContent = text;
    }
  });
};

/**
 * Calculate appropriate font size for text width
 */
const calculateFontSize = (
  text: string,
  maxWidth: number,
  originalFontSize: number,
  textElement: SVGTextElement
): number => {
  if (!text) return originalFontSize;

  // Create a temporary SVG to measure text width
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.style.position = 'absolute';
  svg.style.visibility = 'hidden';
  document.body.appendChild(svg);

  const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  tempText.textContent = text;
  
  // Copy relevant attributes
  const fontFamily = textElement.getAttribute('font-family') || 'sans-serif';
  const fontWeight = textElement.getAttribute('font-weight') || 'normal';
  
  tempText.setAttribute('font-family', fontFamily);
  tempText.setAttribute('font-weight', fontWeight);
  tempText.setAttribute('font-size', originalFontSize.toString());
  
  svg.appendChild(tempText);

  // Measure text width at original font size
  let bbox = tempText.getBBox();
  let currentWidth = bbox.width;
  let fontSize = originalFontSize;

  // If text fits, return original size
  if (currentWidth <= maxWidth) {
    document.body.removeChild(svg);
    return originalFontSize;
  }

  // Binary search for appropriate font size
  let minSize = 8;
  let maxSize = originalFontSize;
  
  while (maxSize - minSize > 0.5) {
    fontSize = (minSize + maxSize) / 2;
    tempText.setAttribute('font-size', fontSize.toString());
    bbox = tempText.getBBox();
    currentWidth = bbox.width;

    if (currentWidth > maxWidth) {
      maxSize = fontSize;
    } else {
      minSize = fontSize;
    }
  }

  document.body.removeChild(svg);
  return Math.floor(minSize);
};

/**
 * Check if a text field ID is multi-line (has tspans)
 */
export const extractMultiLineFields = (svgContent: string): Set<string> => {
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
  const textElements = svgDoc.querySelectorAll('text[id]');
  
  const multiLine = new Set<string>();
  
  textElements.forEach(el => {
    const id = el.getAttribute('id');
    if (id) {
      const tspans = el.querySelectorAll('tspan');
      if (tspans.length > 0) {
        multiLine.add(id);
      }
    }
  });
  
  return multiLine;
};
