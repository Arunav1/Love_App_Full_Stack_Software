import { useState } from 'react';
import { Heart, Lock } from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { api } from '../lib/api.js';
import { heartBurst } from '../lib/hearts.js';

export default function LockScreen() {
  const { status, load } = useApp();
  const [code, setCode] = useState('');
  const [wrong, setWrong] = useState(false);
  const [shake, setShake] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/unlock', { code });
      heartBurst(window.innerWidth / 2, window.innerHeight / 2, 2);
      setTimeout(load, 500);
    } catch {
      setWrong(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <div className="lock">
      <div className={`card ${shake ? 'shake' : ''}`}>
        <Lock size={28} color="var(--pink)" />
        <h1>Hello, {status.herName}</h1>
        <p>This little universe belongs to just one person.<br />{status.hint}</p>
        <form onSubmit={submit}>
          <input className="input" type="password" autoFocus value={code} placeholder="The secret word"
            onChange={(e) => { setCode(e.target.value); setWrong(false); }} />
          <button className="btn primary"><Heart size={16} fill="currentColor" /> Let me in</button>
          {wrong && <small style={{ color: 'var(--pink)' }}>Hmm, that’s not it. Try again, my love.</small>}
        </form>
      </div>
    </div>
  );
}
