import { Box, CircularProgress, Stack, Typography } from '@mui/material';

export function LoadingState({ label = 'Loading workspace' }: { label?: string }) {
  return (
    <Box sx={{ p: 4, display: 'grid', placeItems: 'center', minHeight: 240 }}>
      <Stack spacing={2} alignItems="center">
        <CircularProgress size={34} thickness={4} />
        <Typography color="text.secondary" variant="body2">{label}</Typography>
      </Stack>
    </Box>
  );
}
