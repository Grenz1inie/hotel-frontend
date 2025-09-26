import React from 'react';
import { Typography, Table, Tag, Space, Button, message, InputNumber, Form } from 'antd';
import { useAuth } from '../context/AuthContext';
import { getBookingsByUser, cancelBooking } from '../services/api';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';

const { Title } = Typography;

export default function UserDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState({ items: [], page: 1, size: 10, total: 0 });
  const [queryUserId, setQueryUserId] = React.useState(undefined);
  const navigate = useNavigate();

  const effectiveUserId = (user?.role === 'ADMIN' && queryUserId) ? queryUserId : user?.id;

  const load = React.useCallback(async (page = 1, size = 10) => {
    if (!effectiveUserId) return;
    try {
      setLoading(true);
      const res = await getBookingsByUser(effectiveUserId, { page, size });
      // 后端返回 { items, page, size, total }
      if (Array.isArray(res)) {
        setData({ items: res, page, size, total: res.length });
      } else {
        setData(res || { items: [], page, size, total: 0 });
      }
    } catch (e) {
      const msg = e?.data?.message || '加载失败';
      navigate('/error', { state: { status: String(e.status || 500), title: '加载失败', subTitle: msg, backTo: '/me/bookings' }, replace: true });
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId, navigate]);

  React.useEffect(() => { load(1, 10); }, [load]);

  const onCancel = async (record) => {
    try {
      await cancelBooking(record.id);
      message.success('已取消预订');
      load(data.page, data.size);
    } catch (e) {
      const msg = e?.data?.message || '取消失败';
      navigate('/error', { state: { status: String(e.status || 500), title: '取消失败', subTitle: msg, backTo: '/me/bookings' }, replace: true });
    }
  };

  const columns = [
    { title: '订单ID', dataIndex: 'id', key: 'id', width: 90 },
    { title: '房型ID', dataIndex: 'roomId', key: 'roomId', width: 90 },
    { title: '开始', dataIndex: 'startTime', key: 'startTime', render: v => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-' },
    { title: '结束', dataIndex: 'endTime', key: 'endTime', render: v => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-' },
    { title: '金额', dataIndex: 'amount', key: 'amount', render: v => v != null ? `¥${v}` : '-' },
    { title: '状态', dataIndex: 'status', key: 'status', render: s => <Tag color={s === 'CANCELLED' ? 'red' : s === 'CONFIRMED' ? 'green' : 'blue'}>{s}</Tag> },
    {
      title: '操作', key: 'action', width: 160,
      render: (_, record) => (
        <Space>
          <Button disabled={record.status === 'CANCELLED' || record.status === 'CHECKED_OUT'} onClick={() => onCancel(record)}>取消</Button>
        </Space>
      )
    }
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
        <Title level={3} style={{ margin: 0 }}>我的订单</Title>
        {user?.role === 'ADMIN' && (
          <Form layout="inline" onFinish={() => load(1, data.size)}>
            <Form.Item label="用户ID">
              <InputNumber min={1} value={queryUserId} onChange={setQueryUserId} placeholder="默认查询当前用户" />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">查询</Button>
                <Button onClick={() => { setQueryUserId(undefined); load(1, data.size); }}>重置为自己</Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Space>
      {user?.role === 'ADMIN' && (
        <div style={{ color: '#999' }}>当前查询用户ID：{effectiveUserId}</div>
      )}
      <Table
        rowKey="id"
        loading={loading}
        dataSource={data.items}
        columns={columns}
        pagination={{
          current: data.page,
          pageSize: data.size,
          total: data.total,
          showSizeChanger: true,
          onChange: (p, s) => load(p, s)
        }}
      />
    </Space>
  );
}
