import { Box, LinearProgress, Skeleton, Stack, Typography } from '@mui/material';

export function LoadingState({ label = 'Loading workspace' }: { label?: string }) {
  return (
    <Box sx={{ p: { xs: 2, sm: 4 }, display: 'grid', placeItems: 'center', minHeight: 280 }}>
      <Stack spacing={2.25} alignItems="stretch" sx={{ width: 'min(520px, 100%)' }}>
        <Box className="premium-panel" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2.25 }}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1.25} alignItems="center">
              <Skeleton variant="circular" width={42} height={42} />
              <Box sx={{ flex: 1 }}>
                <Skeleton width="56%" height={22} />
                <Skeleton width="34%" height={18} />
              </Box>
            </Stack>
            <LinearProgress />
            <Stack spacing={0.8}>
              <Skeleton height={18} />
              <Skeleton height={18} width="82%" />
              <Skeleton height={18} width="64%" />
            </Stack>
          </Stack>
        </Box>
        <Typography color="text.secondary" textAlign="center" variant="body2" sx={{ fontWeight: 750 }}>{label}</Typography>
      </Stack>
    </Box>
  );
}
