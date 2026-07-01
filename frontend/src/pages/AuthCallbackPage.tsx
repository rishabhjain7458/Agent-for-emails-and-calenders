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
      const error = params.get('error') || params.get('auth_error');
      if (error) {
        navigate(`/login?auth_error=${encodeURIComponent(error)}`, { replace: true });
        return;
      }
      if (!token) {
        navigate('/login?auth_error=Login%20did%20not%20return%20a%20session%20token', { replace: true });
        return;
      }
      localStorage.setItem('sessionToken', token);
      await refresh();
      navigate('/dashboard', { replace: true });
    }
    finishLogin();
  }, [navigate, params, refresh]);

  return <LoadingState />;
}
