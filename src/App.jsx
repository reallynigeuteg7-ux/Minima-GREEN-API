import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Check, CheckCheck, ChevronDown, CircleHelp, Clock3,
  ExternalLink, KeyRound, LoaderCircle, LockKeyhole, LogOut, MessageCircle,
  MessageSquarePlus, MoreHorizontal, Plus, Search, Send, Server, ShieldCheck,
  Smartphone, Sparkles, Wifi, X,
} from 'lucide-react';
import { api } from './api.js';
import { demoContacts, demoMessages } from './demo.js';

const contactsKey = (instance) => `minima-whatsapp-contacts-${instance}-v1`;
const readContacts = (instance) => {
  try {
    const data = JSON.parse(localStorage.getItem(contactsKey(instance)) || '[]');
    return Array.isArray(data) ? data.filter(c => typeof c.id === 'string' && typeof c.name === 'string').slice(0, 100) : [];
  } catch { return []; }
};
const initials = (name = '?') => name.trim().split(/\s+/).slice(0, 2).map(x => x[0]?.toUpperCase()).join('') || '?';
const shade = (value = '') => {
  const palette = ['avatar-purple', 'avatar-blue', 'avatar-orange', 'avatar-pink', 'avatar-green'];
  let seed = 0;
  for (const char of value) seed += char.charCodeAt(0);
  return palette[seed % palette.length];
};
const t = (stamp) => new Date((stamp || 0) * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
const merge = (previous, incoming) => {
  const store = new Map();
  for (const msg of previous || []) store.set(msg.id, msg);
  for (const msg of incoming || []) store.set(msg.id, { ...store.get(msg.id), ...msg });
  return [...store.values()].sort((a, b) => a.timestamp - b.timestamp);
};

function Logo({ small = false }) {
  return (
    <span className={`logo ${small ? 'logo-sm' : ''}`} aria-label="Minima">
      <span className="logo-mark"><MessageCircle size={small ? 18 : 22} strokeWidth={2.6} fill="currentColor" /></span>
      <span className="logo-word">minima<span>.</span></span>
    </span>
  );
}

function Avatar({ name, size = 'regular', online = false }) {
  return <span className={`avatar ${shade(name)} avatar-${size}`} aria-hidden="true">
    {initials(name)}{online && <span className="avatar-online" />}
  </span>;
}

function Connect({ onConnect, onDemo }) {
  const [apiUrl, setApiUrl] = useState('https://7201.api.green-api.com');
  const [idInstance, setIdInstance] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try { await onConnect({ apiUrl: apiUrl.trim(), idInstance: idInstance.trim(), apiTokenInstance: token.trim() }); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };
  return (
    <div className="connect-page">
      <div className="connect-aura aura-left" /><div className="connect-aura aura-right" />
      <header className="connect-nav"><Logo /><span className="connect-nav-note"><span className="online-indicator" /> Powered by GREEN-API</span></header>
      <main className="connect-layout">
        <section className="connect-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> MESSAGING, SIMPLIFIED</div>
          <h1>Общение.<br /><span>Без лишнего.</span></h1>
          <p className="connect-lead">Ваши сообщения WhatsApp в одном месте. Минималистичный интерфейс, быстрые ответы и ничего, что отвлекает.</p>
          <div className="connect-points">
            <div><span className="point-icon"><MessageCircle size={18} /></span><span><strong>Всё в реальном времени</strong><small>Отправляйте сообщения и получайте ответы</small></span></div>
            <div><span className="point-icon"><ShieldCheck size={18} /></span><span><strong>Безопасное подключение</strong><small>API-токен остаётся на сервере</small></span></div>
            <div><span className="point-icon"><Sparkles size={18} /></span><span><strong>Ничего лишнего</strong><small>Только самое важное для общения</small></span></div>
          </div>
          <div className="connect-footnote">React + GREEN-API <span /> WhatsApp Messenger</div>
        </section>
        <section className="connect-card-wrap">
          <div className="connect-card">
            <div className="connect-card-top"><span className="card-icon"><LockKeyhole size={23} /></span><span className="card-kicker">ШАГ 01 / ПОДКЛЮЧЕНИЕ</span></div>
            <h2>Подключить аккаунт</h2>
            <p>Введите данные вашего инстанса из личного кабинета GREEN-API.</p>
            <form onSubmit={submit} className="connect-form">
              <label htmlFor="api-url">Адрес API</label>
              <div className="form-field"><Server size={18} /><input id="api-url" aria-label="Адрес API" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder="https://7201.api.green-api.com" required autoComplete="url" /></div>
              <label htmlFor="id-instance">ID инстанса</label>
              <div className="form-field"><Smartphone size={18} /><input id="id-instance" value={idInstance} onChange={(e) => setIdInstance(e.target.value)} inputMode="numeric" placeholder="Например, 720100000000" required autoComplete="off" /></div>
              <label htmlFor="api-token">API Token Instance</label>
              <div className="form-field"><KeyRound size={18} /><input id="api-token" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Ваш секретный токен" required autoComplete="off" /></div>
              {error && <div role="alert" className="error-box">{error}</div>}
              <button className="primary-button" disabled={loading} type="submit">{loading ? <><LoaderCircle size={18} className="spin" /> Проверяем подключение...</> : <>Продолжить <ArrowRight size={18} /></>}</button>
            </form>
            <div className="connect-divider"><span>или</span></div>
            <button type="button" className="demo-button" onClick={onDemo}><Sparkles size={17} /> Посмотреть демо без подключения <ArrowRight size={17} /></button>
            <div className="privacy-note"><ShieldCheck size={17} /><span>Данные подключения хранятся только во временной памяти сервера, не в браузере.</span></div>
          </div>
          <p className="support-link">Нет инстанса? <a href="https://console.green-api.com/" target="_blank" rel="noreferrer">Создать в GREEN-API <ExternalLink size={13} /></a></p>
        </section>
      </main>
      <footer className="connect-footer">СОЗДАНО ДЛЯ ПРОСТОГО ОБЩЕНИЯ <span>© 2026 MINIMA</span></footer>
    </div>
  );
}

function Authorize({ instance, onReady, onCancel }) {
  const [qr, setQr] = useState('');
  const [state, setState] = useState('starting');
  const [error, setError] = useState('');
  const ready = useRef(onReady);
  ready.current = onReady;
  useEffect(() => {
    let stopped = false;
    let timer;
    const refresh = async () => {
      try {
        const session = await api('/session');
        if (stopped) return;
        if (session.connected) { ready.current(); return; }
        setState(session.stateInstance || 'starting');
        const result = await api('/auth/qr');
        if (stopped) return;
        if (result?.type === 'qrCode' && typeof result.message === 'string') {
          setQr(result.message.startsWith('data:image/') ? result.message : `data:image/png;base64,${result.message}`);
          setError('');
        } else if (result?.type === 'error') {
          setQr('');
          setError(result.message || 'QR-код пока недоступен.');
        }
      } catch (err) { if (!stopped) { setError(err.message); setQr(''); } }
      if (!stopped) timer = setTimeout(refresh, 5000);
    };
    refresh();
    return () => { stopped = true; clearTimeout(timer); };
  }, []);
  return <div className="connect-page"><header className="connect-nav"><Logo /></header><main className="connect-card" style={{ maxWidth: 480, margin: '32px auto', width: 'calc(100% - 32px)' }}>
    <h2>Войти в WhatsApp</h2><p>Инстанс {instance} · {({ starting: 'Подготовка подключения', notAuthorized: 'Ожидаем входа с телефона', blocked: 'Аккаунт заблокирован', sleeping: 'Пробуждаем подключение' })[state] || 'Подключаем WhatsApp'}</p>
    <p>На телефоне: WhatsApp → Настройки (или меню ⋮) → Связанные устройства → Привязать устройство. Отсканируйте QR-код.</p>
    {qr ? <img src={qr} alt="QR-код для входа в WhatsApp" style={{ display: 'block', width: 256, maxWidth: '100%', margin: '24px auto', background: 'white', borderRadius: 12, padding: 12 }} /> : <p><LoaderCircle size={18} className="spin" /> Ожидаем QR-код от GREEN-API…</p>}
    {error && <div className="error-box" role="alert">{error}</div>}<p className="privacy-note">После входа подключение завершится автоматически.</p><button className="demo-button" onClick={onCancel}>Отменить подключение</button>
  </main></div>;
}

function AddChat({ onClose, onAdd, demo }) {
  const [type, setType] = useState('phone');
  const [value, setValue] = useState('');
  const [name, setName] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    setWorking(true);
    setError('');
    try {
      const clean = type === 'phone' ? value.replace(/[^\d]/g, '') : value.trim();
      if (!clean) throw new Error('Введите номер телефона или chatId.');
      await onAdd({ type, value: clean, name: name.trim() });
    } catch (err) { setError(err.message); }
    finally { setWorking(false); }
  };
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={e => e.stopPropagation()}>
      <div className="modal-head"><span className="modal-icon"><MessageSquarePlus size={21} /></span><button onClick={onClose} className="icon-button modal-x" aria-label="Закрыть"><X size={20} /></button></div>
      <h2 id="modal-title">Новый чат</h2><p>Введите номер пользователя WhatsApp или идентификатор чата.</p>
      <div className="toggle-tabs"><button type="button" className={type === 'phone' ? 'selected' : ''} onClick={() => { setType('phone'); setValue(''); setError(''); }}>По номеру</button><button type="button" className={type === 'id' ? 'selected' : ''} onClick={() => { setType('id'); setValue(''); setError(''); }}>По chatId</button></div>
      <form className="modal-form" onSubmit={submit}>
        <label htmlFor="new-number">{type === 'phone' ? 'Номер телефона' : 'Идентификатор чата'}</label>
        <div className="form-field"><Smartphone size={18} /><input id="new-number" value={value} onChange={e => setValue(e.target.value)} placeholder={type === 'phone' ? '+7 701 123-45-67' : '77011234567@c.us'} autoFocus required /></div>
        <label htmlFor="new-name">Название контакта <span className="optional">(необязательно)</span></label>
        <div className="form-field"><MessageCircle size={18} /><input id="new-name" value={name} onChange={e => setName(e.target.value)} placeholder="Например, Александр" maxLength={60} /></div>
        {type === 'phone' && <p className="help-note"><CircleHelp size={15} /> {demo ? 'В демо можно использовать любой номер.' : 'Международный номер с кодом страны, например +7 701 123-45-67.'}</p>}
        {error && <div role="alert" className="error-box">{error}</div>}
        <button type="submit" disabled={working} className="primary-button">{working ? <><LoaderCircle className="spin" size={18} /> Проверяем...</> : <>Начать переписку <ArrowRight size={18} /></>}</button>
      </form>
    </div>
  </div>;
}

function ChatBubble({ msg }) {
  const outgoing = msg.direction === 'outgoing';
  return <div className={`message-line ${outgoing ? 'mine' : 'theirs'}`}>
    <div className={`bubble ${outgoing ? 'bubble-out' : 'bubble-in'} ${msg.status === 'failed' ? 'bubble-failed' : ''}`}>
      <div className="bubble-text">{msg.text}</div>
      <div className="bubble-meta"><time>{t(msg.timestamp)}</time>{outgoing && <span title={msg.status || 'В очереди'}>{msg.status === 'read' || msg.status === 'delivered' ? <CheckCheck size={14} /> : msg.status === 'pending' ? <Clock3 size={13} /> : <Check size={14} />}</span>}</div>
    </div>
  </div>;
}

function Messenger({ mode, instance, onLogout }) {
  const demo = mode === 'demo';
  const [contacts, setContacts] = useState(() => demo ? demoContacts : readContacts(instance));
  const [histories, setHistories] = useState(() => demo ? demoMessages() : {});
  const [activeId, setActiveId] = useState(() => demo ? demoContacts[0].id : null);
  const [query, setQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [notice, setNotice] = useState('');
  const [mobileChat, setMobileChat] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const chatEnd = useRef(null);
  const textarea = useRef(null);
  const contactsRef = useRef(contacts);
  contactsRef.current = contacts;

  useEffect(() => {
    if (!demo) localStorage.setItem(contactsKey(instance), JSON.stringify(contacts));
  }, [contacts, demo, instance]);

  useEffect(() => {
    if (demo) return;
    let alive = true;
    api('/chats').then(({ chats }) => {
      if (alive) setContacts(prev => [...new Map([...prev, ...chats].map(c => [c.id, c])).values()]);
    }).catch(error => { if (alive) setNotice(error.message); });
    return () => { alive = false; };
  }, [demo, instance]);

  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(timeout);
  }, [notice]);

  const openChat = useCallback(async (id) => {
    setActiveId(id);
    setMobileChat(true);
    if (demo) return;
    setLoadingChat(true);
    try {
      const result = await api(`/chats/${encodeURIComponent(id)}/messages`);
      setHistories(prev => ({ ...prev, [id]: merge(prev[id], result.messages) }));
    } catch (error) { setNotice(error.message); }
    finally { setLoadingChat(false); }
  }, [demo]);

  useEffect(() => {
    if (demo) return;
    let stopped = false;
    let next;
    const loop = async () => {
      if (stopped) return;
      try {
        const { updates } = await api('/updates');
        if (stopped) return;
        for (const event of updates) {
          if (event.kind === 'status') {
            setHistories(prev => Object.fromEntries(Object.entries(prev).map(([id, messages]) => [id, messages.map(msg => msg.id === event.id ? { ...msg, status: event.status } : msg)])));
          } else if (event.kind === 'message') {
            setHistories(prev => ({ ...prev, [event.chatId]: merge(prev[event.chatId], [event]) }));
            setContacts(prev => prev.some(contact => contact.id === event.chatId) ? prev : [...prev, { id: event.chatId, name: event.senderName || `Чат ${event.chatId}`, phone: '' }]);
          }
        }
      } catch (error) {
        if (!stopped) {
          setNotice(error.message);
          if (error.status === 401) return onLogout();
        }
      }
      if (!stopped) next = setTimeout(loop, 1800);
    };
    loop();
    return () => { stopped = true; clearTimeout(next); };
  }, [demo, onLogout]);

  const messages = histories[activeId] || [];
  const lastId = messages.at(-1)?.id;
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [lastId, activeId]);

  const active = contacts.find(c => c.id === activeId);
  const filtered = useMemo(() => [...contacts].filter(c => `${c.name} ${c.phone || ''} ${c.id}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => {
    const lastA = histories[a.id]?.at(-1)?.timestamp || 0;
    const lastB = histories[b.id]?.at(-1)?.timestamp || 0;
    return lastB - lastA;
  }), [contacts, query, histories]);

  const addChat = async ({ type, value, name }) => {
    let id;
    if (demo) {
      id = type === 'phone' ? value : value;
    } else {
      const data = await api('/chats/resolve', { method: 'POST', body: type === 'phone' ? { phone: value } : { chatId: value } });
      id = data.chatId;
    }
    const display = name || (type === 'phone' ? `+${value}` : `Чат ${id}`);
    setContacts(prev => prev.some(c => c.id === id) ? prev : [...prev, { id, name: display, phone: type === 'phone' ? value : '' }]);
    setShowAdd(false);
    await openChat(id);
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || !activeId || sending || text.length > 4000) return;
    const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const msg = { id: tempId, chatId: activeId, text, direction: 'outgoing', timestamp: Math.floor(Date.now() / 1000), status: 'pending' };
    setHistories(prev => ({ ...prev, [activeId]: merge(prev[activeId], [msg]) }));
    setInput('');
    setSending(true);
    if (demo) {
      setHistories(prev => ({ ...prev, [activeId]: (prev[activeId] || []).map(m => m.id === tempId ? { ...m, status: 'sent' } : m) }));
      setSending(false);
      setTimeout(() => setHistories(prev => ({ ...prev, [activeId]: merge(prev[activeId], [{ id: `reply-${tempId}`, chatId: activeId, text: 'Получено! Это демонстрационный ответ, не сообщение из WhatsApp.', direction: 'incoming', timestamp: Math.floor(Date.now() / 1000) }]) })), 1100);
      return;
    }
    try {
      const result = await api('/messages', { method: 'POST', body: { chatId: activeId, text } });
      setHistories(prev => ({ ...prev, [activeId]: merge((prev[activeId] || []).filter(m => m.id !== result.id || m.id === tempId).map(m => m.id === tempId ? { ...m, id: result.id, status: 'sent' } : m), []) }));
    } catch (error) {
      setHistories(prev => ({ ...prev, [activeId]: (prev[activeId] || []).filter(m => m.id !== tempId) }));
      setInput(text);
      setNotice(`Не удалось отправить: ${error.message}`);
    } finally { setSending(false); textarea.current?.focus(); }
  };

  return <div className="app-shell">
    <aside className={`sidebar ${mobileChat ? 'mobile-hidden' : ''}`}>
      <div className="sidebar-brand"><Logo small /><button className="icon-button sidebar-menu" onClick={() => setShowMenu(s => !s)} aria-label="Открыть меню"><MoreHorizontal size={22} /></button>
        {showMenu && <div className="dropdown-menu"><button onClick={onLogout}><LogOut size={16} /> {demo ? 'Выйти из демо' : 'Отключить аккаунт'}</button></div>}
      </div>
      <div className="sidebar-toolbar"><div className="sidebar-heading"><div><p className="section-label">ВАШЕ ПРОСТРАНСТВО</p><h2>Сообщения <span>{contacts.length}</span></h2></div><button aria-label="Новый чат" title="Новый чат" className="new-chat" onClick={() => setShowAdd(true)}><Plus size={21} /></button></div>
        <div className="search-field"><Search size={18} /><input aria-label="Поиск контактов" placeholder="Поиск по чатам..." value={query} onChange={e => setQuery(e.target.value)} /><kbd>⌘ K</kbd></div>
      </div>
      <div className="chat-list-heading"><span>ЧАТЫ</span><span>{filtered.length.toString().padStart(2, '0')}</span></div>
      <div className="chat-list">
        {filtered.length ? filtered.map(chat => {
          const last = histories[chat.id]?.at(-1);
          return <button key={chat.id} onClick={() => openChat(chat.id)} className={`contact ${activeId === chat.id ? 'active' : ''}`}>
            <Avatar name={chat.name} />
            <div className="contact-text"><div className="contact-title"><strong>{chat.name}</strong><time>{last ? t(last.timestamp) : ''}</time></div><p>{last ? `${last.direction === 'outgoing' ? 'Вы: ' : ''}${last.text}` : 'Начните общение'}</p></div>
          </button>;
        }) : <div className="no-contacts"><MessageCircle size={26} /><strong>{query ? 'Ничего не найдено' : 'Здесь пока пусто'}</strong><span>{query ? 'Попробуйте другой запрос.' : 'Создайте чат, чтобы начать переписку.'}</span></div>}
      </div>
      <div className="sidebar-bottom"><div className="account-dot"><span className="account-avatar"><Wifi size={17} /></span><div><strong>{demo ? 'Демо-режим' : 'WhatsApp подключён'}</strong><small>{demo ? 'Без реальной отправки' : `Instance ${instance}`}</small></div><span className="status-light" /></div></div>
    </aside>
    <main className={`chat-area ${!mobileChat ? 'mobile-hidden' : ''}`}>
      {active ? <>
        <header className="chat-header"><button className="icon-button back-button" aria-label="К списку чатов" onClick={() => setMobileChat(false)}><ArrowLeft size={21} /></button><Avatar name={active.name} size="small" /><div className="chat-header-name"><strong>{active.name}</strong><span>{active.phone ? `+${active.phone}` : `ID: ${active.id}`}</span></div><div className="header-spacer" /><span className="header-info">{demo ? <><span className="demo-mini-dot" /> Демо</> : <><span className="online-indicator" /> Подключено</>}</span></header>
        <div className="conversation" role="log" aria-label="История переписки"><div className="conversation-inner">
          <div className="history-banner"><span>ПЕРЕПИСКА</span><span className="history-line" /><span>WhatsApp</span></div>
          {loadingChat && <p className="loading-history"><LoaderCircle size={16} className="spin" /> Обновляем историю...</p>}
          {messages.length ? <><div className="conversation-date">Сегодня и ранее</div>{messages.map(msg => <ChatBubble key={msg.id} msg={msg} />)}</> : <div className="conversation-empty"><div className="empty-message-icon"><MessageCircle size={32} /></div><h3>Начните разговор</h3><p>Отправьте первое сообщение. Оно появится прямо здесь.</p></div>}
          <div ref={chatEnd} />
        </div></div>
        <div className="composer-wrap"><form className="composer" onSubmit={sendMessage}><textarea ref={textarea} rows={1} value={input} onChange={e => setInput(e.target.value)} maxLength={4000} placeholder="Напишите сообщение..." aria-label="Текст сообщения" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form.requestSubmit(); } }} /><div className="composer-right"><span className="composer-count">{input.length > 0 ? `${input.length}/4000` : 'Enter ↵'}</span><button aria-label="Отправить сообщение" type="submit" disabled={!input.trim() || sending} className="send-button">{sending ? <LoaderCircle size={18} className="spin" /> : <Send size={19} />}</button></div></form><p className="composer-caption"><ShieldCheck size={14} /> {demo ? 'Демонстрационные сообщения не отправляются в WhatsApp' : 'Сообщения отправляются через GREEN-API'} <span>Shift + Enter — новая строка</span></p></div>
      </> : <div className="welcome-empty"><div className="welcome-halo"><div className="welcome-core"><MessageCircle size={44} /></div></div><span className="welcome-eyebrow">ВАШЕ ПРОСТРАНСТВО ДЛЯ ОБЩЕНИЯ</span><h2>Каждый разговор<br />имеет значение.</h2><p>Выберите переписку слева или начните новую. Самое важное — просто быть на связи.</p><button className="welcome-btn" onClick={() => setShowAdd(true)}><MessageSquarePlus size={19} /> Создать чат <ArrowRight size={17} /></button><span className="welcome-bottom">MINIMA / MESSAGING MADE SIMPLE</span></div>}
    </main>
    {demo && <span className="demo-flag">ДЕМОНСТРАЦИЯ</span>}
    {showAdd && <AddChat onClose={() => setShowAdd(false)} onAdd={addChat} demo={demo} />}
    {notice && <div className="toast" role="alert"><span>{notice}</span><button aria-label="Закрыть" onClick={() => setNotice('')}><X size={17} /></button></div>}
  </div>;
}

export default function App() {
  const [mode, setMode] = useState('checking');
  const [instance, setInstance] = useState(null);
  useEffect(() => {
    let alive = true;
    api('/session').then(res => {
      if (!alive) return;
      setInstance(res.idInstance);
      setMode(res.connected ? 'live' : res.pending ? 'authorizing' : 'guest');
    }).catch(() => { if (alive) setMode('guest'); });
    return () => { alive = false; };
  }, []);
  const connect = async (creds) => {
    const data = await api('/session', { method: 'POST', body: creds });
    setInstance(data.idInstance);
    setMode(data.connected ? 'live' : 'authorizing');
  };
  const logout = useCallback(async () => {
    if (mode === 'live' || mode === 'authorizing') {
      try { await api('/logout', { method: 'POST' }); } catch { /* session may already be expired */ }
    }
    setMode('guest');
    setInstance(null);
  }, [mode]);
  if (mode === 'checking') return <div className="app-loading"><Logo /><LoaderCircle size={22} className="spin" /></div>;
  if (mode === 'authorizing') return <Authorize instance={instance} onReady={() => setMode('live')} onCancel={logout} />;
  if (mode === 'guest') return <Connect onConnect={connect} onDemo={() => setMode('demo')} />;
  return <Messenger key={mode} mode={mode} instance={instance} onLogout={logout} />;
}
