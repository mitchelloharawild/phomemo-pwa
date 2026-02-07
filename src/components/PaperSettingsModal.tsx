import React from 'react';
import type { PrinterConfig } from '../types';
import './PaperSettingsModal.css';

interface PaperSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: PrinterConfig;
  onSave: (config: Partial<PrinterConfig>) => void;
}

const PaperSettingsModal: React.FC<PaperSettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSave
}) => {
  const [localConfig, setLocalConfig] = React.useState({
    paperType: config.paperType,
    paperWidth: config.paperWidth,
    paperHeight: config.paperHeight,
    orientation: config.orientation || 'portrait',
    svgTemplate: config.svgTemplate,
    svgTextFields: config.svgTextFields || {}
  });

  const [textFieldIds, setTextFieldIds] = React.useState<string[]>([]);
  const [multiLineFields, setMultiLineFields] = React.useState<Set<string>>(new Set());
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const extractTextFieldIds = (svgContent: string): { ids: string[], defaults: Record<string, string>, multiLine: Set<string> } => {
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
    const textElements = svgDoc.querySelectorAll('text[id]');
    
    const ids: string[] = [];
    const defaults: Record<string, string> = {};
    const multiLine = new Set<string>();
    
    textElements.forEach(el => {
      const id = el.getAttribute('id');
      if (id) {
        ids.push(id);
        
        // Check if text element has tspan children (multi-line)
        const tspans = el.querySelectorAll('tspan');
        if (tspans.length > 0) {
          multiLine.add(id);
          // Combine tspan text with newlines
          const lines: string[] = [];
          tspans.forEach(tspan => {
            lines.push(tspan.textContent || '');
          });
          defaults[id] = lines.join('\n');
        } else {
          defaults[id] = el.textContent || '';
        }
      }
    });
    
    return { ids, defaults, multiLine };
  };

  React.useEffect(() => {
    setLocalConfig({
      paperType: config.paperType,
      paperWidth: config.paperWidth,
      paperHeight: config.paperHeight,
      orientation: config.orientation || 'portrait',
      svgTemplate: config.svgTemplate,
      svgTextFields: config.svgTextFields || {}
    });
    
    // Extract text field IDs from existing SVG template
    if (config.svgTemplate) {
      const { ids, defaults, multiLine } = extractTextFieldIds(config.svgTemplate);
      setTextFieldIds(ids);
      setMultiLineFields(multiLine);
      
      // If no saved values exist, use defaults from SVG
      if (!config.svgTextFields || Object.keys(config.svgTextFields).length === 0) {
        setLocalConfig(prev => ({
          ...prev,
          svgTextFields: defaults
        }));
      }
    }
  }, [config]);

  if (!isOpen) return null;

  const handleChange = (field: 'paperType' | 'paperWidth' | 'paperHeight', value: number) => {
    setLocalConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleOrientationChange = (orientation: 'portrait' | 'landscape') => {
    setLocalConfig(prev => ({
      ...prev,
      orientation
    }));
  };

  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate SVG file
    if (!file.type.includes('svg')) {
      alert('Please upload an SVG file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const svgContent = event.target?.result as string;
      const { ids, defaults, multiLine } = extractTextFieldIds(svgContent);
      
      // Initialize text field values with existing values or defaults from SVG
      const initialTextFields: Record<string, string> = {};
      ids.forEach(id => {
        initialTextFields[id] = localConfig.svgTextFields[id] || defaults[id] || '';
      });

      setLocalConfig(prev => ({
        ...prev,
        svgTemplate: svgContent,
        svgTextFields: initialTextFields
      }));
      setTextFieldIds(ids);
      setMultiLineFields(multiLine);
    };
    reader.readAsText(file);
  };

  const handleTextFieldChange = (id: string, value: string) => {
    setLocalConfig(prev => ({
      ...prev,
      svgTextFields: {
        ...prev.svgTextFields,
        [id]: value
      }
    }));
  };

  const handleTemplateButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveTemplate = () => {
    setLocalConfig(prev => ({
      ...prev,
      svgTemplate: undefined,
      svgTextFields: {}
    }));
    setTextFieldIds([]);
    setMultiLineFields(new Set());
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = () => {
    onSave(localConfig);
    onClose();
  };

  const paperTypeOptions = [
    { value: 0x0a, label: 'Label With Gaps' },
    { value: 0x0b, label: 'Continuous' },
    { value: 0x26, label: 'Label With Marks' }
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Paper Settings</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label htmlFor="paperType">Paper Type:</label>
            <select
              id="paperType"
              value={localConfig.paperType}
              onChange={(e) => handleChange('paperType', parseInt(e.target.value))}
            >
              {paperTypeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label} (0x{option.value.toString(16).padStart(2, '0').toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Orientation:</label>
            <div className="orientation-buttons">
              <button
                className={`orientation-button ${localConfig.orientation === 'portrait' ? 'active' : ''}`}
                onClick={() => handleOrientationChange('portrait')}
                type="button"
              >
                📄 Portrait
              </button>
              <button
                className={`orientation-button ${localConfig.orientation === 'landscape' ? 'active' : ''}`}
                onClick={() => handleOrientationChange('landscape')}
                type="button"
              >
                📃 Landscape
              </button>
            </div>
            <small style={{ display: 'block', marginTop: '5px', color: '#666' }}>
              {localConfig.orientation === 'landscape' && 
                'Canvas will be rotated 90° clockwise during printing'}
            </small>
          </div>

          <div className="form-group-inline">
            <div className="form-group">
              <label htmlFor="paperWidth">Paper Width (mm):</label>
              <input
                type="number"
                id="paperWidth"
                value={localConfig.paperWidth}
                onChange={(e) => handleChange('paperWidth', parseInt(e.target.value))}
                min="10"
                max="100"
              />
            </div>

            <div className="form-group">
              <label htmlFor="paperHeight">Paper Height (mm):</label>
              <input
                type="number"
                id="paperHeight"
                value={localConfig.paperHeight}
                onChange={(e) => handleChange('paperHeight', parseInt(e.target.value))}
                min="10"
                max="200"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Label Template:</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".svg,image/svg+xml"
              onChange={handleTemplateUpload}
              style={{ display: 'none' }}
            />
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                type="button"
                className="button button-secondary"
                onClick={handleTemplateButtonClick}
              >
                {localConfig.svgTemplate ? '📝 Change Template' : '📁 Upload SVG Template'}
              </button>
              {localConfig.svgTemplate && (
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={handleRemoveTemplate}
                  style={{ background: '#dc3545' }}
                >
                  🗑️ Remove
                </button>
              )}
            </div>
            <small style={{ display: 'block', marginTop: '5px', color: '#666' }}>
              Upload an SVG file with text elements (must have id attributes)
            </small>
          </div>

          {textFieldIds.length > 0 && (
            <div className="form-group">
              <label>Template Text Fields:</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {textFieldIds.map(id => (
                  <div key={id} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label htmlFor={`text-${id}`} style={{ fontSize: '0.9em', color: '#666' }}>
                      {id}:
                    </label>
                    {multiLineFields.has(id) ? (
                      <textarea
                        id={`text-${id}`}
                        value={localConfig.svgTextFields[id] || ''}
                        onChange={(e) => handleTextFieldChange(id, e.target.value)}
                        placeholder={`Enter value for ${id}`}
                        rows={3}

                      />
                    ) : (
                      <input
                        type="text"
                        id={`text-${id}`}
                        value={localConfig.svgTextFields[id] || ''}
                        onChange={(e) => handleTextFieldChange(id, e.target.value)}
                        placeholder={`Enter value for ${id}`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="button button-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button button-primary" onClick={handleSave}>
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaperSettingsModal;
