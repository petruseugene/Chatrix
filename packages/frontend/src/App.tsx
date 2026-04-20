import { useQuery } from '@tanstack/react-query';
import { Box, Typography, Chip, CircularProgress } from '@mui/material';

interface HealthResponse {
  status: string;
  db: string;
}

async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error('Health check failed');
  return res.json() as Promise<HealthResponse>;
}

export default function App() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    retry: false,
  });

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
      }}
    >
      <Typography variant="h3">Chatrix</Typography>
      {isLoading && <CircularProgress />}
      {isError && <Chip label="API: error" color="error" />}
      {data && (
        <>
          <Chip label={`API: ${data.status}`} color="success" />
          <Chip label={`DB: ${data.db}`} color={data.db === 'ok' ? 'success' : 'error'} />
        </>
      )}
    </Box>
  );
}
