/**
 * Login Page - DoAi.Me Admin Access
 * Matches deployed version style
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

    const success = await login(email, password);

    if (success) {
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } else {
      setError('잘못된 이메일 또는 비밀번호입니다.');
    }
  };

  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-[#FFCC00] border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-slate-400">리다이렉트 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <Link to="/">
            <img src="/logo-dark.svg" alt="DoAi.Me" className="h-16 mx-auto mb-4" />
          </Link>
          <h1 className="text-2xl font-bold text-slate-100">
            DoAi.Me Control Room
          </h1>
          <p className="text-slate-400 mt-2">
            관리자 계정으로 로그인하세요
          </p>
        </div>

        {/* Login Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-4"
        >
          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-300 mb-2"
            >
              이메일
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent transition-all"
              placeholder="admin@doai.me"
              autoComplete="email"
              disabled={isLoading}
              required
            />
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-300 mb-2"
            >
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent transition-all"
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={isLoading}
              required
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-[#FFCC00] hover:bg-[#FFE066] disabled:bg-[#FFCC00]/50 text-slate-900 font-semibold rounded-lg transition-colors"
          >
            {isLoading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        {/* Help Text */}
        <div className="mt-6 text-center text-sm text-slate-500">
          <p>관리자 계정이 없으신가요?</p>
          <p className="mt-1">시스템 관리자에게 문의하세요</p>
        </div>

        {/* Dev Hint */}
        <div className="mt-4 p-3 rounded-lg bg-slate-900/50 border border-slate-800 text-center">
          <p className="text-xs text-slate-600">
            <span className="text-[#FFCC00]">Dev Mode:</span>{' '}
            admin@doai.me / doaime2025
          </p>
        </div>
      </div>
    </div>
  );
}
