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
    px-4 py-2 font-bold rounded-lg shadow-lg 
    btn-text-shadow
    border-b-4 
    transform transition-all duration-150 ease-in-out 
    will-change-transform
    hover:-translate-y-0.5
    active:translate-y-0.5 active:border-b-2 active:shadow-md
    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-primary 
    disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0 disabled:hover:-translate-y-0
    disabled:bg-gray-600 disabled:border-gray-800 disabled:text-gray-400
  `;

  const colorClasses: Record<ColorScheme, string> = {
    accent: 'bg-gradient-to-b from-indigo-500 to-indigo-600 border-indigo-800 text-white hover:from-indigo-400 hover:to-indigo-500 focus:ring-indigo-500 active:from-indigo-600 active:to-indigo-700',
    blue: 'bg-gradient-to-b from-blue-500 to-blue-600 border-blue-800 text-white hover:from-blue-400 hover:to-blue-500 focus:ring-blue-500 active:from-blue-600 active:to-blue-700',
    red: 'bg-gradient-to-b from-red-500 to-red-700 border-red-900 text-white hover:from-red-400 hover:to-red-600 focus:ring-red-500 active:from-red-600 active:to-red-800',
    gray: 'bg-gradient-to-b from-gray-600 to-gray-800 border-gray-900 text-gray-200 hover:from-gray-500 hover:to-gray-700 focus:ring-gray-500 active:from-gray-700 active:to-gray-900',
    green: 'bg-gradient-to-b from-green-500 to-green-700 border-green-900 text-white hover:from-green-400 hover:to-green-600 focus:ring-green-500 active:from-green-600 active:to-green-800',
    yellow: 'bg-gradient-to-b from-yellow-400 to-yellow-600 border-yellow-800 text-black hover:from-yellow-300 hover:to-yellow-500 focus:ring-yellow-500 active:from-yellow-500 active:to-yellow-700',
    purple: 'bg-gradient-to-b from-purple-500 to-purple-700 border-purple-900 text-white hover:from-purple-400 hover:to-purple-600 focus:ring-purple-500 active:from-purple-600 active:to-purple-800',
    orange: 'bg-gradient-to-b from-orange-500 to-orange-700 border-orange-900 text-white hover:from-orange-400 hover:to-orange-600 focus:ring-orange-500 active:from-orange-600 active:to-orange-800',
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