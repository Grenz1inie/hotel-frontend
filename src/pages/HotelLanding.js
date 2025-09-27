import React from 'react';
import { Button, Typography, Space, Row, Col, Card, Skeleton, Image, Tag } from 'antd';
import { getPrimaryHotel, getImageList } from '../services/api';

const { Title, Paragraph, Text } = Typography;

export default function HotelLanding({ onEnterRooms }) {
  const [hotel, setHotel] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPrimaryHotel();
      setHotel(data);
    } catch (e) {
      setError(e?.data?.message || '无法加载酒店信息，请稍后重试。');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const gallery = React.useMemo(() => {
    if (!hotel) return [];
    if (Array.isArray(hotel.galleryImages)) return hotel.galleryImages;
    return getImageList(hotel.galleryImages);
  }, [hotel]);

  const introductionBlocks = React.useMemo(() => {
    const intro = hotel?.introduction || '';
    return intro
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
  }, [hotel]);

  const starLevel = React.useMemo(() => {
    const level = Number(hotel?.starLevel);
    if (!Number.isFinite(level) || level <= 0) return null;
    return Array.from({ length: level }).map((_, idx) => idx);
  }, [hotel]);

  const heroStyle = React.useMemo(() => ({
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 320,
    display: 'flex',
    alignItems: 'stretch',
    backgroundColor: '#111',
    backgroundImage: hotel?.heroImageUrl ? `url(${hotel.heroImageUrl})` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  }), [hotel]);

  return (
    <Space direction="vertical" size={32} style={{ width: '100%' }}>
      <div style={heroStyle}>
        <div style={{
          flex: 1,
          padding: '64px 48px',
          background: 'linear-gradient(120deg, rgba(6, 23, 61, 0.82) 0%, rgba(6, 23, 61, 0.56) 55%, rgba(6, 23, 61, 0.3) 100%)',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          {loading && !hotel ? (
            <Skeleton active paragraph={{ rows: 4 }} title={false} style={{ color: '#fff' }} />
          ) : (
            <Space direction="vertical" size={20} style={{ maxWidth: 620 }}>
              <Space size={12} align="center">
                <Title level={2} style={{ color: '#fff', margin: 0 }}>{hotel?.name || '精选酒店'}</Title>
                {starLevel && starLevel.length > 0 && (
                  <Space size={4}>
                    {starLevel.map((idx) => (
                      <span key={idx} role="img" aria-label="star">⭐</span>
                    ))}
                  </Space>
                )}
              </Space>
              <Paragraph style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16, marginBottom: 0 }}>
                {hotel?.city} · {hotel?.address}
              </Paragraph>
              {introductionBlocks.slice(0, 1).map((block, idx) => (
                <Paragraph key={idx} style={{ color: '#fff', fontSize: 18 }}>{block}</Paragraph>
              ))}
              <Space size={16} wrap>
                <Button type="primary" size="large" onClick={() => onEnterRooms?.()}>
                  立即探索房型
                </Button>
                <Tag color="gold" style={{ fontSize: 16, padding: '4px 16px' }}>官方直订礼遇 · 更安心</Tag>
              </Space>
            </Space>
          )}
        </div>
      </div>

      {error && (
        <Card style={{ borderColor: '#ff7875', background: '#fff1f0' }}>
          <Title level={4} style={{ marginTop: 0, color: '#cf1322' }}>温馨提示</Title>
          <Paragraph style={{ marginBottom: 12, color: '#76222a' }}>{error}</Paragraph>
          <Button onClick={load}>重新加载</Button>
        </Card>
      )}

      {introductionBlocks.length > 1 && (
        <Card title="酒店亮点" bordered={false} style={{ borderRadius: 12 }}>
          <Space direction="vertical" size={12}>
            {introductionBlocks.slice(1).map((block, idx) => (
              <Paragraph key={idx} style={{ marginBottom: 0 }}>{block}</Paragraph>
            ))}
          </Space>
        </Card>
      )}

      {gallery.length > 0 && (
        <Card title="灵感相册" bordered={false} style={{ borderRadius: 12 }}>
          <Row gutter={[16, 16]}>
            {gallery.slice(0, 4).map((src, idx) => (
              <Col xs={24} sm={12} md={12} lg={6} key={idx}>
                <Image
                  src={src}
                  alt={`hotel-gallery-${idx}`}
                  style={{ borderRadius: 10, height: 180, objectFit: 'cover', width: '100%' }}
                  placeholder
                />
              </Col>
            ))}
          </Row>
        </Card>
      )}

      {hotel && (
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Card bordered={false} style={{ borderRadius: 12, height: '100%' }}>
              <Title level={4}>尊享体验</Title>
              <Space direction="vertical" size={12}>
                <Paragraph style={{ marginBottom: 0 }}>· 全天候健身中心与恒温泳池，随时焕活身心</Paragraph>
                <Paragraph style={{ marginBottom: 0 }}>· 行政酒廊提供定制商务服务与精致茶点</Paragraph>
                <Paragraph style={{ marginBottom: 0 }}>· 智能客房系统，语音操控灯光、温度与窗帘</Paragraph>
              </Space>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card bordered={false} style={{ borderRadius: 12, height: '100%' }}>
              <Title level={4}>便捷配套</Title>
              <Space direction="vertical" size={12}>
                <Paragraph style={{ marginBottom: 0 }}>· 步行5分钟抵达地铁，20分钟直达机场高速</Paragraph>
                <Paragraph style={{ marginBottom: 0 }}>· 会议中心具备4K投影与一站式会务管家</Paragraph>
                <Paragraph style={{ marginBottom: 0 }}>· 营养早餐与城市主题下午茶，满足多样口味</Paragraph>
              </Space>
            </Card>
          </Col>
        </Row>
      )}

      <Card bordered={false} style={{ borderRadius: 12, textAlign: 'center', background: '#f6ffed', border: '1px solid #b7eb8f' }}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Title level={3} style={{ margin: 0 }}>准备好开启旅程了吗？</Title>
          <Text type="secondary">立即浏览房型，享受会员专属预定礼遇与限时折扣。</Text>
          <Button type="primary" size="large" onClick={() => onEnterRooms?.()}>进入房间列表</Button>
        </Space>
      </Card>
    </Space>
  );
}