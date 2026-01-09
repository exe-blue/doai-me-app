/**
 * Login Page - 관리자 접근 보안 게이트
 * Control Room Access
 */
import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading, isAuthenticated } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // 이미 인증된 경우 대시보드로 리다이렉트 (useEffect로 side effect 처리)
  useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, location.state, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    // TODO: rememberMe 기능 구현 필요
    const success = await login(email, password);

    if (success) {
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } else {
      setError('잘못된 이메일 또는 비밀번호입니다.');
    }
  };

  // 인증 중이면 로딩 표시
  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-doai-black-950">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-doai-yellow-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-400">리다이렉트 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 
                    bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] 
                    from-doai-black-900 via-doai-black-950 to-doai-black-950">
      {/* Grid Pattern Background */}
      <div 
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `linear-gradient(rgba(255,204,0,0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,204,0,0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
        }}
      />

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <div className="inline-flex items-center justify-center w-20 h-20 
                          rounded-full border-2 border-doai-yellow-500/30 
                          bg-doai-black-900/50 mb-4">
              <span className="text-4xl">🔒</span>
            </div>
          </Link>
          <h1 className="font-display font-bold text-2xl text-doai-yellow-500">
            DoAi.Me
          </h1>
          <p className="text-gray-500 mt-1">Control Room Access</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="card p-8">
          <div className="space-y-6">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm text-gray-400 mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input w-full"
                placeholder="admin@doai.me"
                autoComplete="email"
                disabled={isLoading}
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm text-gray-400 mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input w-full"
                placeholder="••••••••••"
                autoComplete="current-password"
                disabled={isLoading}
              />
            </div>

            {/* Remember Me */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="remember"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-doai-black-600 bg-doai-black-800 
                         text-doai-yellow-500 focus:ring-doai-yellow-500 focus:ring-offset-0"
                disabled={isLoading}
              />
              <label htmlFor="remember" className="ml-2 text-sm text-gray-400">
                Remember me
              </label>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-lg bg-error/20 border border-error/30 text-error text-sm">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3 text-lg font-semibold
                       flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>▶</span>
                  <span>ENTER</span>
                </>
              )}
            </button>

            {/* Forgot Password */}
            <div className="text-center">
              <button
                type="button"
                className="text-sm text-gray-500 hover:text-gray-400 transition-colors"
              >
                Forgot password?
              </button>
            </div>
          </div>
        </form>

        {/* Security Note */}
        <div className="text-center mt-6">
          <p className="text-xs text-gray-600 flex items-center justify-center gap-2">
            <span>⚠️</span>
            <span>Authorized Personnel Only</span>
          </p>
        </div>

        {/* Dev Hint */}
        <div className="text-center mt-4 p-3 rounded-lg bg-doai-black-800/50 border border-doai-black-700">
          <p className="text-xs text-gray-600">
            <span className="text-doai-yellow-500">Dev Mode:</span>{' '}
            admin@doai.me / doaime2025
          </p>
        </div>
      </div>
    </div>
  );
}
