import { Box, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export function PageHeader({ title, subtitle, action, eyebrow }: { title: string; subtitle?: string; action?: ReactNode; eyebrow?: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 3, flexWrap: 'wrap' }}>
      <Stack spacing={0.5} sx={{ minWidth: 240 }}>
        {eyebrow && (
          <Typography variant="overline" color="primary.main" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
            {eyebrow}
          </Typography>
        )}
        <Typography variant="h4" sx={{ lineHeight: 1.15 }}>{title}</Typography>
        {subtitle && <Typography color="text.secondary" sx={{ maxWidth: 680 }}>{subtitle}</Typography>}
      </Stack>
      {action}
    </Box>
  );
}
