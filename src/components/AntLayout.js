import React from 'react';
import { Layout, Menu, Breadcrumb, ConfigProvider, theme, Dropdown, Space, Typography } from 'antd';
import { HomeOutlined, AppstoreOutlined } from '@ant-design/icons';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const { Header, Content, Footer } = Layout;

export default function AntLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/error';
  const selected = React.useMemo(() => {
    if (isAuthPage) return [];
    if (location.pathname.startsWith('/admin')) return ['admin'];
    if (location.pathname.startsWith('/me/bookings')) return ['my'];
    return ['home'];
  }, [location.pathname, isAuthPage]);

  const crumbs = React.useMemo(() => {
    // 移除“首页”
    if (location.pathname === '/') return [];
    if (location.pathname.startsWith('/rooms/')) return [{ title: '房间详情' }];
    if (location.pathname.startsWith('/me/bookings')) return [{ title: '我的订单' }];
    if (location.pathname.startsWith('/admin')) return [{ title: '管理' }];
    return [];
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
              items.push({ key: 'home', icon: <HomeOutlined />, label: <Link to="/">房间</Link> });
              if (user) items.push({ key: 'my', icon: <HomeOutlined />, label: <Link to="/me/bookings">我的订单</Link> });
              if (user?.role === 'ADMIN') items.push({ key: 'admin', icon: <AppstoreOutlined />, label: <Link to="/admin">管理</Link> });
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
                    { key: 'logout', label: '退出登录', onClick: () => { logout(); navigate('/login'); } },
                  ]
                }}
              >
                <Space style={{ cursor: 'pointer' }}>
                  <Typography.Text style={{ color: '#fff' }}>{user.username}</Typography.Text>
                </Space>
              </Dropdown>
            ) : (
              <Link to="/login" style={{ color: '#fff' }}>登录</Link>
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
