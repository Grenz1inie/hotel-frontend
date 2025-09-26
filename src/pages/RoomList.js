import React from 'react';
import { Card, Row, Col, Tag, Typography, Space, Input, Empty, Skeleton, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { getRooms, getImageList } from '../services/api';

const { Title, Text } = Typography;

import { useAuth } from '../context/AuthContext';

export default function RoomList({ onOpen }) {
  const [rooms, setRooms] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [q, setQ] = React.useState('');
  const navigate = useNavigate();
  const { user } = useAuth();

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await getRooms();
      setRooms(Array.isArray(data) ? data : []);
    } catch (e) {
      const msg = e?.data?.message || '无法连接后端';
      navigate('/error', { state: { status: String(e.status || 500), title: '加载失败', subTitle: msg, backTo: '/' }, replace: true });
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  React.useEffect(() => { load(); }, [load]);

  const list = React.useMemo(() => {
    if (!q) return rooms;
    const key = q.toLowerCase();
    return rooms.filter(r =>
      (r.name || '').toLowerCase().includes(key) ||
      (r.type || '').toLowerCase().includes(key)
    );
  }, [rooms, q]);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Title level={3} style={{ margin: 0 }}>房间列表</Title>
      <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
        <Input.Search
        placeholder="搜索房间名称或类型"
        allowClear
        value={q}
        onChange={(e)=>setQ(e.target.value)}
        onSearch={(v)=>setQ(v)}
        style={{ maxWidth: 360 }}
      />
        {!user && (
          <Space>
            <Text type="secondary">登录后可进行预订</Text>
            <Button type="primary" onClick={() => navigate('/login')}>去登录</Button>
          </Space>
        )}
      </Space>
      {loading ? (
        <Row gutter={[16, 16]}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Col xs={24} sm={12} md={8} lg={6} key={i}>
              <Card>
                <Skeleton active avatar paragraph={{ rows: 3 }} />
              </Card>
            </Col>
          ))}
        </Row>
      ) : list.length === 0 ? (
        <Empty description="暂无房间" />
      ) : (
        <Row gutter={[16, 16]}>
          {list.map(r => {
            const imgs = getImageList(r.images);
            const cover = imgs[0] || 'https://picsum.photos/seed/hotel/400/250';
            const available = Number(r.availableCount || 0);
            const total = Number(r.totalCount || 0);
            return (
              <Col xs={24} sm={12} md={8} lg={6} key={r.id}>
                <Card
                  hoverable
                  cover={<img alt={r.name} src={cover} style={{ height: 180, objectFit: 'cover' }} />}
                  onClick={() => onOpen(r.id)}
                >
                  <Space direction="vertical" style={{ width: '100%' }} size={4}>
                    <Title level={5} style={{ margin: 0 }}>{r.name}</Title>
                    <Space size={8} wrap>
                      <Tag color="blue">{r.type}</Tag>
                      <Tag color={available > 0 ? 'green' : 'red'}>
                        {available}/{total} 可用
                      </Tag>
                    </Space>
                    <Text type="secondary">¥{r.pricePerNight} / 晚</Text>
                  </Space>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </Space>
  );
}
