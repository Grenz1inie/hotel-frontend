import React from 'react';
import { Layout, Menu, Breadcrumb, ConfigProvider, theme, Dropdown, Space, Typography } from 'antd';
import { HomeOutlined, AppstoreOutlined } from '@ant-design/icons';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getWalletSummary } from '../services/api';

const { Header, Content, Footer } = Layout;

export default function AntLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [wallet, setWallet] = React.useState(null);
  const isAuthPage = location.pathname === '/login' || location.pathname === '/error';
  const selected = React.useMemo(() => {
    if (isAuthPage) return [];
    if (location.pathname.startsWith('/admin')) return ['admin'];
  if (location.pathname.startsWith('/me/profile')) return ['profile'];
    if (location.pathname === '/' || location.pathname === '') return ['home'];
    if (location.pathname.startsWith('/rooms')) return ['rooms'];
    return ['home'];
  }, [location.pathname, isAuthPage]);

  React.useEffect(() => {
    if (!user) {
      setWallet(null);
      return;
    }
    (async () => {
      try {
        const data = await getWalletSummary(5);
        setWallet(data);
      } catch (err) {
        console.warn('获取钱包信息失败', err);
      }
    })();
  }, [user]);

  const walletBalanceText = wallet?.balance != null ? Number(wallet.balance).toFixed(2) : null;

  const crumbs = React.useMemo(() => {
    const base = [{ key: 'home', title: <Link to="/">首页</Link> }];
    const path = location.pathname;

    if (path === '/') {
      return base;
    }

    if (path === '/rooms') {
      return [
        ...base,
        { key: 'rooms', title: <Link to="/rooms">房间列表</Link> }
      ];
    }

    if (path === '/login') {
      return [
        ...base,
        { key: 'login', title: <Link to="/login">登入/注册</Link> },
      ];
    }

    if (path === '/error') {
      return [
        ...base,
        { key: 'error', title: <Link to="/error">错误</Link> },
      ];
    }

    if (path.startsWith('/rooms/')) {
      return [
        ...base,
        { key: 'rooms', title: <Link to="/rooms">房间列表</Link> },
        { key: 'room-detail', title: <Link to={path}>房间详情</Link> },
      ];
    }

    if (path.startsWith('/me/profile')) {
      return [
        ...base,
        { key: 'profile', title: <Link to="/me/profile">个人中心</Link> },
      ];
    }

    if (path.startsWith('/admin')) {
      return [
        ...base,
        { key: 'admin', title: <Link to="/admin">管理控制台</Link> },
      ];
    }

    return base;
  }, [location.pathname]);

  return (
    <ConfigProvider
      theme={{ algorithm: theme.defaultAlgorithm }}
    >
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ color: '#fff', fontWeight: 700, marginRight: 24 }}>Hotel</div>
          <Menu
            theme="dark"
            mode="horizontal"
            selectedKeys={selected}
            overflowedIndicator={null}
            style={{ flex: 1, minWidth: 0 }}
            items={(() => {
              if (isAuthPage) return [];
              const items = [];
              items.push({ key: 'home', icon: <HomeOutlined />, label: <Link to="/">酒店概览</Link> });
              items.push({ key: 'rooms', icon: <AppstoreOutlined />, label: <Link to="/rooms">房间预订</Link> });
              if (user) {
                items.push({ key: 'profile', icon: <HomeOutlined />, label: <Link to="/me/profile">个人中心</Link> });
              }
              if (user?.role === 'ADMIN') {
                items.push({ key: 'admin', icon: <AppstoreOutlined />, label: <Link to="/admin">管理</Link> });
              }
              return items;
            })()}
          />
          <div style={{ marginLeft: 'auto', color: '#fff' }}>
            {user ? (
              <Dropdown
                menu={{
                  items: [
                    { key: 'role', disabled: true, label: `角色：${user.role}` },
                    { key: 'vip', disabled: true, label: `VIP：${user.vipLevel ?? 0}` },
                    { key: 'balance', disabled: true, label: `余额：${walletBalanceText != null ? `¥${walletBalanceText}` : '加载中…'}` },
                    { key: 'profile', label: '个人中心', onClick: () => navigate('/me/profile') },
                    { key: 'logout', label: '退出登录', onClick: () => { logout(); navigate('/login'); } },
                  ]
                }}
              >
                <Space style={{ cursor: 'pointer' }}>
                  <Typography.Text style={{ color: '#fff' }}>{user.username}</Typography.Text>
                </Space>
              </Dropdown>
            ) : (
              <Link to="/login" style={{ color: '#fff' }}>登入/注册</Link>
            )}
          </div>
        </Header>
        <Content style={{ padding: '16px 32px' }}>
          <Breadcrumb items={crumbs} />
          <div style={{ background: '#fff', padding: 24, borderRadius: 8, marginTop: 12 }}>
            {children}
          </div>
        </Content>
        <Footer style={{ textAlign: 'center' }}>Hotel ©{new Date().getFullYear()} Created with Ant Design</Footer>
      </Layout>
    </ConfigProvider>
  );
}
