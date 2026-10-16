import React from 'react';
import { Search, X } from 'lucide-react';

export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
  onClear?: () => void;
  containerClassName?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  onClear,
  placeholder = 'Search…',
  disabled = false,
  className = '',
  containerClassName = '',
  id,
  'aria-label': ariaLabel = 'Search',
  ...rest
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' && value) {
      e.stopPropagation();
      onClear?.();
    }
  };

  return (
    <div className={`relative flex items-center w-full ${containerClassName}`}>
      <span className="absolute left-3 pointer-events-none text-slate-400 dark:text-slate-500 flex items-center justify-center">
        <Search className="w-4 h-4" aria-hidden="true" />
      </span>
      <input
        type="text"
        id={id}
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`form-input !pl-10 ${value && onClear ? '!pr-10' : ''} text-xs ${
          disabled ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800' : ''
        } ${className}`}
        {...rest}
      />
      {Boolean(value) && Boolean(onClear) && !disabled && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search query"
          className="absolute right-1.5 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
};
