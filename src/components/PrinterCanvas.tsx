import { useCanvas } from '../hooks/useCanvas';
import type { Template, PrinterConfig } from '../types';
import './PrinterCanvas.css';

interface PrinterCanvasProps {
  template: Template;
  textFieldValues: Record<string, string>;
  printerConfig: PrinterConfig;
  hiddenFields: Record<string, boolean>;
}

const PrinterCanvas = ({ template, textFieldValues, printerConfig, hiddenFields }: PrinterCanvasProps) => {
  const canvasRef = useCanvas(template, textFieldValues, printerConfig, hiddenFields);

  return (
    <canvas 
      ref={canvasRef} 
      className="printer-canvas"
      id="qrCodeCanvas"
    />
  );
};

export default PrinterCanvas;
