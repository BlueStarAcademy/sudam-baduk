import React from 'react';

interface NineSlicePanelProps {
  children: React.ReactNode;
  className?: string;
  padding?: string;
  onClick?: () => void;
}

const NineSlicePanel: React.FC<NineSlicePanelProps> = ({ children, className, padding = 'p-4', onClick }) => {
  return (
    <div className={`relative bg-panel panel-glow text-on-panel rounded-lg ${padding} ${className}`} onClick={onClick}>
      <div className="absolute -top-2 -left-2 w-8 h-8 bg-[url('/images/panel/panel_top_left.png')] bg-no-repeat bg-contain z-10"></div>
      <div className="absolute -top-2 -right-2 w-8 h-8 bg-[url('/images/panel/panel_top_right.png')] bg-no-repeat bg-contain z-10"></div>
      <div className="absolute -bottom-2 -left-2 w-8 h-8 bg-[url('/images/panel/panel_bottom_left.png')] bg-no-repeat bg-contain z-10"></div>
      <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-[url('/images/panel/panel_bottom_right.png')] bg-no-repeat bg-contain z-10"></div>
      {children}
    </div>
  );
};

export default NineSlicePanel;
