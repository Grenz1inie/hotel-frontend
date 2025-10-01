import React from 'react';
import { Alert, Card, Space, Typography, Form, Input, Button, message, InputNumber, Radio, Progress, Table, Tag, Divider } from 'antd';
import { useAuth } from '../context/AuthContext';
import { getMyProfile, updateMyProfile, getWalletSummary, rechargeWallet, getVipPricingSnapshot, getBookingsByUser } from '../services/api';
import dayjs from 'dayjs';
import { getBookingStatusMeta } from '../constants/booking';
import { DEFAULT_CHECKIN_HOUR, computeStayNights, normalizeStayRange } from '../utils/stayRange';

const { Title, Text } = Typography;

function normalizeDiscountMap(baseRates, discounts) {
  const result = new Map();
  const baseEntries = Object.entries(baseRates || {});
  baseEntries.forEach(([level, rate]) => {
    result.set(Number(level), typeof rate === 'number' ? rate : Number(rate));
  });
  if (discounts) {
    Object.entries(discounts).forEach(([level, rate]) => {
      result.set(Number(level), typeof rate === 'number' ? rate : Number(rate));
    });
  }
  return result;
}

function toRateNumber(value, fallback = 1) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function formatPercentValue(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return '--';
  }
  const text = Number.isInteger(num) ? `${num}` : num.toFixed(1).replace(/\.0+$/, '');
  return `${text}%`;
}

export default function AccountCenter() {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = React.useState(null);
  const [wallet, setWallet] = React.useState(null);
  const [pricing, setPricing] = React.useState(null);
  const [loadingProfile, setLoadingProfile] = React.useState(false);
  const [loadingWallet, setLoadingWallet] = React.useState(false);
  const [loadingPricing, setLoadingPricing] = React.useState(false);
  const [updatingProfile, setUpdatingProfile] = React.useState(false);
  const [recharging, setRecharging] = React.useState(false);
  const [profileForm] = Form.useForm();
  const [rechargeForm] = Form.useForm();
  const [orderSnapshot, setOrderSnapshot] = React.useState([]);
  const [upcomingStay, setUpcomingStay] = React.useState(null);

  const loadOrderSnapshot = React.useCallback(async () => {
    if (!user?.id) {
      setOrderSnapshot([]);
      return;
    }
    try {
      const res = await getBookingsByUser(user.id, { page: 1, size: 20 });
      const items = Array.isArray(res) ? res : res?.items;
      setOrderSnapshot(Array.isArray(items) ? items : []);
    } catch (err) {
      console.warn('加载订单概览失败', err);
      setOrderSnapshot([]);
    }
  }, [user?.id]);

  const loadProfile = React.useCallback(async () => {
    setLoadingProfile(true);
    try {
      const data = await getMyProfile();
      setProfile(data);
      profileForm.setFieldsValue({
        username: data?.username,
        phone: data?.phone,
        email: data?.email,
      });
    } catch (err) {
      message.error(err?.data?.message || '获取个人资料失败');
    } finally {
      setLoadingProfile(false);
    }
  }, [profileForm]);

  const loadWallet = React.useCallback(async () => {
    if (!user) return;
    setLoadingWallet(true);
    try {
      const data = await getWalletSummary(10);
      setWallet(data);
    } catch (err) {
      message.error(err?.data?.message || '获取钱包信息失败');
    } finally {
      setLoadingWallet(false);
    }
  }, [user]);

  const loadPricing = React.useCallback(async () => {
    setLoadingPricing(true);
    try {
      const data = await getVipPricingSnapshot();
      setPricing(data);
    } catch (err) {
      console.warn('加载会员策略失败', err);
    } finally {
      setLoadingPricing(false);
    }
  }, []);

  const acceptedStatusSet = React.useMemo(() => new Set(['CONFIRMED', 'CHECKED_IN']), []);

  React.useEffect(() => {
    loadProfile();
    loadWallet();
    loadPricing();
    loadOrderSnapshot();
  }, [loadOrderSnapshot, loadProfile, loadWallet, loadPricing]);

  const onProfileSubmit = async (values) => {
    try {
      setUpdatingProfile(true);
      const payload = {
        username: values.username,
        phone: values.phone,
        email: values.email,
      };
      const updated = await updateMyProfile(payload);
      setProfile(updated);
      updateUser({
        username: updated.username,
        vipLevel: updated.vipLevel,
        phone: updated.phone,
        email: updated.email,
      });
      message.success('资料更新成功');
    } catch (err) {
      message.error(err?.data?.message || '资料更新失败');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const onRechargeSubmit = async (values) => {
    try {
      setRecharging(true);
      await rechargeWallet({ amount: values.amount, channel: values.channel, referenceNo: values.referenceNo, remark: values.remark });
      message.success('充值成功');
      rechargeForm.resetFields();
      loadWallet();
    } catch (err) {
      message.error(err?.data?.message || '充值失败');
    } finally {
      setRecharging(false);
    }
  };

  const levelAverageRates = React.useMemo(() => {
    if (!pricing) return new Map();
    const baseRates = pricing.baseRates || {};
    const stats = new Map();
    if (Array.isArray(pricing.rooms) && pricing.rooms.length > 0) {
      pricing.rooms.forEach((item) => {
        const map = normalizeDiscountMap(baseRates, item.discounts);
        map.forEach((rate, lvl) => {
          const levelNum = Number(lvl);
          const rateNum = toRateNumber(rate, 1);
          if (Number.isNaN(levelNum)) return;
          const entry = stats.get(levelNum) || { total: 0, count: 0 };
          entry.total += rateNum;
          entry.count += 1;
          stats.set(levelNum, entry);
        });
      });
    }
    const result = new Map();
    stats.forEach(({ total, count }, level) => {
      if (count > 0) {
        result.set(level, total / count);
      }
    });
    Object.entries(baseRates).forEach(([lvl, rate]) => {
      const levelNum = Number(lvl);
      if (!result.has(levelNum)) {
        result.set(levelNum, toRateNumber(rate, 1));
      }
    });
    if (Array.isArray(pricing.levels)) {
      pricing.levels.forEach((item) => {
        const levelNum = Number(item.level ?? 0);
        if (!result.has(levelNum)) {
          result.set(levelNum, toRateNumber(item.discountRate, 1));
        }
      });
    }
    return result;
  }, [pricing]);

  const renderPercentLabel = React.useCallback((value) => formatPercentValue(value), []);

  const checkoutHourMap = React.useMemo(() => {
    const map = new Map([[0, 12], [1, 13], [2, 14], [3, 15], [4, 16]]);
    if (pricing?.checkoutHours && typeof pricing.checkoutHours === 'object') {
      Object.entries(pricing.checkoutHours).forEach(([lvl, hour]) => {
        const levelNum = Number(lvl);
        const hourNum = Number(hour);
        if (!Number.isNaN(levelNum) && !Number.isNaN(hourNum)) {
          map.set(levelNum, hourNum);
        }
      });
    }
    if (Array.isArray(pricing?.levels)) {
      pricing.levels.forEach((item) => {
        const levelNum = Number(item.level ?? item.vipLevel ?? item.id);
        const hourCandidate = item.checkoutHour ?? item.checkout_hour ?? item.checkoutHours;
        const hourNum = Number(hourCandidate);
        if (!Number.isNaN(levelNum) && !Number.isNaN(hourNum)) {
          map.set(levelNum, hourNum);
        }
      });
    }
    return map;
  }, [pricing]);

  const resolveCheckoutHour = React.useCallback((level) => {
    const levelNum = Number(level);
    if (!Number.isNaN(levelNum) && checkoutHourMap.has(levelNum)) {
      return checkoutHourMap.get(levelNum);
    }
    return checkoutHourMap.get(0) ?? 12;
  }, [checkoutHourMap]);

  const computeAdjustedStayRange = React.useCallback((startRaw, endRaw, levelHint) => {
    const checkoutHour = resolveCheckoutHour(levelHint);
    const start = startRaw ? dayjs(startRaw) : null;
    const end = endRaw ? dayjs(endRaw) : null;
    if (!start || !start.isValid() || !end || !end.isValid()) {
      return { checkoutHour, start: start && start.isValid() ? start : null, end: end && end.isValid() ? end : null };
    }
    const nights = computeStayNights([start, end], checkoutHour, { minNights: 1, checkinHour: DEFAULT_CHECKIN_HOUR });
    const normalized = normalizeStayRange([start, end], checkoutHour, { minNights: nights, checkinHour: DEFAULT_CHECKIN_HOUR });
    if (Array.isArray(normalized) && normalized.length === 2) {
      const [normalizedStart, normalizedEnd] = normalized;
      const resolvedStart = dayjs(normalizedStart);
      const resolvedEnd = dayjs(normalizedEnd);
      return { checkoutHour, start: resolvedStart, end: resolvedEnd };
    }
    return { checkoutHour, start, end };
  }, [resolveCheckoutHour]);

  React.useEffect(() => {
    if (!Array.isArray(orderSnapshot) || orderSnapshot.length === 0) {
      setUpcomingStay(null);
      return;
    }
    const now = dayjs();
    const normalized = orderSnapshot
      .filter((item) => item && acceptedStatusSet.has(String(item.status || '').toUpperCase()) && item.endTime)
      .map((item) => {
        const start = item.startTime ? dayjs(item.startTime) : null;
        const end = dayjs(item.endTime);
        return {
          raw: item,
          start,
          end,
          startValue: start && start.isValid() ? start.valueOf() : Number.MAX_SAFE_INTEGER,
          endValid: end.isValid(),
        };
      })
      .filter((entry) => entry.endValid);
    if (!normalized.length) {
      setUpcomingStay(null);
      return;
    }
    normalized.sort((a, b) => a.startValue - b.startValue);
    const candidate = normalized.find((entry) => entry.end.isAfter(now)) ?? normalized[0];
    const candidateVipLevel = candidate.raw?.vipLevel
      ?? candidate.raw?.vip_level
      ?? candidate.raw?.userVipLevel
      ?? candidate.raw?.user_vip_level
      ?? user?.vipLevel;
    const adjusted = computeAdjustedStayRange(candidate.start, candidate.end, candidateVipLevel);
    const resolvedStart = adjusted.start && adjusted.start.isValid() ? adjusted.start : (candidate.start && candidate.start.isValid() ? candidate.start : null);
    const resolvedEnd = adjusted.end && adjusted.end.isValid() ? adjusted.end : candidate.end;
    setUpcomingStay({
      bookingId: candidate.raw.id,
      status: candidate.raw.status,
      start: resolvedStart,
      end: resolvedEnd,
    });
  }, [orderSnapshot, acceptedStatusSet, computeAdjustedStayRange, user?.vipLevel]);

  const levelDescriptors = React.useMemo(() => {
    if (!pricing?.levels) return [];
    const baseRates = pricing.baseRates || {};
    return pricing.levels.map((item) => {
      const level = Number(item.level ?? 0);
      const fallbackRate = toRateNumber(item.discountRate ?? baseRates[level] ?? baseRates[String(level)], 1);
      const averageRate = toRateNumber(levelAverageRates.get(level), fallbackRate);
      const checkoutCandidate = item.checkoutHour ?? item.checkout_hour ?? (pricing?.checkoutHours ? pricing.checkoutHours[String(level)] : undefined);
      const checkoutHour = Number(checkoutCandidate);
      const percent = Number.isFinite(averageRate) ? Number((averageRate * 100).toFixed(1)) : 100;
      const progressPercent = percent >= 100 ? 99.999 : Math.max(percent, 0);
      return {
        level,
        name: item.name ?? `VIP ${level}`,
        discountRate: averageRate,
        baseDiscountRate: fallbackRate,
        percent,
        progressPercent,
        description: item.description ?? '',
        checkoutHour: Number.isNaN(checkoutHour) ? null : checkoutHour,
      };
    });
  }, [pricing, levelAverageRates]);

  const roomRows = React.useMemo(() => {
    if (!pricing?.rooms) return [];
    const baseRates = pricing.baseRates || {};
    const vipLevel = user?.vipLevel ?? 0;
    return pricing.rooms.map((item) => {
      const map = normalizeDiscountMap(baseRates, item.discounts);
      const currentRate = map.get(Number(vipLevel));
      return {
        key: item.roomTypeId ?? item.room_type_id ?? item.id,
        roomName: item.roomName ?? item.room_name ?? `房型 ${item.roomTypeId}`,
        currentRate,
        map,
      };
    });
  }, [pricing, user?.vipLevel]);

  const walletBalanceRaw = wallet?.balance != null ? Number(wallet.balance) : 0;
  const walletBalance = Number.isNaN(walletBalanceRaw) ? 0 : walletBalanceRaw;
  const walletBalanceDisplay = walletBalance.toFixed(2);
  const vipLevel = user?.vipLevel ?? 0;

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Title level={3} style={{ margin: 0 }}>个人中心</Title>
      {upcomingStay && upcomingStay.end && (
        <Alert
          type="info"
          showIcon
          message="行程提醒"
          description={(
            <Space direction="vertical" size={2}>
              <Text>入住时间：{upcomingStay.start ? upcomingStay.start.format('YYYY-MM-DD HH:mm') : '待定'}</Text>
              <Text>
                退房时间：<Text strong>{upcomingStay.end.format('YYYY-MM-DD HH:mm')}</Text>
              </Text>
              <Text type="secondary">当前状态：{getBookingStatusMeta(upcomingStay.status).label}</Text>
            </Space>
          )}
        />
      )}
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Card title="基本信息" loading={loadingProfile}>
          <Form layout="vertical" form={profileForm} onFinish={onProfileSubmit} initialValues={{ username: profile?.username, phone: profile?.phone, email: profile?.email }}>
            <Form.Item label="用户名" name="username" rules={[{ required: true, message: '请输入用户名' }, { min: 3, message: '至少 3 个字符' }]}>
              <Input placeholder="请输入用户名" allowClear />
            </Form.Item>
            <Form.Item label="联系电话" name="phone" rules={[{ required: true, message: '请输入联系电话' }]}>
              <Input placeholder="请输入联系电话" allowClear />
            </Form.Item>
            <Form.Item label="邮箱" name="email" rules={[{ type: 'email', message: '请输入有效邮箱' }]}>
              <Input placeholder="可选，填写邮箱" allowClear />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={updatingProfile}>保存修改</Button>
            </Form.Item>
          </Form>
        </Card>

        <Card title="钱包中心" loading={loadingWallet}>
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <div
              style={{
                background: 'linear-gradient(135deg, #1890ff 0%, #73d13d 100%)',
                borderRadius: 12,
                padding: '18px 22px',
                display: 'flex',
                alignItems: 'stretch',
                justifyContent: 'space-between',
                gap: 24,
                color: '#fff',
                flexWrap: 'wrap'
              }}
            >
              <Space direction="vertical" size={6}>
                <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>可用余额</Text>
                <Title level={2} style={{ margin: 0, color: '#fff', letterSpacing: 1 }}>¥{walletBalanceDisplay}</Title>
              </Space>
              <div
                style={{
                  minWidth: 160,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.12)',
                  boxShadow: '0 8px 16px rgba(0,0,0,0.08)'
                }}
              >
                <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>当前会员等级</Text>
                <Title level={3} style={{ margin: 0, color: '#fff' }}>VIP{vipLevel}</Title>
              </div>
            </div>
            <Form layout="inline" form={rechargeForm} onFinish={onRechargeSubmit} initialValues={{ channel: 'ONLINE' }}>
              <Form.Item label="充值金额" name="amount" rules={[{ required: true, message: '请输入金额' }]}>
                <InputNumber min={1} precision={2} style={{ width: 160 }} prefix="¥" />
              </Form.Item>
              <Form.Item label="渠道" name="channel">
                <Radio.Group>
                  <Radio.Button value="ONLINE">在线</Radio.Button>
                  <Radio.Button value="MANUAL">前台</Radio.Button>
                  <Radio.Button value="TRANSFER">转账</Radio.Button>
                </Radio.Group>
              </Form.Item>
              <Form.Item label="凭证" name="referenceNo">
                <Input placeholder="可选" style={{ width: 200 }} />
              </Form.Item>
              <Form.Item label="备注" name="remark">
                <Input placeholder="可选" style={{ width: 200 }} />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" loading={recharging}>立即充值</Button>
              </Form.Item>
            </Form>
          </Space>
        </Card>

        <Card title="会员优惠策略" loading={loadingPricing}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Space size={16} wrap>
              {levelDescriptors.map((level) => (
                <Card key={level.level} size="small" style={{ width: 220 }} hoverable>
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    <Text strong>{level.name}</Text>
                    <Progress
                      type="dashboard"
                      percent={level.progressPercent}
                      trailColor="#f0f0f0"
                      strokeColor={level.level === vipLevel ? '#fa8c16' : '#1677ff'}
                      status="normal"
                      format={() => renderPercentLabel(level.percent)}
                    />
                    <div
                      style={{
                        width: '100%',
                        background: 'rgba(22, 119, 255, 0.08)',
                        borderRadius: 12,
                        padding: '10px 12px',
                        border: '1px solid rgba(22, 119, 255, 0.16)'
                      }}
                    >
                      <Text
                        style={{
                          display: 'block',
                          fontSize: 16,
                          fontWeight: 600,
                          color: '#1f1f1f',
                        }}
                      >
                        平均折扣：
                        <span style={{ color: level.percent >= 100 ? '#fa8c16' : '#1677ff' }}>{renderPercentLabel(level.percent)}</span>
                      </Text>
                      <Text
                        style={{
                          display: 'block',
                          marginTop: 6,
                          fontSize: 15,
                          fontWeight: 600,
                          color: '#1f1f1f'
                        }}
                      >
                        退房延长：次日 {String((level.checkoutHour ?? 12)).padStart(2, '0')}:00
                      </Text>
                      {level.description && (
                        <Text
                          style={{
                            display: 'block',
                            marginTop: 8,
                            fontSize: 13,
                            fontWeight: 600,
                            color: '#531dab'
                          }}
                        >
                          {level.description}
                        </Text>
                      )}
                    </div>
                  </Space>
                </Card>
              ))}
            </Space>
            <Divider style={{ margin: '12px 0' }} />
            <Title level={5} style={{ margin: 0 }}>房型折扣 · 各等级一览</Title>
            <Table
              rowKey="key"
              dataSource={roomRows}
              pagination={false}
              size="small"
              columns={[
                { title: '房型', dataIndex: 'roomName', key: 'roomName' },
                {
                  title: '我的等级价格',
                  dataIndex: 'currentRate',
                  key: 'currentRate',
                  render: (value) => value != null ? (
                    <Tag color="volcano">VIP{vipLevel}：{formatPercentValue(value * 100)}</Tag>
                  ) : <Tag color="default">暂未定义</Tag>
                },
                {
                  title: '全部等级',
                  key: 'map',
                  render: (_, record) => (
                    <Space size={[4, 4]} wrap>
                      {Array.from(record.map.entries()).map(([lvl, rate]) => (
                        <Tag key={lvl} color={Number(lvl) === vipLevel ? 'volcano' : 'default'}>
                          VIP{lvl}：{formatPercentValue(toRateNumber(rate, 1) * 100)}
                        </Tag>
                      ))}
                    </Space>
                  )
                }
              ]}
            />
          </Space>
        </Card>
      </Space>
    </Space>
  );
}
