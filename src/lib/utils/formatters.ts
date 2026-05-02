import type { FormatType } from '@/components/designer/properties/FormatPicker';

export function formatValue(value: any, format?: FormatType): string {
  if (value === undefined || value === null || value === '') return '';
  if (!format || format === 'text') return String(value);

  try {
    switch (format) {
      case 'number': {
        const num = Number(value);
        if (isNaN(num)) return String(value);
        return new Intl.NumberFormat('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(num);
      }

      case 'currency-thb': {
        const num = Number(value);
        if (isNaN(num)) return String(value);
        return new Intl.NumberFormat('th-TH', {
          style: 'currency',
          currency: 'THB',
        }).format(num);
      }

      case 'currency-usd': {
        const num = Number(value);
        if (isNaN(num)) return String(value);
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(num);
      }

      case 'percent': {
        const num = Number(value);
        if (isNaN(num)) return String(value);
        return new Intl.NumberFormat('en-US', {
          style: 'percent',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(num / 100);
      }

      case 'date-th': {
        const date = new Date(value);
        if (isNaN(date.getTime())) return String(value);
        return new Intl.DateTimeFormat('th-TH', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }).format(date);
      }

      case 'date-en': {
        const date = new Date(value);
        if (isNaN(date.getTime())) return String(value);
        return new Intl.DateTimeFormat('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }).format(date);
      }

      case 'boolean': {
        if (typeof value === 'boolean') {
          return value ? 'Yes' : 'No';
        }
        if (typeof value === 'string') {
          const v = value.toLowerCase();
          if (v === 'true' || v === '1' || v === 'yes') return 'Yes';
          if (v === 'false' || v === '0' || v === 'no') return 'No';
        }
        return value ? 'Yes' : 'No';
      }

      default:
        return String(value);
    }
  } catch (e) {
    console.error('Formatting error:', e);
    return String(value);
  }
}

/**
 * Filter available formats based on the data type
 */
export function getApplicableFormats(dataType: string): FormatType[] {
  const common: FormatType[] = ['text'];
  
  switch (dataType) {
    case 'number':
      return [...common, 'number', 'currency-thb', 'currency-usd', 'percent'];
    case 'date':
    case 'string': // Often strings are dates
      return [...common, 'date-th', 'date-en'];
    case 'boolean':
      return [...common, 'boolean'];
    default:
      return ['text', 'number', 'currency-thb', 'currency-usd', 'date-th', 'date-en', 'percent', 'boolean'];
  }
}
