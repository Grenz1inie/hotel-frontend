import React from 'react';
import { Button, Descriptions, Image, Space, Typography, Form, InputNumber, DatePicker, message, Tag, Input } from 'antd';
import dayjs from 'dayjs';
import { getRoomById, getImageList, createBooking, getRoomAvailability } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const { Title, Paragraph, Text } = Typography;

export default function RoomDetail({ id, onBack }) {
  const [room, setRoom] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [bookingLoading, setBookingLoading] = React.useState(false);
  const [form] = Form.useForm();
  const { user } = useAuth();
  const navigate = useNavigate();

  const load = React.useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await getRoomById(id);
      setRoom(data);
      if (data) {
        const guestLimit = Number(data.maxGuests);
        const defaultGuests = Number.isNaN(guestLimit) || guestLimit <= 0 ? 1 : Math.min(guestLimit, 2);
        form.setFieldsValue({
          range: [dayjs().hour(14), dayjs().add(1, 'day').hour(12)],
          guests: defaultGuests,
          contactName: user?.username || '',
          contactPhone: '',
          remark: '',
          hotelId: data.hotelId
        });
      }
    } catch (e) {
      console.error(e);
      navigate('/error', { state: { status: '500', title: '加载失败', subTitle: '无法连接后端', backTo: '/rooms' }, replace: true });
    } finally {
      setLoading(false);
    }
  }, [id, navigate, form, user]);

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
          navigate('/error', { state: { status: '404', title: '房型不存在', subTitle: '请返回列表重试', backTo: '/rooms' }, replace: true });
          return;
        }
        // 422 or other errors继续尝试创建时由后端返回原因
      }
      const isAdmin = user?.role === 'ADMIN';
      const uid = isAdmin ? (vals.userId || user?.id) : user?.id;
      const payload = {
        roomId: id,
        userId: isAdmin ? uid : undefined,
        start,
        end,
        guests: vals.guests,
        contactName: vals.contactName,
        contactPhone: vals.contactPhone,
        remark: vals.remark,
        hotelId: vals.hotelId ?? room?.hotelId,
      };
      const data = await createBooking(payload);
      if (!data) {
        message.error('预订失败，可能无可用房间');
      } else {
        message.success(`预订成功，状态: ${data.status}`);
        form.resetFields();
        form.setFieldsValue({
          range: [dayjs().hour(14), dayjs().add(1, 'day').hour(12)],
          guests: maxGuestsLimit ? Math.min(maxGuestsLimit, 2) : 1,
          contactName: user?.username || '',
          contactPhone: '',
          remark: '',
          hotelId: room?.hotelId
        });
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
  const amenities = Array.isArray(room.amenities) ? room.amenities : [];
  const isActive = room.isActive !== undefined ? !!room.isActive : true;
  const priceValue = Number(room.pricePerNight);
  const priceDisplay = Number.isNaN(priceValue) ? room.pricePerNight : priceValue.toFixed(2);
  const maxGuestsValue = Number(room.maxGuests);
  const maxGuestsDisplay = Number.isNaN(maxGuestsValue) || maxGuestsValue <= 0 ? room.maxGuests ?? '—' : maxGuestsValue;
  const maxGuestsLimit = Number.isNaN(maxGuestsValue) || maxGuestsValue <= 0 ? undefined : maxGuestsValue;
  const defaultGuestCount = maxGuestsLimit ? Math.min(maxGuestsLimit, 2) : 1;
  const totalCountValue = Number(room.totalCount);
  const availableCountValue = Number(room.availableCount);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space>
        <Button onClick={onBack}>返回</Button>
        <Title level={3} style={{ margin: 0 }}>{room.name} · {room.type}</Title>
        {!isActive && <Tag color="magenta">当前不可售</Tag>}
      </Space>
      <Image.PreviewGroup>
        <Space wrap>
          {images.length ? images.map((u, i) => (
            <Image key={i} src={u} width={260} height={160} style={{ objectFit: 'cover' }} />
          )) : <Text type="secondary">暂无图片</Text>}
        </Space>
      </Image.PreviewGroup>
      <Descriptions bordered column={2} size="small">
        <Descriptions.Item label="描述" span={2}>
          <Paragraph style={{ margin: 0 }}>{room.description || '—'}</Paragraph>
        </Descriptions.Item>
  <Descriptions.Item label="价格">¥{priceDisplay} / 晚</Descriptions.Item>
  <Descriptions.Item label="库存">{Number.isNaN(availableCountValue) ? room.availableCount : availableCountValue}/{Number.isNaN(totalCountValue) ? room.totalCount : totalCountValue}</Descriptions.Item>
  <Descriptions.Item label="最大入住">{maxGuestsDisplay} 人</Descriptions.Item>
        <Descriptions.Item label="面积">{room.areaSqm ? `${room.areaSqm} ㎡` : '—'}</Descriptions.Item>
        <Descriptions.Item label="床型">{room.bedType || '—'}</Descriptions.Item>
        <Descriptions.Item label="酒店ID">{room.hotelId ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="状态">{isActive ? '可售' : '下架'}</Descriptions.Item>
        <Descriptions.Item label="设施" span={2}>
          {amenities.length ? (
            <Space wrap>
              {amenities.map((am, idx) => <Tag key={idx}>{am}</Tag>)}
            </Space>
          ) : '—'}
        </Descriptions.Item>
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
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{
            range: [dayjs().hour(14), dayjs().add(1, 'day').hour(12)],
            guests: defaultGuestCount,
            contactName: user?.username || '',
            contactPhone: '',
            remark: '',
            hotelId: room?.hotelId
          }}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <Form.Item name="hotelId" hidden>
              <Input type="hidden" />
            </Form.Item>
            <Form.Item name="range" label="开始/结束时间" rules={[{ required: true, message: '请选择时间范围' }]}>
              <DatePicker.RangePicker showTime format="YYYY-MM-DD HH:mm:ss" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="guests" label="入住人数" rules={[{ required: true, message: '请输入人数' }]}>
              <InputNumber min={1} max={maxGuestsLimit || 10} style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="contactName" label="联系人姓名" rules={[{ required: true, message: '请输入联系人姓名' }]}>
              <Input placeholder="请输入联系人姓名" />
            </Form.Item>
            <Form.Item name="contactPhone" label="联系电话" rules={[{ required: true, message: '请输入联系电话' }]}>
              <Input placeholder="请输入联系电话" />
            </Form.Item>
            <Form.Item name="remark" label="备注">
              <Input.TextArea rows={3} placeholder="可选，填写特殊需求" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={bookingLoading} disabled={!isActive || Number(room.availableCount) <= 0}>立即预订</Button>
            </Form.Item>
          </Space>
        </Form>
      )}
    </Space>
  );
}
