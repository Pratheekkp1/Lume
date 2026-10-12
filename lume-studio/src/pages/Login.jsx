import { useState } from 'react'
import { useAuth } from '../context/auth'

const MODES = {
  signin: { title: 'Welcome back', cta: 'Sign in' },
  signup: { title: 'Create your studio', cta: 'Create account' },
  magic: { title: 'Sign in with a link', cta: 'Email me a link' },
}

export default function Login() {
  const { signIn, signUp, sendMagicLink } = useAuth()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (mode === 'magic') {
        const { error } = await sendMagicLink(email)
        if (error) throw error
        setNotice('Check your inbox for a sign-in link.')
      } else if (mode === 'signup') {
        const { data, error } = await signUp(email, password)
        if (error) throw error
        if (!data.session) setNotice('Account created. Confirm your email, then sign in.')
      } else {
        const { error } = await signIn(email, password)
        if (error) throw error
      }
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100 px-4">
      <div className="w-full max-w-sm">
        <p className="text-xs tracking-widest uppercase text-stone-400 mb-1 text-center">Lume Studio</p>
        <h1 className="font-serif text-3xl text-stone-800 mb-8 text-center">{MODES[mode].title}</h1>

        <form onSubmit={handleSubmit} className="bg-white border border-stone-200 rounded-xl p-6 space-y-4 shadow-sm">
          <label className="block">
            <span className="text-xs text-stone-500">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="mt-1 w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-800 focus:outline-none focus:border-teal-500"
            />
          </label>

          {mode !== 'magic' && (
            <label className="block">
              <span className="text-xs text-stone-500">Password</span>
              <input
                type="password"
                required
                minLength={8}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="mt-1 w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-800 focus:outline-none focus:border-teal-500"
              />
            </label>
          )}

          {error && <p className="text-xs text-coral-600" role="alert">{error}</p>}
          {notice && <p className="text-xs text-teal-700">{notice}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-teal-500 text-white text-sm font-medium py-2 rounded-md hover:bg-teal-600 transition-colors disabled:opacity-60"
          >
            {busy ? 'One moment…' : MODES[mode].cta}
          </button>
        </form>

        <div className="mt-5 flex flex-col items-center gap-2 text-xs text-stone-500">
          {mode !== 'signin' && (
            <button onClick={() => setMode('signin')} className="hover:text-stone-800">Sign in with password</button>
          )}
          {mode !== 'signup' && (
            <button onClick={() => setMode('signup')} className="hover:text-stone-800">Create an account</button>
          )}
          {mode !== 'magic' && (
            <button onClick={() => setMode('magic')} className="hover:text-stone-800">Email me a sign-in link instead</button>
          )}
        </div>
      </div>
    </div>
  )
}
