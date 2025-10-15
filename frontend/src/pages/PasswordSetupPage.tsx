import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { api } from '../lib/api';

export const PasswordSetupPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-md rounded-xl bg-white p-8 shadow">
          <h1 className="text-xl font-semibold text-slate-900">Password setup link invalid</h1>
          <p className="mt-3 text-sm text-slate-600">
            This link is missing a token. Please use the link from your email or contact the dashboard
            administrator for a new invite.
          </p>
          <Link to="/login" className="mt-6 inline-block text-sm font-semibold text-slate-600 hover:text-slate-800">
            Return to login
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (password.trim().length < 8) {
      setError('Use at least 8 characters for your password.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setStatus('submitting');
      setError(null);
      await api.auth.completePasswordSetup({ token, password: password.trim() });
      setStatus('success');
    } catch (err) {
      setStatus('idle');
      setError(err instanceof Error ? err.message : 'Unable to update password. Try again or request a new link.');
    }
  };

  if (status === 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-md rounded-xl bg-white p-8 shadow">
          <h1 className="text-xl font-semibold text-slate-900">Password updated</h1>
          <p className="mt-3 text-sm text-slate-600">
            Your password has been set. You can now sign in with your email address.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow">
        <h1 className="text-xl font-semibold text-slate-900">Set your password</h1>
        <p className="mt-3 text-sm text-slate-600">
          Create a password for your Catalyst account. Passwords must be at least 8 characters long.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="password" className="text-sm font-medium text-slate-700">
              New password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              autoComplete="new-password"
              required
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className="text-sm font-medium text-slate-700">
              Confirm password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              autoComplete="new-password"
              required
            />
          </div>

          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={status === 'submitting'}
            className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {status === 'submitting' ? 'Saving…' : 'Save password'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-400">
          If this link has expired, request a new invitation from your administrator.
        </p>
      </div>
    </div>
  );
};
