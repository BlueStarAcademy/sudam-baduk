
import React from 'react';
import Button from './Button';

interface BackButtonProps {
  onClick: () => void;
  className?: string;
}

const BackButton: React.FC<BackButtonProps> = ({ onClick, className }) => {
  return (
    <Button onClick={onClick} colorScheme="gray" className={`!p-2 ${className}`}>
      <img src="/images/button/back.png" alt="뒤로가기" className="h-6" />
    </Button>
  );
};

export default BackButton;
