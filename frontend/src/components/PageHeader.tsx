import { Box, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export function PageHeader({ title, subtitle, action, eyebrow }: { title: string; subtitle?: string; action?: ReactNode; eyebrow?: string }) {
  return (
    <Box
      className="premium-panel"
      sx={{
        display: 'flex',
        alignItems: { xs: 'stretch', sm: 'center' },
        justifyContent: 'space-between',
        gap: 2,
        mb: { xs: 2, md: 3 },
        flexDirection: { xs: 'column', sm: 'row' },
        p: { xs: 2, sm: 2.5, md: 3 },
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        boxShadow: '0 18px 44px rgba(24, 35, 56, 0.07)'
      }}
    >
      <Stack spacing={0.5} sx={{ minWidth: 0 }}>
        {eyebrow && (
          <Typography variant="overline" color="primary.main" sx={{ fontWeight: 850, lineHeight: 1.2 }}>
            {eyebrow}
          </Typography>
        )}
        <Typography variant="h4" sx={{ lineHeight: 1.1, fontSize: { xs: '1.65rem', sm: '2.1rem' }, overflowWrap: 'anywhere' }}>{title}</Typography>
        {subtitle && <Typography color="text.secondary" sx={{ maxWidth: 720, lineHeight: 1.65 }}>{subtitle}</Typography>}
      </Stack>
      {action && <Box sx={{ alignSelf: { xs: 'stretch', sm: 'center' }, '& .MuiButton-root': { width: { xs: '100%', sm: 'auto' } } }}>{action}</Box>}
    </Box>
  );
}
