import React from 'react';
import { Card, Row, Col, Tag, Typography, Space, Input, Empty, Skeleton, Button, Tooltip } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getRooms, getImageList, getVipPricingSnapshot } from '../services/api';
import { useAuth } from '../context/AuthContext';

const { Title, Text } = Typography;

export default function RoomList({ onOpen }) {
  const [rooms, setRooms] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [pricing, setPricing] = React.useState(null);
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

  React.useEffect(() => {
    (async () => {
      try {
        const data = await getVipPricingSnapshot();
        setPricing(data);
      } catch (e) {
        console.warn('无法加载会员折扣策略', e);
      }
    })();
  }, []);

  const discountLookup = React.useMemo(() => {
    if (!pricing) return { base: {}, rooms: new Map() };
    const baseRates = Object.entries(pricing.baseRates || {}).reduce((acc, [level, rate]) => {
      const key = Number(level);
      acc[key] = typeof rate === 'number' ? rate : Number(rate);
      return acc;
    }, {});
    const roomMap = new Map();
    const roomsList = Array.isArray(pricing.rooms) ? pricing.rooms : [];
    roomsList.forEach((item) => {
      const roomId = Number(item.roomTypeId ?? item.room_type_id ?? item.id);
      const discounts = item.discounts || {};
      const normalized = Object.entries(discounts).reduce((acc, [lvl, rate]) => {
        const key = Number(lvl);
        acc[key] = typeof rate === 'number' ? rate : Number(rate);
        return acc;
      }, {});
      if (!Number.isNaN(roomId)) {
        roomMap.set(roomId, normalized);
      }
    });
    return { base: baseRates, rooms: roomMap };
  }, [pricing]);

  const computeDiscountedPrice = React.useCallback((room) => {
    if (!user || user.vipLevel == null) return null;
    const vipLevel = Number(user.vipLevel);
    if (Number.isNaN(vipLevel)) return null;
    const baseRate = discountLookup.base[vipLevel] ?? 1;
    const specific = discountLookup.rooms.get(Number(room.id)) || {};
    const rate = specific[vipLevel] ?? baseRate ?? 1;
    const basePrice = Number(room.pricePerNight);
    if (Number.isNaN(basePrice)) return null;
    return {
      rate,
      price: Number((basePrice * rate).toFixed(2))
    };
  }, [discountLookup, user]);

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
            <Text type="secondary">登入/注册后可进行预订</Text>
            <Button type="primary" onClick={() => navigate('/login')}>去登入/注册</Button>
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
            const discountInfo = computeDiscountedPrice(r);
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
                  actions={[
                    <Button
                      key="vr"
                      type="link"
                      icon={<PlayCircleOutlined />}
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(`/rooms/${r.id}?vr=1`);
                      }}
                    >
                      VR 看房
                    </Button>
                  ]}
                >
                  <Space direction="vertical" style={{ width: '100%' }} size={4}>
                    <Title level={5} style={{ margin: 0 }}>{r.name}</Title>
                    <Space size={8} wrap>
                      <Tag color="blue">{r.type}</Tag>
                      <Tag color={available > 0 ? 'green' : 'red'}>{available}/{total} 可用</Tag>
                      {!isActive && <Tag color="magenta">已下架</Tag>}
                    </Space>
                    <Space direction="vertical" size={2}>
                      <Text type="secondary">¥{Number.isNaN(price) ? r.pricePerNight : price.toFixed(2)} / 晚 · 最多 {maxGuests ?? '—'} 人</Text>
                      {discountInfo && discountInfo.rate < 1 && (
                        <Text type="success">VIP 会员价：¥{discountInfo.price.toFixed(2)}（折扣 {Math.round(discountInfo.rate * 100)}%）</Text>
                      )}
                    </Space>
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
