import { useCanvas } from '../hooks/useCanvas';
import type { FormData, PrinterConfig } from '../types';
import './PrinterCanvas.css';

interface PrinterCanvasProps {
  formData: FormData;
  printerConfig: PrinterConfig;
}

const PrinterCanvas = ({ formData, printerConfig }: PrinterCanvasProps) => {
  const canvasRef = useCanvas(formData, printerConfig);

  return (
    <canvas 
      ref={canvasRef} 
      className="printer-canvas"
      id="qrCodeCanvas"
    />
  );
};

export default PrinterCanvas;
