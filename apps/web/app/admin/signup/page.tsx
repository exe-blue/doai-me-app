// apps/web/app/admin/signup/page.tsx
// 회원가입 페이지 - Supabase 인증 연동

'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

interface FormErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const router = useRouter();
  
  // 폼 유효성 검사
  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    
    // 이메일 형식 검사
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.email = '올바른 이메일 형식을 입력해주세요';
    }
    
    // 비밀번호 최소 길이 검사
    if (password.length < 8) {
      errors.password = '비밀번호는 최소 8자 이상이어야 합니다';
    }
    
    // 비밀번호 확인 일치 검사
    if (password !== confirmPassword) {
      errors.confirmPassword = '비밀번호가 일치하지 않습니다';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/admin/login`,
        },
      });
      
      if (signUpError) {
        // Supabase 에러 메시지 한국어화
        if (signUpError.message.includes('already registered')) {
          setError('이미 등록된 이메일입니다');
        } else if (signUpError.message.includes('Invalid email')) {
          setError('유효하지 않은 이메일입니다');
        } else {
          setError(signUpError.message);
        }
        return;
      }
      
      if (data.user) {
        setSuccess(true);
      }
    } catch (err) {
      setError('회원가입 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };
  
  // 회원가입 성공 화면
  if (success) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-8">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-emerald-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-100 mb-2">
              이메일 확인이 필요합니다
            </h2>
            <p className="text-slate-400 mb-6">
              <span className="text-emerald-400 font-medium">{email}</span>
              으로 확인 메일을 보냈습니다.
              <br />
              메일의 링크를 클릭하여 회원가입을 완료해주세요.
            </p>
            <Link
              href="/admin/login"
              className="inline-flex items-center justify-center w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium rounded-lg transition-colors"
            >
              로그인 페이지로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <Image
            src="/logo.svg"
            alt="DoAi.Me"
            width={200}
            height={67}
            className="mx-auto"
            priority
          />
          <p className="text-slate-400 mt-4">
            새 계정을 생성하세요
          </p>
        </div>
        
        {/* Sign Up Form */}
        <form
          onSubmit={handleSignUp}
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
              onChange={(e) => {
                setEmail(e.target.value);
                if (formErrors.email) {
                  setFormErrors((prev) => ({ ...prev, email: undefined }));
                }
              }}
              className={`w-full px-4 py-3 bg-slate-800 border rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#162b96] focus:border-transparent transition-colors ${
                formErrors.email ? 'border-red-500' : 'border-slate-700'
              }`}
              placeholder="your@email.com"
              required
            />
            {formErrors.email && (
              <p className="mt-1.5 text-sm text-red-400">{formErrors.email}</p>
            )}
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
              onChange={(e) => {
                setPassword(e.target.value);
                if (formErrors.password) {
                  setFormErrors((prev) => ({ ...prev, password: undefined }));
                }
              }}
              className={`w-full px-4 py-3 bg-slate-800 border rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#162b96] focus:border-transparent transition-colors ${
                formErrors.password ? 'border-red-500' : 'border-slate-700'
              }`}
              placeholder="최소 8자 이상"
              required
            />
            {formErrors.password && (
              <p className="mt-1.5 text-sm text-red-400">{formErrors.password}</p>
            )}
          </div>
          
          {/* Confirm Password */}
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-slate-300 mb-2"
            >
              비밀번호 확인
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (formErrors.confirmPassword) {
                  setFormErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                }
              }}
              className={`w-full px-4 py-3 bg-slate-800 border rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#162b96] focus:border-transparent transition-colors ${
                formErrors.confirmPassword ? 'border-red-500' : 'border-slate-700'
              }`}
              placeholder="비밀번호를 다시 입력하세요"
              required
            />
            {formErrors.confirmPassword && (
              <p className="mt-1.5 text-sm text-red-400">{formErrors.confirmPassword}</p>
            )}
          </div>
          
          {/* Password Requirements */}
          <div className="p-3 bg-slate-800/50 rounded-lg">
            <p className="text-xs text-slate-400 mb-2">비밀번호 요구사항:</p>
            <ul className="text-xs text-slate-500 space-y-1">
              <li className={`flex items-center gap-2 ${password.length >= 8 ? 'text-emerald-400' : ''}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${password.length >= 8 ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                최소 8자 이상
              </li>
              <li className={`flex items-center gap-2 ${password === confirmPassword && password.length > 0 ? 'text-emerald-400' : ''}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${password === confirmPassword && password.length > 0 ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                비밀번호 일치
              </li>
            </ul>
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
            disabled={loading}
            className="w-full py-3 px-4 bg-[#162b96] hover:bg-[#1a35b0] disabled:bg-[#162b96]/50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                회원가입 중...
              </>
            ) : (
              '회원가입'
            )}
          </button>
        </form>
        
        {/* Login Link */}
        <div className="mt-6 text-center text-sm text-slate-500">
          <p>
            이미 계정이 있으신가요?{' '}
            <Link
              href="/admin/login"
              className="text-[#3b5bdb] hover:text-[#5c7cfa] font-medium transition-colors"
            >
              로그인
            </Link>
          </p>
        </div>
        
        {/* Terms */}
        <p className="mt-4 text-center text-xs text-slate-600">
          회원가입 시{' '}
          <span className="text-slate-500 underline cursor-pointer hover:text-slate-400">
            서비스 이용약관
          </span>
          {' '}및{' '}
          <span className="text-slate-500 underline cursor-pointer hover:text-slate-400">
            개인정보 처리방침
          </span>
          에 동의하게 됩니다.
        </p>
      </div>
    </div>
  );
}
