import React from 'react';
import { Card, Form, Input, Button, Typography, Space, Tabs, message } from 'antd';
import { useAuth } from '../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

export default function Login() {
  const { login, register } = useAuth();
  const [activeKey, setActiveKey] = React.useState('login');
  const [loadingLogin, setLoadingLogin] = React.useState(false);
  const [loadingRegister, setLoadingRegister] = React.useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [loginForm] = Form.useForm();
  const [registerForm] = Form.useForm();

  const redirectAfterSuccess = React.useCallback(() => {
    const from = location.state?.from?.pathname || '/';
    navigate(from, { replace: true });
  }, [location.state, navigate]);

  const onLogin = React.useCallback(async (vals) => {
    setLoadingLogin(true);
    const res = await login(vals.username, vals.password);
    setLoadingLogin(false);
    if (res.ok) {
      redirectAfterSuccess();
    } else {
      navigate('/error', { state: { status: '500', title: '登录失败', subTitle: res.error?.message || '无法连接后端或接口返回错误', backTo: '/login' }, replace: true });
    }
  }, [login, navigate, redirectAfterSuccess]);

  const onRegister = React.useCallback(async (vals) => {
    setLoadingRegister(true);
    const phone = typeof vals.phone === 'string' ? vals.phone.trim() : vals.phone;
    const email = typeof vals.email === 'string' ? vals.email.trim() : vals.email;
    const res = await register({
      username: vals.username,
      password: vals.password,
      confirmPassword: vals.confirmPassword,
      phone,
      email,
    });
    setLoadingRegister(false);
    if (res.ok) {
      redirectAfterSuccess();
    } else {
      message.error(res.error?.message || '注册失败');
    }
  }, [register, redirectAfterSuccess]);

  const tabItems = React.useMemo(() => ([
    {
      key: 'login',
      label: '账号登入',
      children: (
        <Form
          form={loginForm}
          layout="vertical"
          onFinish={onLogin}
          initialValues={{ username: '', password: '' }}
        >
          <Form.Item name="username" label="账号 / 手机号 / 邮箱" rules={[{ required: true, message: '请输入账号或联系方式' }]}>
            <Input placeholder="请输入用户名、手机号或邮箱" autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password placeholder="密码" autoComplete="current-password" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loadingLogin}>立即登入</Button>
          </Form.Item>
        </Form>
      ),
    },
    {
      key: 'register',
      label: '快速注册',
      children: (
        <Form
          form={registerForm}
          layout="vertical"
          onFinish={onRegister}
          initialValues={{ username: '', password: '', confirmPassword: '', phone: '', email: '' }}
        >
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }, { min: 3, message: '用户名至少 3 个字符' }]}>
            <Input placeholder="3-20 位用户名" autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '密码至少 6 位' }]}>
            <Input.Password placeholder="至少 6 位密码" autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认密码"
            dependencies={['password']}
            rules={[
              { required: true, message: '请再次输入密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="再次输入密码" autoComplete="new-password" />
          </Form.Item>
          <Form.Item name="phone" label="联系电话" rules={[{ required: true, message: '请输入联系电话' }, { pattern: /^\d{3,20}$/, message: '联系电话需为 3-20 位数字' }]}>
            <Input placeholder="必填，用于联系与查单" autoComplete="tel" />
          </Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ type: 'email', message: '请输入正确的邮箱地址' }]}>
            <Input placeholder="可选，接收电子确认" autoComplete="email" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loadingRegister}>注册并登录</Button>
          </Form.Item>
        </Form>
      ),
    },
  ]), [loginForm, registerForm, loadingLogin, loadingRegister, onLogin, onRegister]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh' }}>
      <Card style={{ width: 420 }}>
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <Title level={3} style={{ margin: 0 }}>登入 / 注册</Title>
          <Text type="secondary">使用已有账号登入，或快速注册成为酒店会员。</Text>
          <Tabs
            activeKey={activeKey}
            onChange={setActiveKey}
            items={tabItems}
            destroyInactiveTabPane
          />
        </Space>
      </Card>
    </div>
  );
}
