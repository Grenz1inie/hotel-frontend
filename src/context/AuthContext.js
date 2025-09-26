import React from 'react';
import { message } from 'antd';
import { loginApi, meApi } from '../services/api';

const AuthContext = React.createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = React.useState(() => {
    try {
      const raw = localStorage.getItem('auth:user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = React.useState(() => {
    try { return localStorage.getItem('auth:token') || ''; } catch { return ''; }
  });

  // try restore session
  React.useEffect(() => {
    (async () => {
      if (!token) return;
      try {
        const me = await meApi();
        if (me && me.id) {
          setUser(me);
          localStorage.setItem('auth:user', JSON.stringify(me));
        }
      } catch (e) {
        // token invalid
        setUser(null);
        setToken('');
        localStorage.removeItem('auth:user');
        localStorage.removeItem('auth:token');
      }
    })();
  }, [token]);

  const login = async (username, password) => {
    try {
      const data = await loginApi({ username, password });
      // data: { token, user }
      if (!data?.token || !data?.user) throw new Error('登录响应缺少必要字段');
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('auth:token', data.token);
      localStorage.setItem('auth:user', JSON.stringify(data.user));
      message.success('登录成功');
      return { ok: true, data: data.user };
    } catch (e) {
      const msg = e?.data?.message || e?.message || '登录失败';
      return { ok: false, error: { status: e.status, message: msg } };
    }
  };

  const logout = () => {
    setUser(null);
    setToken('');
    localStorage.removeItem('auth:user');
    localStorage.removeItem('auth:token');
  };

  const value = React.useMemo(() => ({ user, token, login, logout, isAuthed: !!user, role: user?.role }), [user, token]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
