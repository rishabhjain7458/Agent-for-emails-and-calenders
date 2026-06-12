import { Box, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export function PageHeader({ title, subtitle, action, eyebrow }: { title: string; subtitle?: string; action?: ReactNode; eyebrow?: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between', gap: 2, mb: { xs: 2, md: 3 }, flexDirection: { xs: 'column', sm: 'row' } }}>
      <Stack spacing={0.5} sx={{ minWidth: 0 }}>
        {eyebrow && (
          <Typography variant="overline" color="primary.main" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
            {eyebrow}
          </Typography>
        )}
        <Typography variant="h4" sx={{ lineHeight: 1.15, fontSize: { xs: '1.75rem', sm: '2.125rem' }, overflowWrap: 'anywhere' }}>{title}</Typography>
        {subtitle && <Typography color="text.secondary" sx={{ maxWidth: 680 }}>{subtitle}</Typography>}
      </Stack>
      {action && <Box sx={{ alignSelf: { xs: 'stretch', sm: 'center' }, '& .MuiButton-root': { width: { xs: '100%', sm: 'auto' } } }}>{action}</Box>}
    </Box>
  );
}
