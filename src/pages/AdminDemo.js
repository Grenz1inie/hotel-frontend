import React from 'react';
import {
	Card,
	Space,
	Typography,
	InputNumber,
	Button,
	message,
	Row,
	Col,
	Table,
	Tag,
	Form,
	DatePicker,
	Select,
	Spin,
	Tooltip,
	Dropdown,
	Input,
	Modal,
} from 'antd';
import { useNavigate } from 'react-router-dom';
import { getRooms, adjustRoomTotalCount, confirmBooking, checkoutBooking, adminListBookings, checkinBooking, rejectBooking, deleteBooking } from '../services/api';
import VacancyAnalyticsPanel from '../components/VacancyAnalyticsPanel';
import dayjs from 'dayjs';
import { DownOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const EMPTY_ORDERS = { items: [], page: 1, size: 10, total: 0 };

const TOTAL_DAYS = 7;
const HOURS_PER_DAY = 24;
const TOTAL_HOURS = TOTAL_DAYS * HOURS_PER_DAY;
const CELL_WIDTH = 36; // px per hour
const LABEL_WIDTH = 180; // px for room info column

const STATUS_COLORS = {
	PENDING: '#faad14',
	CONFIRMED: '#52c41a',
	CHECKED_IN: '#13c2c2',
	CHECKED_OUT: '#1677ff',
	CANCELLED: '#f5222d',
	REFUNDED: '#722ed1',
};

export default function AdminDemo() {
	const [rooms, setRooms] = React.useState([]);
	const [loading, setLoading] = React.useState(false);
	const [totalInput, setTotalInput] = React.useState({});
	const [orders, setOrders] = React.useState(() => ({ ...EMPTY_ORDERS }));
	const [ordersLoading, setOrdersLoading] = React.useState(false);
	const [orderFilters, setOrderFilters] = React.useState({});
	const [timelineStart, setTimelineStart] = React.useState(() => dayjs().startOf('day'));
	const [timelineLoading, setTimelineLoading] = React.useState(false);
	const [timelineBookings, setTimelineBookings] = React.useState([]);
	const navigate = useNavigate();

	const load = React.useCallback(async () => {
		try {
			setLoading(true);
			const data = await getRooms();
			setRooms(Array.isArray(data) ? data : []);
		} catch (e) {
			navigate('/error', { state: { status: '500', title: '加载失败', subTitle: '无法连接后端', backTo: '/' }, replace: true });
		} finally {
			setLoading(false);
		}
	}, [navigate]);

	React.useEffect(() => { load(); }, [load]);

	const statusPriority = React.useMemo(() => ({
		PENDING: 1,
		CONFIRMED: 2,
		CHECKED_IN: 3,
		CHECKED_OUT: 4,
		CANCELLED: 5,
		REFUNDED: 6,
	}), []);

	const sortBookings = React.useCallback((list = []) => {
		return [...list]
			.filter(Boolean)
			.sort((a, b) => {
				const pa = statusPriority[a?.status] ?? 99;
				const pb = statusPriority[b?.status] ?? 99;
				if (pa !== pb) return pa - pb;
				const sa = a?.startTime ? dayjs(a.startTime).valueOf() : 0;
				const sb = b?.startTime ? dayjs(b.startTime).valueOf() : 0;
				if (sa !== sb) return sa - sb;
				return (a?.id ?? 0) - (b?.id ?? 0);
			});
	}, [statusPriority]);

	const loadOrders = React.useCallback(async ({ page: overridePage, size: overrideSize, filters } = {}) => {
			try {
				setOrdersLoading(true);
				const effectiveFilters = filters !== undefined ? filters : orderFilters;
				const query = {
					...effectiveFilters,
					page: overridePage ?? orders.page,
					size: overrideSize ?? orders.size,
				};
				const res = await adminListBookings(query);
				let next;
				if (!res) {
					next = { ...EMPTY_ORDERS, page: query.page, size: query.size };
				} else if (Array.isArray(res)) {
					next = {
						...EMPTY_ORDERS,
						items: sortBookings(res),
						total: res.length,
						page: query.page,
						size: query.size,
					};
				} else {
					const items = Array.isArray(res.items) ? res.items : [];
					next = {
						...EMPTY_ORDERS,
						...res,
						items: sortBookings(items),
						page: res.page ?? query.page,
						size: res.size ?? query.size,
					};
				}
				setOrders(next);
			} catch (e) {
				const msg = e?.data?.message || '订单加载失败';
				navigate('/error', { state: { status: String(e.status || 500), title: '加载订单失败', subTitle: msg, backTo: '/admin' }, replace: true });
			} finally {
				setOrdersLoading(false);
			}
		}, [orderFilters, navigate, sortBookings, orders.page, orders.size]);

	const loadTimeline = React.useCallback(async (startAt) => {
		if (!startAt) return;
		const startDay = startAt.startOf('day');
		const endDay = startDay.add(TOTAL_DAYS, 'day');
		try {
			setTimelineLoading(true);
			const res = await adminListBookings({
				page: 1,
				size: 500,
				start: startDay.toISOString(),
				end: endDay.toISOString(),
			});
			setTimelineBookings(res?.items ?? []);
		} catch (e) {
			const msg = e?.data?.message || '入住规划加载失败';
			navigate('/error', { state: { status: String(e.status || 500), title: '入住规划加载失败', subTitle: msg, backTo: '/admin' }, replace: true });
		} finally {
			setTimelineLoading(false);
		}
	}, [navigate]);

		React.useEffect(() => { loadOrders(); }, [loadOrders]);

	React.useEffect(() => {
		loadTimeline(timelineStart);
	}, [timelineStart, loadTimeline]);

	const timelineEnd = React.useMemo(() => timelineStart.add(TOTAL_DAYS, 'day'), [timelineStart]);
	const timelineHours = React.useMemo(() => Array.from({ length: TOTAL_HOURS }, (_, i) => timelineStart.add(i, 'hour')), [timelineStart]);
	const timelineDays = React.useMemo(() => Array.from({ length: TOTAL_DAYS }, (_, i) => {
		const date = timelineStart.add(i, 'day');
		return { date, label: date.format('MM-DD ddd') };
	}), [timelineStart]);
	const bookingsByRoom = React.useMemo(() => {
		const map = new Map();
		timelineBookings.forEach((b) => {
			const key = b.roomTypeId ?? b.roomId;
			if (!map.has(key)) map.set(key, []);
			map.get(key).push(b);
		});
		map.forEach((list) => {
			list.sort((a, b) => dayjs(a.startTime).valueOf() - dayjs(b.startTime).valueOf());
		});
		return map;
	}, [timelineBookings]);
	const timelineWidth = TOTAL_HOURS * CELL_WIDTH;
	const weekRangeText = React.useMemo(() => `${timelineStart.format('YYYY-MM-DD')} ~ ${timelineStart.add(TOTAL_DAYS - 1, 'day').format('YYYY-MM-DD')}`, [timelineStart]);

	const doAdjust = async (id) => {
		const v = totalInput[id];
		if (typeof v !== 'number') {
			message.warning('请输入有效的总数');
			return;
		}
		try {
			const res = await adjustRoomTotalCount(id, v);
			if (!res) {
				message.error('更新失败');
			} else {
				message.success('更新成功');
				load();
				loadTimeline(timelineStart);
			}
		} catch (e) {
			const msg = e?.data?.message || '更新失败';
			navigate('/error', { state: { status: String(e.status || 500), title: '更新失败', subTitle: msg, backTo: '/admin' }, replace: true });
		}
	};

	const doConfirm = async (id) => {
		try {
			const res = await confirmBooking(id);
			if (!res) {
				message.error('确认失败');
			} else {
				message.success('已确认');
				loadOrders();
				loadTimeline(timelineStart);
			}
		} catch (e) {
			const msg = e?.data?.message || '确认失败';
			navigate('/error', { state: { status: String(e.status || 500), title: '确认失败', subTitle: msg, backTo: '/admin' }, replace: true });
		}
	};

	const doCheckout = async (id) => {
		try {
			const res = await checkoutBooking(id);
			if (!res) {
				message.error('退房失败');
			} else {
				message.success('已退房');
				loadOrders();
				loadTimeline(timelineStart);
			}
		} catch (e) {
			const msg = e?.data?.message || '退房失败';
			navigate('/error', { state: { status: String(e.status || 500), title: '退房失败', subTitle: msg, backTo: '/admin' }, replace: true });
		}
	};

	const doCheckin = async (id) => {
		try {
			const res = await checkinBooking(id);
			if (!res) {
				message.error('办理入住失败');
			} else {
				message.success('已标记入住');
				loadOrders();
				loadTimeline(timelineStart);
			}
		} catch (e) {
			const msg = e?.data?.message || '办理入住失败';
			navigate('/error', { state: { status: String(e.status || 500), title: '办理入住失败', subTitle: msg, backTo: '/admin' }, replace: true });
		}
	};

	const doReject = async (id) => {
		try {
			const res = await rejectBooking(id);
			if (!res) {
				message.error('拒绝失败');
			} else {
				message.success('已拒绝订单');
				loadOrders();
				loadTimeline(timelineStart);
			}
		} catch (e) {
			const msg = e?.data?.message || '拒绝失败';
			navigate('/error', { state: { status: String(e.status || 500), title: '拒绝失败', subTitle: msg, backTo: '/admin' }, replace: true });
		}
	};

	const doDelete = async (id) => {
		try {
			const res = await deleteBooking(id);
			if (!res) {
				message.error('删除失败');
			} else {
				message.success('已删除订单');
				loadOrders();
				loadTimeline(timelineStart);
			}
		} catch (e) {
			const msg = e?.data?.message || '删除失败';
			navigate('/error', { state: { status: String(e.status || 500), title: '删除失败', subTitle: msg, backTo: '/admin' }, replace: true });
		}
	};

	const orderColumns = [
		{
			title: '操作',
			key: 'actions',
			width: 120,
			render: (_, record) => {
				const actionItems = [];
				if (record.status === 'PENDING') {
					actionItems.push({ key: 'confirm', label: '确认入住' });
					actionItems.push({ key: 'reject', label: '拒绝订单' });
				}
				if (record.status === 'CONFIRMED') {
					actionItems.push({ key: 'checkin', label: '标记入住' });
					actionItems.push({ key: 'checkout', label: '办理退房' });
				}
				if (record.status === 'CHECKED_IN') {
					actionItems.push({ key: 'checkout', label: '办理退房' });
				}
				if (actionItems.length) {
					actionItems.push({ type: 'divider' });
				}
				actionItems.push({ key: 'delete', label: '删除订单', danger: true });
				const handleMenuClick = ({ key }) => {
					switch (key) {
						case 'confirm':
							doConfirm(record.id);
							break;
						case 'reject':
							doReject(record.id);
							break;
						case 'checkin':
							doCheckin(record.id);
							break;
						case 'checkout':
							doCheckout(record.id);
							break;
						case 'delete':
							Modal.confirm({
								title: `确认删除订单 #${record.id}?`,
								content: '删除后无法恢复，请确认已经处理相关善后。',
								okText: '删除',
								cancelText: '取消',
								okType: 'danger',
								onOk: () => doDelete(record.id),
							});
							break;
						default:
							break;
					}
				};
				return (
					<Dropdown menu={{ items: actionItems, onClick: handleMenuClick }}>
						<Button type="link">
							操作 <DownOutlined />
						</Button>
					</Dropdown>
				);
			},
		},
		{ title: '订单ID', dataIndex: 'id', key: 'id', width: 90 },
		{ title: '用户ID', dataIndex: 'userId', key: 'userId', width: 90 },
		{ title: '酒店ID', dataIndex: 'hotelId', key: 'hotelId', width: 90 },
		{ title: '房型ID', dataIndex: 'roomTypeId', key: 'roomTypeId', width: 90 },
		{ title: '房间ID', dataIndex: 'roomId', key: 'roomId', width: 90 },
		{ title: '入住人数', dataIndex: 'guests', key: 'guests', width: 100, render: v => v ?? '—' },
		{ title: '开始', dataIndex: 'startTime', key: 'startTime', render: v => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-' },
		{ title: '结束', dataIndex: 'endTime', key: 'endTime', render: v => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-' },
		{ title: '金额', dataIndex: 'amount', key: 'amount', render: v => {
			if (v == null) return '-';
			const num = Number(v);
			return Number.isNaN(num) ? v : `¥${num.toFixed(2)}`;
		} },
		{ title: '联系人', dataIndex: 'contactName', key: 'contactName', render: v => v || '—' },
		{ title: '电话', dataIndex: 'contactPhone', key: 'contactPhone', render: v => v || '—' },
		{ title: '状态', dataIndex: 'status', key: 'status', render: s => <Tag color={STATUS_COLORS[s] || 'default'}>{s}</Tag> },
	];

	return (
		<Space direction="vertical" size={16} style={{ width: '100%' }}>
			<Title level={3} style={{ margin: 0 }}>管理（演示）</Title>
			<Card title="订单管理">
				<Form
					layout="inline"
					onFinish={(vals) => {
						const { status, userId, roomTypeId, hotelId, contactPhone, range } = vals;
						const filters = {};
						if (status) filters.status = status;
						if (userId) filters.userId = userId;
						if (roomTypeId) filters.roomTypeId = roomTypeId;
						if (hotelId) filters.hotelId = hotelId;
						if (contactPhone) filters.contactPhone = contactPhone;
						if (range?.[0] && range?.[1]) {
							filters.start = range[0].toISOString();
							filters.end = range[1].toISOString();
						}
						setOrderFilters(filters);
						setOrders(o => ({ ...o, page: 1 }));
						loadOrders({ page: 1, filters });
					}}
				>
					<Form.Item label="状态" name="status">
						<Select allowClear style={{ width: 160 }} options={[
							{ label: 'PENDING', value: 'PENDING' },
							{ label: 'CONFIRMED', value: 'CONFIRMED' },
							{ label: 'CHECKED_IN', value: 'CHECKED_IN' },
							{ label: 'CHECKED_OUT', value: 'CHECKED_OUT' },
							{ label: 'CANCELLED', value: 'CANCELLED' },
							{ label: 'REFUNDED', value: 'REFUNDED' },
						]} />
					</Form.Item>
					<Form.Item label="用户ID" name="userId">
						<InputNumber min={1} />
					</Form.Item>
					<Form.Item label="房型ID" name="roomTypeId">
						<InputNumber min={1} />
					</Form.Item>
					<Form.Item label="酒店ID" name="hotelId">
						<InputNumber min={1} />
					</Form.Item>
					<Form.Item label="联系电话" name="contactPhone">
						<Input placeholder="支持模糊匹配" allowClear />
					</Form.Item>
					<Form.Item label="时间范围" name="range">
						<DatePicker.RangePicker showTime />
					</Form.Item>
					<Form.Item>
						<Space>
							<Button type="primary" htmlType="submit">查询</Button>
							<Button onClick={() => {
								setOrderFilters({});
								setOrders(o => ({ ...o, page: 1 }));
								loadOrders({ page: 1, filters: {} });
							}}>重置</Button>
						</Space>
					</Form.Item>
				</Form>
				<Table
					rowKey="id"
					loading={ordersLoading}
					dataSource={orders.items}
					columns={orderColumns}
					style={{ marginTop: 12 }}
					pagination={{
						current: orders.page,
						pageSize: orders.size,
						total: orders.total,
						showSizeChanger: true,
						onChange: (p, s) => {
							setOrders(o => ({ ...o, page: p, size: s }));
							loadOrders({ page: p, size: s });
						}
					}}
				/>
			</Card>
			<Card title="入住规划表">
				<Space direction="vertical" size={12} style={{ width: '100%' }}>
					<Space wrap align="center">
						<Button onClick={() => setTimelineStart(prev => prev.add(-TOTAL_DAYS, 'day'))}>上一周</Button>
						<Button onClick={() => setTimelineStart(prev => prev.add(TOTAL_DAYS, 'day'))}>下一周</Button>
						<Button onClick={() => setTimelineStart(dayjs().startOf('day'))}>回到今天</Button>
						<DatePicker value={timelineStart} onChange={(value) => value && setTimelineStart(value.startOf('day'))} />
						<Text type="secondary">范围：{weekRangeText}</Text>
					</Space>
					<Spin spinning={timelineLoading}>
						<div style={{ overflowX: 'auto' }}>
							<div style={{ minWidth: LABEL_WIDTH + timelineWidth }}>
								<div style={{ display: 'flex' }}>
									<div style={{ width: LABEL_WIDTH, padding: '8px', background: '#fafafa', borderRight: '1px solid #f0f0f0', borderBottom: '1px solid #d9d9d9' }}>
										<Text strong>房型</Text>
									</div>
									<div style={{ width: timelineWidth, display: 'grid', gridTemplateColumns: `repeat(${TOTAL_DAYS}, ${HOURS_PER_DAY * CELL_WIDTH}px)` }}>
										{timelineDays.map(({ date, label }) => (
											<div
												key={date.valueOf()}
												style={{
													textAlign: 'center',
													padding: '8px 0',
													borderRight: '1px solid #d9d9d9',
													borderBottom: '1px solid #d9d9d9',
													background: '#fafafa',
												}}
											>
												<div>{label}</div>
												<div style={{ fontSize: 12, color: '#999' }}>{date.format('YYYY-MM-DD')}</div>
											</div>
										))}
									</div>
								</div>
								<div style={{ display: 'flex' }}>
									<div style={{ width: LABEL_WIDTH, padding: '4px 8px', background: '#fafafa', borderRight: '1px solid #f0f0f0', borderBottom: '1px solid #d9d9d9' }}>
										<Text type="secondary">小时</Text>
									</div>
									<div style={{ width: timelineWidth, display: 'grid', gridTemplateColumns: `repeat(${TOTAL_HOURS}, ${CELL_WIDTH}px)` }}>
										{timelineHours.map((hour, idx) => (
											<div
												key={hour.valueOf()}
												style={{
													textAlign: 'center',
													fontSize: 12,
													padding: '2px 0',
													borderRight: '1px solid #f0f0f0',
													borderBottom: '1px solid #f0f0f0',
													background: idx % HOURS_PER_DAY === 0 ? '#fafafa' : '#fff',
												}}
											>
												{hour.format('HH')}
											</div>
										))}
									</div>
								</div>
								{rooms.map((room) => {
									const roomBookings = bookingsByRoom.get(room.id) || [];
									return (
										<div key={room.id} style={{ display: 'flex', alignItems: 'stretch' }}>
															<div style={{ width: LABEL_WIDTH, padding: '8px', borderRight: '1px solid #f0f0f0', borderBottom: '1px solid #f0f0f0', background: '#fff' }}>
												<Space direction="vertical" size={0}>
													<Text strong>{room.name}</Text>
																		<Text type="secondary" style={{ fontSize: 12 }}>房型ID #{room.id} · 酒店 #{room.hotelId ?? '—'} · {room.type}</Text>
																		<Text type="secondary" style={{ fontSize: 12 }}>库存 {room.availableCount}/{room.totalCount}</Text>
												</Space>
											</div>
											<div
												style={{
													width: timelineWidth,
													position: 'relative',
													borderBottom: '1px solid #f0f0f0',
													minHeight: 56,
													background: `repeating-linear-gradient(to right, rgba(0,0,0,0.04) 0, rgba(0,0,0,0.04) 1px, transparent 1px, transparent ${CELL_WIDTH}px)`
												}}
											>
												{roomBookings.map((booking) => {
													const bookingStart = dayjs(booking.startTime);
													const bookingEnd = dayjs(booking.endTime);
													const effectiveStart = bookingStart.isBefore(timelineStart) ? timelineStart : bookingStart;
													const effectiveEnd = bookingEnd.isAfter(timelineEnd) ? timelineEnd : bookingEnd;
													if (!effectiveEnd.isAfter(effectiveStart)) return null;
													const startOffset = effectiveStart.diff(timelineStart, 'minute') / 60;
													const duration = effectiveEnd.diff(effectiveStart, 'minute') / 60;
													const left = startOffset * CELL_WIDTH;
													const width = Math.max(duration * CELL_WIDTH, 6);
													const color = STATUS_COLORS[booking.status] || '#597ef7';
																			const tooltipTitle = (
																				<div>
																					<div>订单 #{booking.id}</div>
																					<div>酒店：{booking.hotelId ?? '—'} · 房型：{booking.roomTypeId ?? booking.roomId}</div>
																					<div>用户：{booking.userId} · 人数：{booking.guests ?? '—'}</div>
																					<div>状态：{booking.status}</div>
																					<div>时间：{bookingStart.format('MM-DD HH:mm')} ~ {bookingEnd.format('MM-DD HH:mm')}</div>
																					{booking.contactName && <div>联系人：{booking.contactName}</div>}
																					{booking.contactPhone && <div>电话：{booking.contactPhone}</div>}
																				</div>
																			);
													return (
														<Tooltip key={booking.id} title={tooltipTitle} overlayInnerStyle={{ minWidth: 220 }}>
															<div
																style={{
																	position: 'absolute',
																	left,
																	top: 6,
																	height: 'calc(100% - 12px)',
																	width,
																	minWidth: 8,
																	backgroundColor: color,
																	color: '#fff',
																	borderRadius: 6,
																	padding: '4px 8px',
																	display: 'flex',
																	flexDirection: 'column',
																	justifyContent: 'center',
																	gap: 2,
																	boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
																	overflow: 'hidden',
																	textOverflow: 'ellipsis',
																	whiteSpace: 'nowrap',
																}}
															>
																<div style={{ fontWeight: 600 }}>#{booking.id} · {booking.status}</div>
																<div style={{ fontSize: 12 }}>{bookingStart.format('MM-DD HH:mm')} ~ {bookingEnd.format('MM-DD HH:mm')}</div>
															</div>
														</Tooltip>
													);
												})}
											</div>
										</div>
									);
								})}
							</div>
						</div>
					</Spin>
					<Space wrap>
						{Object.entries(STATUS_COLORS).map(([status, color]) => (
							<Tag key={status} color={color}>{status}</Tag>
						))}
					</Space>
				</Space>
			</Card>
			<VacancyAnalyticsPanel />
			<Row gutter={[16, 16]}>
				{rooms.map(r => (
					<Col xs={24} sm={12} md={8} lg={6} key={r.id}>
						<Card loading={loading} title={`${r.name} · ${r.type}`}>
							<Space direction="vertical" style={{ width: '100%' }}>
																<Text>库存：{r.availableCount}/{r.totalCount}</Text>
								<Space>
									<Text>调整总数:</Text>
									<InputNumber min={0} value={totalInput[r.id]} onChange={(v)=>setTotalInput(s=>({...s, [r.id]: v}))} />
									<Button type="primary" onClick={() => doAdjust(r.id)}>保存</Button>
								</Space>
							</Space>
						</Card>
					</Col>
				))}
			</Row>
		</Space>
	);
}
