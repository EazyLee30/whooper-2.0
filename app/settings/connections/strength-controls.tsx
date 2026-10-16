'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export function StrengthControls({ status }: { status: string }) {
  const router = useRouter();
  const [challenge, setChallenge] = useState('');
  const [method, setMethod] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(false);
  const connected = status === 'active';
  const showForm = !connected || editing;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const payload = challenge ? { challenge, code: values.get('code') } : { email: values.get('email'), password: values.get('password') };
    form.reset(); // Do not retain the password while waiting for MFA.
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/auth/whoop/strength', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error ?? '连接失败，请重试。'); return; }
      if (result.challenge) { setChallenge(result.challenge); setMethod(result.method); setMessage('请输入 WHOOP 登录验证码。'); }
      else { setChallenge(''); setEditing(false); setMessage('Strength Trainer 已连接。'); router.refresh(); }
    } catch { setMessage('网络请求失败，请重试。'); }
    finally { setBusy(false); }
  }
  async function disconnect() {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/auth/whoop/strength', { method: 'DELETE' });
      if (!response.ok) throw new Error();
      setChallenge(''); setEditing(false); setMessage('Strength Trainer 已断开。'); router.refresh();
    } catch { setMessage('断开失败，请重试。'); }
    finally { setBusy(false); }
  }
  return <section className="card strength-card" aria-labelledby="strength-heading">
    <div className="strength-header">
      <h2 id="strength-heading">Strength Trainer</h2>
      <span className={`strength-badge${connected ? ' is-connected' : ''}`}><span aria-hidden="true" />{connected ? '已连接' : status === 'reauth_required' ? '需要重新登录' : '尚未连接'}</span>
    </div>
    <p className="strength-description">{connected ? '已准备就绪。可以在 ChatGPT 或 Codex 中查询动作、组数、重量、次数与个人纪录。' : '连接你的 WHOOP 账号，查看每一次力量训练的动作与逐组记录。'}</p>
    {showForm ? <form className="strength-form" onSubmit={submit}>
      <fieldset disabled={busy}>
        <legend>{challenge ? '验证你的登录' : connected ? '重新登录 WHOOP' : '登录 WHOOP'}</legend>
        <div className="strength-fields">
          {challenge ? <label>验证码<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,8}" placeholder="输入验证码" required autoFocus /><span className="strength-hint">{method === 'SOFTWARE_TOKEN_MFA' ? '请打开验证器获取验证码。' : method === 'EMAIL_OTP' ? '验证码已发送至你的邮箱。' : '请输入收到的短信验证码。'}</span></label> : <>
            <label>WHOOP 邮箱<input name="email" type="email" autoComplete="username" placeholder="you@example.com" required maxLength={254} /></label>
            <label>WHOOP 密码<input name="password" type="password" autoComplete="current-password" placeholder="输入 WHOOP 账号密码" required maxLength={1024} /></label>
          </>}
        </div>
        <p className="strength-hint">请使用已连接的同一 WHOOP 账号。密码仅用于登录，不会保存。</p>
        <div className="strength-actions">
          <button type="submit">{busy ? '处理中…' : challenge ? '验证并连接' : '连接 Strength Trainer'}</button>
          {challenge && <button className="strength-secondary" type="button" onClick={() => { setChallenge(''); setMessage(''); }}>重新登录</button>}
          {connected && <button className="strength-secondary" type="button" onClick={() => { setEditing(false); setChallenge(''); setMessage(''); }}>取消</button>}
        </div>
      </fieldset>
    </form> : <div className="strength-actions">
      <button className="strength-secondary" type="button" disabled={busy} onClick={() => { setEditing(true); setMessage(''); }}>重新登录</button>
      <button className="strength-disconnect" type="button" disabled={busy} onClick={disconnect}>{busy ? '处理中…' : '断开连接'}</button>
    </div>}
    {status === 'reauth_required' && <button className="strength-disconnect" type="button" disabled={busy} onClick={disconnect}>断开连接</button>}
    <details className="strength-privacy"><summary>连接与隐私说明</summary><p>此功能使用非官方 WHOOP App 私有接口，可能随 WHOOP 更新失效。会话令牌加密存储，可以随时断开连接。</p></details>
    <p className="strength-message" role="status" aria-live="polite">{message}</p>
  </section>;
}
