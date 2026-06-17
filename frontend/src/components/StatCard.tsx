import { Box, Card, CardContent, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export function StatCard({ label, value, helper, icon, accent = '#2454c6' }: { label: string; value: string | number; helper?: string; icon?: ReactNode; accent?: string }) {
  return (
    <Card className="metric-card" sx={{ height: '100%' }}>
      <CardContent>
        <Stack spacing={1.4}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Typography color="text.secondary" variant="body2" sx={{ fontWeight: 750 }}>{label}</Typography>
            {icon && (
              <Box sx={{ width: 40, height: 40, display: 'grid', placeItems: 'center', borderRadius: 2, bgcolor: `${accent}18`, color: accent, transition: 'transform 180ms ease', '.metric-card:hover &': { transform: 'rotate(-4deg) scale(1.06)' } }}>
                {icon}
              </Box>
            )}
          </Stack>
          <Typography variant="h4" sx={{ lineHeight: 1, fontSize: { xs: '2rem', sm: '2.2rem' } }}>{value}</Typography>
          {helper && <Typography color="text.secondary" variant="body2" sx={{ lineHeight: 1.55 }}>{helper}</Typography>}
        </Stack>
      </CardContent>
    </Card>
  );
}
