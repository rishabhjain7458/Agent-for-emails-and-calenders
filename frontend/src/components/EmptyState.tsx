import type { ReactNode } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import InboxIcon from '@mui/icons-material/Inbox';

export function EmptyState({
  title,
  description,
  icon,
  actionLabel,
  onAction
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 2, p: { xs: 2, sm: 3 }, textAlign: 'center', bgcolor: 'action.hover' }}>
      <Stack spacing={1.25} alignItems="center">
        <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2, color: 'primary.main', display: 'grid', height: 50, placeItems: 'center', width: 50 }}>
          {icon ?? <InboxIcon />}
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 900 }}>{title}</Typography>
          {description && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>{description}</Typography>}
        </Box>
        {actionLabel && onAction && <Button size="small" variant="outlined" onClick={onAction}>{actionLabel}</Button>}
      </Stack>
    </Box>
  );
}
