import React from 'react';
import { useAppContext } from '../../hooks/useAppContext.js';

interface NineSlicePanelProps {
  children: React.ReactNode;
  className?: string;
  padding?: string;
  onClick?: () => void;
}

const NineSlicePanel: React.FC<NineSlicePanelProps> = ({ children, className, padding = 'p-4', onClick }) => {
  const { settings } = useAppContext();
  const edgeStyle = settings.graphics.panelEdge || 0;

  const getImageUrl = (corner: string) => {
    if (edgeStyle === 0) {
        return `/images/panel/panel_${corner}.png`;
    }
    return `/images/panel/panel_${corner}${edgeStyle}.png`;
  }

  return (
    <div className={`relative bg-panel panel-glow text-on-panel rounded-lg flex flex-col ${padding} ${className}`} onClick={onClick}>
      <div style={{ backgroundImage: `url(${getImageUrl('top_left')})` }} className="absolute top-0 left-0 w-8 h-8 bg-no-repeat bg-contain z-10"></div>
      <div style={{ backgroundImage: `url(${getImageUrl('top_right')})` }} className="absolute top-0 right-0 w-8 h-8 bg-no-repeat bg-contain z-10"></div>
      <div style={{ backgroundImage: `url(${getImageUrl('bottom_left')})` }} className="absolute bottom-0 left-0 w-8 h-8 bg-no-repeat bg-contain z-10"></div>
      <div style={{ backgroundImage: `url(${getImageUrl('bottom_right')})` }} className="absolute bottom-0 right-0 w-8 h-8 bg-no-repeat bg-contain z-10"></div>
      {children}
    </div>
  );
};

export default NineSlicePanel;
