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
        gap: 1.75,
        mb: { xs: 1.75, md: 2.5 },
        flexDirection: { xs: 'column', sm: 'row' },
        p: { xs: 1.75, sm: 2.2, md: 2.5 },
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        boxShadow: '0 18px 46px rgba(24, 35, 56, 0.08)',
        overflow: 'hidden',
        position: 'relative',
        '&::before': {
          background: 'linear-gradient(135deg, rgba(37, 87, 214, 0.18), transparent 34%, rgba(15, 159, 143, 0.12))',
          content: '""',
          inset: 0,
          opacity: 0.78,
          pointerEvents: 'none',
          position: 'absolute'
        },
        '&::after': {
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.42), transparent)',
          content: '""',
          height: '100%',
          left: 0,
          pointerEvents: 'none',
          position: 'absolute',
          top: 0,
          transform: 'translateX(-130%)',
          width: '36%'
        },
        '&:hover::after': {
          animation: 'loading-sweep 1200ms ease'
        },
        '& > *': { position: 'relative', zIndex: 1 }
      }}
    >
      <Stack spacing={0.5} sx={{ minWidth: 0 }}>
        {eyebrow && (
          <Typography variant="overline" color="primary.main" sx={{ fontWeight: 850, lineHeight: 1.2 }}>
            {eyebrow}
          </Typography>
        )}
        <Typography variant="h4" sx={{ lineHeight: 1.08, fontSize: { xs: '1.55rem', sm: '1.95rem' }, overflowWrap: 'anywhere' }}>{title}</Typography>
        {subtitle && <Typography color="text.secondary" sx={{ maxWidth: 720, lineHeight: 1.55 }}>{subtitle}</Typography>}
      </Stack>
      {action && <Box sx={{ alignSelf: { xs: 'stretch', sm: 'center' }, '& .MuiButton-root': { width: { xs: '100%', sm: 'auto' } } }}>{action}</Box>}
    </Box>
  );
}
