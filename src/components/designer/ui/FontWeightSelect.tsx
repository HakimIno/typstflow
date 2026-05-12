import React from 'react';

interface FontWeightSelectProps {
  value: string | number | undefined;
  onChange: (value: string) => void;
  className?: string;
}

export function FontWeightSelect({ value, onChange, className }: FontWeightSelectProps) {
  // Normalize legacy string values to standard numeric string values
  let normalizedValue = String(value || '400');
  const legacyMap: Record<string, string> = {
    'thin': '100',
    'extralight': '200',
    'light': '300',
    'regular': '400',
    'normal': '400',
    'medium': '500',
    'semibold': '600',
    'bold': '700',
    'extrabold': '800',
    'black': '900',
  };

  if (legacyMap[normalizedValue.toLowerCase()]) {
    normalizedValue = legacyMap[normalizedValue.toLowerCase()];
  }

  const defaultClassName = "w-full h-6 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded text-[10px] px-1 outline-none focus:border-[var(--accent)]";

  return (
    <select
      value={normalizedValue}
      onChange={(e) => onChange(e.target.value)}
      className={className || defaultClassName}
    >
      <option value="100">Thin (100)</option>
      <option value="200">Extra Light (200)</option>
      <option value="300">Light (300)</option>
      <option value="400">Regular (400)</option>
      <option value="500">Medium (500)</option>
      <option value="600">Semi Bold (600)</option>
      <option value="700">Bold (700)</option>
      <option value="800">Extra Bold (800)</option>
      <option value="900">Black (900)</option>
    </select>
  );
}
