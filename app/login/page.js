'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError('Incorrect email or password.');
      setIsSubmitting(false);
      return;
    }

    // A full page load (not router.push) so the very next request to the
    // server actually carries the fresh login cookie — a client-side
    // navigation can fire before that cookie finishes being set.
    window.location.href = '/staff';
  }

  return (
    <main className="min-h-screen bg-[#FBF3E8] flex items-center justify-center px-5">
      <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-[0_2px_12px_rgba(74,50,34,0.06)] border border-[#F0E4D3]">
        <h1 className="font-serif text-2xl font-semibold text-[#4A3222] mb-1 text-center">
          Staff Login
        </h1>
        <p className="text-sm text-[#8A6F55] mb-6 text-center">
          necesito cafecito
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border border-[#D9C3A3] rounded-lg px-3 py-2 text-sm mb-3 text-[#4A3222]"
          />
          <div className="relative mb-4">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-[#D9C3A3] rounded-lg pl-3 pr-14 py-2 text-sm text-[#4A3222]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#8A6F55]"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 rounded-lg text-sm font-medium bg-[#4A3222] text-white disabled:bg-[#D9C3A3] transition"
          >
            {isSubmitting ? 'Logging in…' : 'Log In'}
          </button>

          {error && (
            <p className="text-xs text-[#C06B76] font-medium mt-3 text-center">
              {error}
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
