import React from 'react';
import { Typography, Table, Tag, Space, Button, message, InputNumber, Form } from 'antd';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getBookingsByUser, cancelBooking } from '../services/api';
import { getBookingStatusMeta, getPaymentStatusLabel, getPaymentMethodLabel } from '../constants/booking';

const { Title, Text } = Typography;

export default function MyOrdersSection({
  showAdminFilter = false,
  embedded = false,
  pageSize = 10,
  forceUserId,
  emptyText = '暂无订单记录',
  onDataLoaded
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState({ items: [], page: 1, size: pageSize, total: 0 });
  const [queryUserId, setQueryUserId] = React.useState(undefined);

  const effectiveUserId = React.useMemo(() => {
    if (forceUserId) return forceUserId;
    if (user?.role === 'ADMIN' && queryUserId) return queryUserId;
    return user?.id;
  }, [forceUserId, user, queryUserId]);

  const load = React.useCallback(async (page = 1, size = pageSize) => {
    if (!effectiveUserId) {
      setData((prev) => ({ ...prev, items: [], total: 0, page: 1, size }));
      if (typeof onDataLoaded === 'function') {
        onDataLoaded([]);
      }
      return;
    }
    try {
      setLoading(true);
      const res = await getBookingsByUser(effectiveUserId, { page, size });
      const payload = Array.isArray(res)
        ? { items: res, page, size, total: res.length }
        : (res || { items: [], page, size, total: 0 });
      setData({ ...payload, page, size });
      if (typeof onDataLoaded === 'function') {
        const items = Array.isArray(payload.items) ? payload.items : [];
        onDataLoaded(items);
      }
    } catch (e) {
      const msg = e?.data?.message || '加载失败';
      navigate('/error', {
        state: { status: String(e?.status || 500), title: '加载失败', subTitle: msg, backTo: '/me/profile' },
        replace: true
      });
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId, navigate, pageSize, onDataLoaded]);

  React.useEffect(() => {
    load(1, pageSize);
  }, [load, pageSize]);

  const onCancel = React.useCallback(async (record) => {
    try {
      await cancelBooking(record.id);
      message.success('已取消预订');
      load(data.page, data.size);
    } catch (e) {
      const msg = e?.data?.message || '取消失败';
      navigate('/error', {
        state: { status: String(e?.status || 500), title: '取消失败', subTitle: msg, backTo: '/me/profile' },
        replace: true
      });
    }
  }, [data.page, data.size, load, navigate]);

  const columns = React.useMemo(() => [
    { title: '订单ID', dataIndex: 'id', key: 'id', width: 90 },
    { title: '酒店ID', dataIndex: 'hotelId', key: 'hotelId', width: 90 },
    { title: '房型ID', dataIndex: 'roomTypeId', key: 'roomTypeId', width: 90, render: (v, record) => v ?? record.roomId },
    { title: '房间ID', dataIndex: 'roomId', key: 'roomId', width: 90 },
    { title: '入住人数', dataIndex: 'guests', key: 'guests', width: 100, render: (v) => v ?? '—' },
    { title: '开始', dataIndex: 'startTime', key: 'startTime', render: (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-') },
    { title: '结束', dataIndex: 'endTime', key: 'endTime', render: (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-') },
    { title: '金额', dataIndex: 'amount', key: 'amount', render: (v) => (v != null ? `¥${Number(v).toFixed(2)}` : '-') },
    { title: '联系人', dataIndex: 'contactName', key: 'contactName', render: (v) => v || '—' },
    { title: '电话', dataIndex: 'contactPhone', key: 'contactPhone', render: (v) => v || '—' },
    { title: '备注', dataIndex: 'remark', key: 'remark', ellipsis: true, render: (v) => v || '—' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const meta = getBookingStatusMeta(status);
        return <Tag color={meta.color}>{meta.label}</Tag>;
      }
    },
    {
      title: '支付',
      key: 'payment',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text>{getPaymentStatusLabel(record.paymentStatus)}</Text>
          {record.paymentMethod ? <Text type="secondary">{getPaymentMethodLabel(record.paymentMethod)}</Text> : null}
        </Space>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_, record) => (
        <Space>
          <Button
            disabled={record.status === 'CANCELLED' || record.status === 'CHECKED_OUT'}
            onClick={() => onCancel(record)}
          >
            取消
          </Button>
        </Space>
      )
    }
  ], [onCancel]);

  const showFilter = showAdminFilter && user?.role === 'ADMIN' && !forceUserId;

  return (
    <Space direction="vertical" size={embedded ? 12 : 16} style={{ width: '100%' }}>
      {!embedded && (
        <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
          <Title level={3} style={{ margin: 0 }}>我的订单</Title>
          {showFilter && (
            <Form layout="inline" onFinish={() => load(1, data.size)}>
              <Form.Item label="用户ID">
                <InputNumber
                  min={1}
                  value={queryUserId}
                  onChange={setQueryUserId}
                  placeholder="默认查询当前用户"
                />
              </Form.Item>
              <Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit">查询</Button>
                  <Button onClick={() => { setQueryUserId(undefined); load(1, data.size); }}>重置</Button>
                </Space>
              </Form.Item>
            </Form>
          )}
        </Space>
      )}
      {embedded && showFilter && (
        <Space align="center" style={{ justifyContent: 'flex-end', width: '100%' }}>
          <Form layout="inline" onFinish={() => load(1, data.size)}>
            <Form.Item label="用户ID">
              <InputNumber
                min={1}
                value={queryUserId}
                onChange={setQueryUserId}
                placeholder="默认查询当前用户"
              />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">查询</Button>
                <Button onClick={() => { setQueryUserId(undefined); load(1, data.size); }}>重置</Button>
              </Space>
            </Form.Item>
          </Form>
        </Space>
      )}
      {showFilter && user?.role === 'ADMIN' && !embedded && (
        <Text type="secondary">当前查询用户ID：{effectiveUserId ?? '—'}</Text>
      )}
      <Table
        rowKey="id"
        loading={loading}
        dataSource={data.items}
        locale={{ emptyText }}
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
