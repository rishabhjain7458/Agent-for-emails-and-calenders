import { Link, useRouteError, isRouteErrorResponse } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';

export function ErrorPage() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : undefined;
  const message = isRouteErrorResponse(error)
    ? error.statusText || (typeof error.data === 'string' ? error.data : JSON.stringify(error.data))
    : error instanceof Error
    ? error.message
    : 'An unexpected error occurred.';

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', px: 3, textAlign: 'center' }}>
      <Box sx={{ maxWidth: 560 }}>
        <Typography variant="h2" component="h1" gutterBottom>
          {status === 404 ? '404 — Page Not Found' : 'Something went wrong'}
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          {status === 404
            ? 'The page you are looking for does not exist or may have been moved.'
            : 'An unexpected error occurred while loading this page. Please try again or return to the dashboard.'}
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          {message}
        </Typography>
        <Button component={Link} to="/dashboard" variant="contained">
          Go to dashboard
        </Button>
      </Box>
    </Box>
  );
}
