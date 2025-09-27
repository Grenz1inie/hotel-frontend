import React from 'react';
import { Card, Row, Col, Tag, Typography, Space, Input, Empty, Skeleton, Button, Tooltip } from 'antd';
import { useNavigate } from 'react-router-dom';
import { getRooms, getImageList } from '../services/api';
import { useAuth } from '../context/AuthContext';

const { Title, Text } = Typography;

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
      navigate('/error', { state: { status: String(e.status || 500), title: '加载失败', subTitle: msg, backTo: '/rooms' }, replace: true });
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  React.useEffect(() => { load(); }, [load]);

  const sanitizedRooms = React.useMemo(
    () => rooms.filter((item) => item && typeof item === 'object'),
    [rooms]
  );

  const list = React.useMemo(() => {
    if (!q) return sanitizedRooms;
    const key = q.toLowerCase();
    return sanitizedRooms.filter(r => {
      const name = (r.name || '').toLowerCase();
      const type = (r.type || '').toLowerCase();
      const bed = (r.bedType || '').toLowerCase();
      const amenities = Array.isArray(r.amenities) ? r.amenities.join(',').toLowerCase() : '';
      return name.includes(key) || type.includes(key) || bed.includes(key) || amenities.includes(key);
    });
  }, [sanitizedRooms, q]);

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
            const available = Number.isFinite(Number(r.availableCount)) ? Number(r.availableCount) : 0;
            const total = Number.isFinite(Number(r.totalCount)) ? Number(r.totalCount) : 0;
            const price = Number(r.pricePerNight);
            const amenities = Array.isArray(r.amenities) ? r.amenities.slice(0, 3) : [];
            const isActive = r.isActive !== undefined ? !!r.isActive : true;
            const areaValue = Number(r.areaSqm);
            const areaDisplay = Number.isNaN(areaValue) ? null : Number.isInteger(areaValue) ? areaValue : areaValue.toFixed(1);
            const maxGuestsValue = Number(r.maxGuests);
            const maxGuests = Number.isNaN(maxGuestsValue) || maxGuestsValue <= 0 ? (r.maxGuests ?? '—') : maxGuestsValue;
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
                      <Tag color={available > 0 ? 'green' : 'red'}>{available}/{total} 可用</Tag>
                      {!isActive && <Tag color="magenta">已下架</Tag>}
                    </Space>
                    <Text type="secondary">¥{Number.isNaN(price) ? r.pricePerNight : price.toFixed(2)} / 晚 · 最多 {maxGuests ?? '—'} 人</Text>
                    <Text type="secondary">{areaDisplay != null ? `${areaDisplay} ㎡` : '面积未知'} · {r.bedType || '床型未设置'}</Text>
                    {amenities.length > 0 && (
                      <Space size={[4, 4]} wrap>
                        {amenities.map((am, idx) => (
                          <Tooltip key={idx} title={am}>
                            <Tag color="geekblue">{am}</Tag>
                          </Tooltip>
                        ))}
                        {Array.isArray(r.amenities) && r.amenities.length > amenities.length && (
                          <Tag color="default">+{r.amenities.length - amenities.length}</Tag>
                        )}
                      </Space>
                    )}
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
