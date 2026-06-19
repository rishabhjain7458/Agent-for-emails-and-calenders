import type { ReactNode } from 'react';
import { Box } from '@mui/material';

export function WindowedList<T>({
  items,
  estimateSize,
  maxVisible = 36,
  renderItem
}: {
  items: T[];
  estimateSize: number;
  maxVisible?: number;
  renderItem: (item: T, index: number) => ReactNode;
}) {
  const visibleItems = items.length > maxVisible ? items.slice(0, maxVisible) : items;
  const hiddenCount = Math.max(items.length - visibleItems.length, 0);

  return (
    <Box sx={{ contentVisibility: 'auto', containIntrinsicSize: `${Math.max(estimateSize * Math.min(items.length, maxVisible), estimateSize)}px` }}>
      {visibleItems.map(renderItem)}
      {hiddenCount > 0 && (
        <Box sx={{ color: 'text.secondary', fontSize: '0.82rem', py: 1.25, textAlign: 'center' }}>
          Showing first {visibleItems.length} items. Use filters or load more to narrow the list.
        </Box>
      )}
    </Box>
  );
}
