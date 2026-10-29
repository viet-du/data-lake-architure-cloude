import { useState, type FormEvent } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/services/api/client';
import { useAuthStore, type UserProfile } from '@/store';

type LoginResponse = {
  token: string;
  user: UserProfile;
};

export function LoginView() {
  const { t } = useTranslation();
  const setUser = useAuthStore((state) => state.setUser);
  const setToken = useAuthStore((state) => state.setToken);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await apiClient.post<{ data: LoginResponse }>('/api/auth/login', {
        email,
        password,
      });
      setUser(response.data.data.user);
      setToken(response.data.data.token);
    } catch (cause) {
      setError(axios.isAxiosError(cause) && cause.response?.status === 401
        ? t('auth.invalidCredentials')
        : t('auth.unavailable'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-full flex-1 items-center justify-center overflow-y-auto bg-neutral-50 px-5 py-10 dark:bg-neutral-950">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-7 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div className="mb-7 border-b border-neutral-200 pb-5 dark:border-neutral-800">
          <p className="text-xs font-semibold uppercase text-primary-700 dark:text-primary-300">Data Lake</p>
          <h1 className="mt-2 text-2xl font-semibold text-neutral-950 dark:text-white">{t('auth.signIn')}</h1>
        </div>

        <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-200">
          {t('auth.email')}
        </label>
        <input
          id="login-email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mb-4 h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-600/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
        />

        <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-200">
          {t('auth.password')}
        </label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-600/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
        />

        {error ? <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 h-10 w-full rounded-md bg-primary-700 px-4 text-sm font-semibold text-white hover:bg-primary-800 disabled:cursor-wait disabled:opacity-60"
        >
          {submitting ? t('common.loading') : t('auth.signIn')}
        </button>
      </form>
    </main>
  );
}
