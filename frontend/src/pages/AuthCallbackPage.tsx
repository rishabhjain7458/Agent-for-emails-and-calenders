import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LoadingState } from '../components/LoadingState';
import { useAuth } from '../contexts/AuthContext';

export function AuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refresh } = useAuth();

  useEffect(() => {
    async function finishLogin() {
      const token = params.get('token');
      if (token) localStorage.setItem('sessionToken', token);
      await refresh();
      navigate('/dashboard', { replace: true });
    }
    finishLogin();
  }, [navigate, params, refresh]);

  return <LoadingState />;
}
