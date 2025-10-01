import React from 'react';

type ColorScheme = 'blue' | 'red' | 'gray' | 'green' | 'yellow' | 'purple' | 'orange' | 'accent';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: (e?: React.MouseEvent<HTMLButtonElement>) => void;
  colorScheme?: ColorScheme;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  title?: string;
}

const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  colorScheme = 'accent',
  disabled = false,
  className = '',
  type = 'button',
  title
}) => {
  const baseClasses = `
    px-4 py-2 font-bold rounded-lg shadow-md btn-text-shadow
    border 
    transform transition-all duration-150 ease-in-out 
    hover:shadow-lg hover:-translate-y-px
    active:translate-y-px active:shadow-sm
    focus:outline-none focus:ring-2 focus:ring-offset-2 
    disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-md disabled:hover:-translate-y-0 disabled:active:translate-y-0
  `;

  const colorClasses: Record<ColorScheme, string> = {
    accent: 'bg-gradient-to-b from-indigo-500 to-indigo-600 border-indigo-700 text-white hover:from-indigo-400 hover:to-indigo-500 focus:ring-indigo-500 active:from-indigo-600 active:to-indigo-700',
    blue: 'bg-gradient-to-b from-blue-500 to-blue-600 border-blue-700 text-white hover:from-blue-400 hover:to-blue-500 focus:ring-blue-500 active:from-blue-600 active:to-blue-700',
    red: 'bg-gradient-to-b from-red-600 to-red-700 border-red-800 text-white hover:from-red-500 hover:to-red-600 focus:ring-red-500 active:from-red-700 active:to-red-800',
    gray: 'bg-gradient-to-b from-gray-600 to-gray-700 border-gray-800 text-gray-200 hover:from-gray-500 hover:to-gray-600 focus:ring-gray-500 active:from-gray-700 active:to-gray-800',
    green: 'bg-gradient-to-b from-green-500 to-green-600 border-green-700 text-white hover:from-green-400 hover:to-green-500 focus:ring-green-500 active:from-green-600 active:to-green-700',
    yellow: 'bg-gradient-to-b from-yellow-400 to-yellow-500 border-yellow-600 text-black hover:from-yellow-300 hover:to-yellow-400 focus:ring-yellow-500 active:from-yellow-500 active:to-yellow-600',
    purple: 'bg-gradient-to-b from-purple-500 to-purple-600 border-purple-700 text-white hover:from-purple-400 hover:to-purple-500 focus:ring-purple-500 active:from-purple-600 active:to-purple-700',
    orange: 'bg-gradient-to-b from-orange-500 to-orange-600 border-orange-700 text-white hover:from-orange-400 hover:to-orange-500 focus:ring-orange-500 active:from-orange-600 active:to-orange-700',
  };
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${colorClasses[colorScheme]} ${className}`}
      title={title}
    >
      {children}
    </button>
  );
};

export default Button;