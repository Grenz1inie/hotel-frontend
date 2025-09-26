import React from 'react';
import { Button, Descriptions, Image, Space, Typography, Form, InputNumber, DatePicker, message } from 'antd';
import dayjs from 'dayjs';
import { getRoomById, getImageList, createBooking, getRoomAvailability } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const { Title, Paragraph, Text } = Typography;

export default function RoomDetail({ id, onBack }) {
  const [room, setRoom] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [bookingLoading, setBookingLoading] = React.useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const load = React.useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await getRoomById(id);
      setRoom(data);
    } catch (e) {
      console.error(e);
      navigate('/error', { state: { status: '500', title: '加载失败', subTitle: '无法连接后端', backTo: '/' }, replace: true });
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  React.useEffect(() => { load(); }, [load]);

  const onFinish = async (vals) => {
    try {
      setBookingLoading(true);
      const start = vals.range?.[0]?.toISOString();
      const end = vals.range?.[1]?.toISOString();
      if (!start || !end) {
        message.warning('请选择开始和结束时间');
        return;
      }
      // availability pre-check
      try {
        const avail = await getRoomAvailability(id, { start, end });
        if (!avail?.available) {
          message.error('该时段库存不足，请更换时间');
          return;
        }
      } catch (e) {
        if (e.status === 404) {
          navigate('/error', { state: { status: '404', title: '房型不存在', subTitle: '请返回列表重试', backTo: '/' }, replace: true });
          return;
        }
        // 422 or other errors继续尝试创建时由后端返回原因
      }
      const isAdmin = user?.role === 'ADMIN';
      const uid = isAdmin ? (vals.userId || user?.id) : user?.id;
      const data = await createBooking({ roomId: id, userId: isAdmin ? uid : undefined, start, end });
      if (!data) {
        message.error('预订失败，可能无可用房间');
      } else {
        message.success(`预订成功，状态: ${data.status}`);
        load();
      }
    } catch (e) {
      console.error(e);
      const msg = e?.data?.message || '预订失败';
      navigate('/error', { state: { status: String(e.status || 500), title: '预订失败', subTitle: msg, backTo: `/rooms/${id}` }, replace: true });
    } finally {
      setBookingLoading(false);
    }
  };

  if (!room) return <Text type="secondary">{loading ? '加载中…' : '未找到房间'}</Text>;
  const images = getImageList(room.images);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space>
        <Button onClick={onBack}>返回</Button>
        <Title level={3} style={{ margin: 0 }}>{room.name} · {room.type}</Title>
      </Space>
      <Image.PreviewGroup>
        <Space wrap>
          {images.length ? images.map((u, i) => (
            <Image key={i} src={u} width={260} height={160} style={{ objectFit: 'cover' }} />
          )) : <Text type="secondary">暂无图片</Text>}
        </Space>
      </Image.PreviewGroup>
      <Descriptions bordered column={1} size="small">
        <Descriptions.Item label="描述">
          <Paragraph style={{ margin: 0 }}>{room.description || '—'}</Paragraph>
        </Descriptions.Item>
        <Descriptions.Item label="价格">¥{room.pricePerNight} / 晚</Descriptions.Item>
        <Descriptions.Item label="库存">{room.availableCount}/{room.totalCount}</Descriptions.Item>
      </Descriptions>

      <Title level={4}>预订</Title>
      {!user && (
        <Space>
          <Typography.Text type="secondary">登录后才能预订。</Typography.Text>
          <Button type="primary" onClick={() => navigate('/login')}>去登录</Button>
        </Space>
      )}
      {user?.role === 'ADMIN' && (
        <Space>
          <Typography.Text type="secondary">管理员不可在此页直接预订，请前往“管理”页进行库存调整等操作。</Typography.Text>
          <Button onClick={() => navigate('/admin')}>去管理页</Button>
        </Space>
      )}
      {user && user.role !== 'ADMIN' && (
        <Form
          layout="inline"
          onFinish={onFinish}
          initialValues={{ userId: user?.id || 2, range: [dayjs().hour(14), dayjs().add(1, 'day').hour(12)] }}
        >
          <Form.Item name="range" label="开始/结束时间" rules={[{ required: true, message: '请选择时间范围' }]}>
            <DatePicker.RangePicker showTime format="YYYY-MM-DD HH:mm:ss" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={bookingLoading} disabled={Number(room.availableCount) <= 0}>立即预订</Button>
          </Form.Item>
        </Form>
      )}
    </Space>
  );
}
