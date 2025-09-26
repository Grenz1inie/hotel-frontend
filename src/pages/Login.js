import React from 'react';
import { Card, Form, Input, Button, Typography, Space } from 'antd';
import { useAuth } from '../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

export default function Login() {
  const { login } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const onFinish = async (vals) => {
    setLoading(true);
    const { username, password } = vals;
    const res = await login(username, password);
    setLoading(false);
    if (res.ok) {
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    } else {
      navigate('/error', { state: { status: '500', title: '登录失败', subTitle: res.error?.message || '无法连接后端或接口返回错误', backTo: '/login' }, replace: true });
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh' }}>
      <Card style={{ width: 360 }}>
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Title level={3} style={{ margin: 0 }}>登录</Title>
          <Text type="secondary">请输入后端开通的账号进行登录。</Text>
          <Form layout="vertical" onFinish={onFinish} initialValues={{ username: '', password: '' }}>
            <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input placeholder="用户名" autoComplete="username" />
            </Form.Item>
            <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password placeholder="密码" autoComplete="current-password" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block loading={loading}>登录</Button>
            </Form.Item>
          </Form>
        </Space>
      </Card>
    </div>
  );
}
