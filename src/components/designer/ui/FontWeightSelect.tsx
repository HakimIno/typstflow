import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';

interface FontWeightSelectProps {
  value: string | number | undefined;
  onChange: (value: string) => void;
  className?: string;
}

export function FontWeightSelect({ value, onChange, className }: FontWeightSelectProps) {
  // Normalize legacy string values to standard numeric string values
  let normalizedValue = String(value || '400');
  const legacyMap: Record<string, string> = {
    thin: '100',
    extralight: '200',
    light: '300',
    regular: '400',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
    black: '900',
  };

  if (legacyMap[normalizedValue.toLowerCase()]) {
    normalizedValue = legacyMap[normalizedValue.toLowerCase()];
  }

  return (
    <Select value={normalizedValue} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Weight" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="100">Thin (100)</SelectItem>
        <SelectItem value="200">Extra Light (200)</SelectItem>
        <SelectItem value="300">Light (300)</SelectItem>
        <SelectItem value="400">Regular (400)</SelectItem>
        <SelectItem value="500">Medium (500)</SelectItem>
        <SelectItem value="600">Semi Bold (600)</SelectItem>
        <SelectItem value="700">Bold (700)</SelectItem>
        <SelectItem value="800">Extra Bold (800)</SelectItem>
        <SelectItem value="900">Black (900)</SelectItem>
      </SelectContent>
    </Select>
  );
}
