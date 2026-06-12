import { Box, Card, CardContent, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export function StatCard({ label, value, helper, icon, accent = '#2454c6' }: { label: string; value: string | number; helper?: string; icon?: ReactNode; accent?: string }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack spacing={1.25}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Typography color="text.secondary" variant="body2" sx={{ fontWeight: 750 }}>{label}</Typography>
            {icon && (
              <Box sx={{ width: 36, height: 36, display: 'grid', placeItems: 'center', borderRadius: 2, bgcolor: `${accent}18`, color: accent }}>
                {icon}
              </Box>
            )}
          </Stack>
          <Typography variant="h4" sx={{ lineHeight: 1 }}>{value}</Typography>
          {helper && <Typography color="text.secondary" variant="body2">{helper}</Typography>}
        </Stack>
      </CardContent>
    </Card>
  );
}
