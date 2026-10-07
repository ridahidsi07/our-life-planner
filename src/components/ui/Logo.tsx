import React from 'react';

export const Logo: React.FC<{
  className?: string;
  size?: number;
  showText?: boolean;
}> = ({ className = '', size = 32, showText = true }) => {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        {/* Left ring */}
        <circle
          cx="14"
          cy="18"
          r="9"
          stroke="#087F83"
          strokeWidth="3.2"
          className="dark:stroke-[#38D0C5]"
        />
        {/* Right interlocking ring */}
        <circle
          cx="22"
          cy="18"
          r="9"
          stroke="#38D0C5"
          strokeWidth="3.2"
          className="dark:stroke-[#087F83]"
        />
        {/* Overlap weave highlight */}
        <path
          d="M 18.5 10.5 A 9 9 0 0 1 21.5 15"
          stroke="#087F83"
          strokeWidth="3.2"
          strokeLinecap="round"
          className="dark:stroke-[#38D0C5]"
        />
      </svg>
      {showText && (
        <div className="flex flex-col leading-tight">
          <span className="font-bold text-[17px] tracking-tight text-[#071A3A] dark:text-[#EDF4FF]">
            Our Life Planner
          </span>
          <span className="text-[11px] text-[#526782] dark:text-[#A8B8CE] font-normal">
            A little more room for life
          </span>
        </div>
      )}
    </div>
  );
};
