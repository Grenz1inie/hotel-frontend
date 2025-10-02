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
	Descriptions,
	Divider,
	Empty,
} from 'antd';
import { useNavigate } from 'react-router-dom';
import { getRooms, adjustRoomTotalCount, confirmBooking, checkoutBooking, adminListBookings, checkinBooking, rejectBooking, deleteBooking, fetchRoomOccupancyOverview } from '../services/api';
import VacancyAnalyticsPanel from '../components/VacancyAnalyticsPanel';
import dayjs from 'dayjs';
import { DownOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { BOOKING_STATUS_META, getBookingStatusMeta, getPaymentStatusLabel, getPaymentMethodLabel } from '../constants/booking';
import { getRoomStatusMeta } from '../constants/room';

const { Title, Text } = Typography;

const EMPTY_ORDERS = { items: [], page: 1, size: 10, total: 0 };

const TOTAL_DAYS = 7;
const HOURS_PER_DAY = 24;
const TOTAL_HOURS = TOTAL_DAYS * HOURS_PER_DAY;
const BASE_CELL_WIDTH = 36; // px per hour at zoom 1
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const LABEL_WIDTH = 180; // px for room info column
const SECTION_TITLE_STYLE = {
	fontSize: 18,
	fontWeight: 600,
	lineHeight: '24px',
	display: 'inline-flex',
	alignItems: 'center',
	gap: 8,
};

const STATUS_COLOR_FALLBACK = '#597ef7';

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
	const [roomInstances, setRoomInstances] = React.useState([]);
	const [roomInstancesLoading, setRoomInstancesLoading] = React.useState(false);
	const roomInstancesRef = React.useRef([]);
	const [zoom, setZoom] = React.useState(1);
	const [roomTypeDetailVisible, setRoomTypeDetailVisible] = React.useState(false);
	const [roomTypeDetailLoading, setRoomTypeDetailLoading] = React.useState(false);
	const [roomTypeDetailTarget, setRoomTypeDetailTarget] = React.useState(null);
	const [roomTypeDetailRooms, setRoomTypeDetailRooms] = React.useState([]);
	const [roomTypeDetailBookings, setRoomTypeDetailBookings] = React.useState([]);
	const [selectedRoom, setSelectedRoom] = React.useState(null);
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
		PENDING_CONFIRMATION: 2,
		PENDING_PAYMENT: 3,
		CONFIRMED: 4,
		CHECKED_IN: 5,
		CHECKED_OUT: 6,
		CANCELLED: 7,
		REFUNDED: 8,
	}), []);

	const resolveStatusPriority = React.useCallback((rawStatus) => {
		if (!rawStatus) return 99;
		const key = typeof rawStatus === 'string' ? rawStatus.trim().toUpperCase() : rawStatus;
		return statusPriority[key] ?? 99;
	}, [statusPriority]);

	const sortBookings = React.useCallback((list = []) => {
		return [...list]
			.filter(Boolean)
			.sort((a, b) => {
				const pa = resolveStatusPriority(a?.status);
				const pb = resolveStatusPriority(b?.status);
				if (pa !== pb) return pa - pb;
				const sa = a?.startTime ? dayjs(a.startTime).valueOf() : 0;
				const sb = b?.startTime ? dayjs(b.startTime).valueOf() : 0;
				if (sa !== sb) return sa - sb;
				return (a?.id ?? 0) - (b?.id ?? 0);
			});
	}, [resolveStatusPriority]);

	const statusOptions = React.useMemo(() => Object.entries(BOOKING_STATUS_META)
		.sort(([a], [b]) => resolveStatusPriority(a) - resolveStatusPriority(b))
		.map(([value, meta]) => ({ label: meta.label, value })), [resolveStatusPriority]);

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

	const loadOccupancy = React.useCallback(async (startAt) => {
		if (!startAt) return;
		const startDay = startAt.startOf('day');
		const endDay = startDay.add(TOTAL_DAYS, 'day');
		try {
			setTimelineLoading(true);
			setRoomInstancesLoading(true);
			const res = await fetchRoomOccupancyOverview({
				start: startDay.toISOString(),
				end: endDay.toISOString(),
			});
			setTimelineBookings(Array.isArray(res?.bookings) ? res.bookings : []);
			setRoomInstances(Array.isArray(res?.roomInstances) ? res.roomInstances : []);
		} catch (e) {
			const msg = e?.data?.message || '房间入住规划加载失败';
			navigate('/error', { state: { status: String(e.status || 500), title: '房间入住规划加载失败', subTitle: msg, backTo: '/admin' }, replace: true });
		} finally {
			setTimelineLoading(false);
			setRoomInstancesLoading(false);
		}
	}, [navigate]);

	React.useEffect(() => {
		roomInstancesRef.current = roomInstances;
	}, [roomInstances]);

	const clampZoom = React.useCallback((value) => {
		if (value < MIN_ZOOM) return MIN_ZOOM;
		if (value > MAX_ZOOM) return MAX_ZOOM;
		return Number(value.toFixed(2));
	}, []);

	const cellWidth = React.useMemo(() => BASE_CELL_WIDTH * zoom, [zoom]);
	const timelineWidth = React.useMemo(() => TOTAL_HOURS * cellWidth, [cellWidth]);

	const timelineEnd = React.useMemo(() => timelineStart.add(TOTAL_DAYS, 'day'), [timelineStart]);
	const timelineHours = React.useMemo(() => Array.from({ length: TOTAL_HOURS }, (_, i) => timelineStart.add(i, 'hour')), [timelineStart]);
	const timelineDays = React.useMemo(() => Array.from({ length: TOTAL_DAYS }, (_, i) => {
		const date = timelineStart.add(i, 'day');
		return { date, label: date.format('MM-DD ddd') };
	}), [timelineStart]);
	const weekRangeText = React.useMemo(() => `${timelineStart.format('YYYY-MM-DD')} ~ ${timelineStart.add(TOTAL_DAYS - 1, 'day').format('YYYY-MM-DD')}`, [timelineStart]);
	const zoomPercent = React.useMemo(() => Math.round(zoom * 100), [zoom]);
	const resetZoom = React.useCallback(() => setZoom(1), []);

	const handleTimelineWheel = React.useCallback((event) => {
		if (!event) return;
		const container = event.currentTarget;
		if (event.shiftKey && container) {
			event.preventDefault();
			container.scrollLeft += event.deltaY;
			return;
		}
		event.preventDefault();
		const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
		if (!delta) return;
		const factor = delta > 0 ? 0.9 : 1.1;
		setZoom((prev) => clampZoom(prev * factor));
	}, [clampZoom]);

	const openRoomTypeDetail = React.useCallback(async (roomType) => {
		if (!roomType) return;
		setRoomTypeDetailTarget(prev => {
			if (prev && prev.id === roomType.id && prev.hotelId === roomType.hotelId && prev.name === roomType.name && prev.type === roomType.type) {
				return prev;
			}
			return {
				id: roomType.id,
				hotelId: roomType.hotelId,
				name: roomType.name,
				type: roomType.type,
			};
		});
		setRoomTypeDetailVisible(true);
		setRoomTypeDetailLoading(true);
		const startIso = timelineStart.startOf('day').toDate().toISOString();
		const endIso = timelineEnd.toDate().toISOString();
		try {
			const res = await fetchRoomOccupancyOverview({
				start: startIso,
				end: endIso,
				roomTypeId: roomType.id,
				hotelId: roomType.hotelId,
			});
			const fetchedBookings = Array.isArray(res?.bookings) ? res.bookings : [];
			const fetchedRooms = Array.isArray(res?.roomInstances) ? res.roomInstances : [];
			const fallbackRooms = roomInstancesRef.current.filter((ri) => ri.roomTypeId === roomType.id);
			const mergedMap = new Map();
			[...fetchedRooms, ...fallbackRooms].forEach((ri) => {
				if (!ri) return;
				const key = ri.id ?? `${ri.roomTypeId || roomType.id}-${ri.roomNumber || ''}`;
				if (!mergedMap.has(key)) {
					mergedMap.set(key, ri);
				}
			});
			fetchedBookings.forEach((booking) => {
				if (!booking || booking.roomId == null) return;
				if (!mergedMap.has(booking.roomId)) {
					mergedMap.set(booking.roomId, {
						id: booking.roomId,
						roomId: booking.roomId,
						roomTypeId: booking.roomTypeId ?? roomType.id,
						hotelId: booking.hotelId ?? roomType.hotelId,
						roomNumber: booking.roomNumber ?? booking.roomId,
						status: booking.roomStatus,
					});
				}
			});
			const mergedRooms = Array.from(mergedMap.values()).sort((a, b) => {
				const aNo = a?.roomNumber ?? '';
				const bNo = b?.roomNumber ?? '';
				if (aNo && bNo) {
					return String(aNo).localeCompare(String(bNo), undefined, { numeric: true, sensitivity: 'base' });
				}
				if (a?.id != null && b?.id != null) {
					return a.id - b.id;
				}
				return String(aNo).localeCompare(String(bNo));
			});
			setRoomTypeDetailRooms(mergedRooms);
			setRoomTypeDetailBookings(fetchedBookings);
		} catch (e) {
			const msg = e?.data?.message || '房型入住规划加载失败';
			message.error(msg);
			setRoomTypeDetailRooms([]);
			setRoomTypeDetailBookings([]);
		} finally {
			setRoomTypeDetailLoading(false);
		}
	}, [timelineStart, timelineEnd]);

	const handleRoomTypeKeyDown = React.useCallback((event, roomType) => {
		if (!roomType) return;
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			openRoomTypeDetail(roomType);
		}
	}, [openRoomTypeDetail]);

	const refreshOverview = React.useCallback(async () => {
		await loadOccupancy(timelineStart);
		if (roomTypeDetailVisible && roomTypeDetailTarget) {
			await openRoomTypeDetail(roomTypeDetailTarget);
		}
	}, [loadOccupancy, timelineStart, roomTypeDetailVisible, roomTypeDetailTarget, openRoomTypeDetail]);

	const closeRoomTypeDetail = React.useCallback(() => {
		setRoomTypeDetailVisible(false);
		setRoomTypeDetailLoading(false);
		setRoomTypeDetailTarget(null);
		setRoomTypeDetailRooms([]);
		setRoomTypeDetailBookings([]);
	}, []);

	React.useEffect(() => { loadOrders(); }, [loadOrders]);

	React.useEffect(() => {
		refreshOverview();
	}, [refreshOverview]);

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
	const roomTypeDetailBookingsByRoom = React.useMemo(() => {
		const map = new Map();
		roomTypeDetailBookings.forEach((booking) => {
			if (!booking || booking.roomId == null) return;
			if (!map.has(booking.roomId)) {
				map.set(booking.roomId, []);
			}
			map.get(booking.roomId).push(booking);
		});
		map.forEach((list) => {
			list.sort((a, b) => {
				const sa = dayjs(a.startTime).valueOf();
				const sb = dayjs(b.startTime).valueOf();
				if (sa !== sb) return sa - sb;
				return (a?.id ?? 0) - (b?.id ?? 0);
			});
		});
		return map;
	}, [roomTypeDetailBookings]);
	const roomTypeMap = React.useMemo(() => {
		const map = new Map();
		rooms.forEach((room) => {
			if (room?.id != null) {
				map.set(room.id, room);
			}
		});
		return map;
	}, [rooms]);

	const groupedRooms = React.useMemo(() => {
		const groups = [];
		rooms.forEach((roomType) => {
			const bucket = roomInstances.filter((ri) => ri.roomTypeId === roomType.id);
			if (bucket.length) {
				groups.push({ roomType, rooms: bucket });
			}
		});
		const fallback = new Map();
		roomInstances.forEach((ri) => {
			if (!roomTypeMap.has(ri.roomTypeId)) {
				if (!fallback.has(ri.roomTypeId)) {
					fallback.set(ri.roomTypeId, []);
				}
				fallback.get(ri.roomTypeId).push(ri);
			}
		});
		fallback.forEach((list, key) => {
			groups.push({ roomType: { id: key, name: `房型 #${key}`, hotelId: list[0]?.hotelId }, rooms: list });
		});
		return groups;
	}, [rooms, roomInstances, roomTypeMap]);

	const renderRoomCell = React.useCallback((room) => {
		const meta = getRoomStatusMeta(room?.status);
		const bgColor = meta.bgColor || '#fafafa';
		const textColor = meta.color || '#595959';
		return (
			<button
				type="button"
				key={room.id ?? `${room.roomTypeId}-${room.roomNumber}`}
				className="room-instance-cell"
				onClick={() => setSelectedRoom(room)}
				style={{ backgroundColor: bgColor, color: textColor }}
			>
				<span className="room-instance-number">房间 {room.roomNumber || room.id}</span>
				<span className="room-instance-status">{meta.label}</span>
			</button>
		);
	}, [setSelectedRoom]);

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
				refreshOverview();
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
				refreshOverview();
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
				refreshOverview();
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
				message.error('入住失败');
			} else {
				message.success('已标记入住');
				loadOrders();
				refreshOverview();
			}
		} catch (e) {
			const msg = e?.data?.message || '入住失败';
			navigate('/error', { state: { status: String(e.status || 500), title: '入住失败', subTitle: msg, backTo: '/admin' }, replace: true });
		}
	};

	const doReject = async (id) => {
		try {
			const res = await rejectBooking(id);
			if (!res) {
				message.error('拒绝失败');
			} else {
				message.success('已拒绝');
				loadOrders();
				refreshOverview();
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
				message.success('已删除');
				loadOrders();
				refreshOverview();
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
		{ title: '支付', key: 'payment', render: (_, record) => (
			<Space direction="vertical" size={0}>
				<Text>{getPaymentStatusLabel(record.paymentStatus)}</Text>
				{record.paymentMethod ? <Text type="secondary">{getPaymentMethodLabel(record.paymentMethod)}</Text> : null}
			</Space>
		)},
		{ title: '状态', dataIndex: 'status', key: 'status', sorter: (a, b) => resolveStatusPriority(a?.status) - resolveStatusPriority(b?.status), defaultSortOrder: 'ascend', render: s => { const meta = getBookingStatusMeta(s); return <Tag color={meta.color}>{meta.label}</Tag>; } },
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
						<Select
							allowClear
							style={{ width: 180 }}
							options={statusOptions}
						/>
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
			<Card
				title={
					<Space size={8} align="center" wrap>
						<span style={SECTION_TITLE_STYLE}>房间入住规划总览</span>
						<Tooltip title="提示：滚轮可缩放时间轴，按住 Shift 并滚动可水平移动，点击左侧房型名称可以查看具体房间规划">
							<Text type="secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'help' }}>
								<InfoCircleOutlined />
								滚轮缩放 · Shift+滚轮横移 · 点击房型查看详情
							</Text>
						</Tooltip>
					</Space>
				}
				extra={
					<Button type="link" onClick={refreshOverview} loading={timelineLoading || roomInstancesLoading}>
						刷新
					</Button>
				}
			>
				<Space direction="vertical" size={16} style={{ width: '100%' }}>
					<Space wrap align="center">
						<Button onClick={() => setTimelineStart(prev => prev.add(-TOTAL_DAYS, 'day'))}>上一周</Button>
						<Button onClick={() => setTimelineStart(prev => prev.add(TOTAL_DAYS, 'day'))}>下一周</Button>
						<Button onClick={() => setTimelineStart(dayjs().startOf('day'))}>回到今天</Button>
						<DatePicker value={timelineStart} onChange={(value) => value && setTimelineStart(value.startOf('day'))} />
						<Text type="secondary">范围：{weekRangeText}</Text>
						<Text type="secondary">缩放：{zoomPercent}%</Text>
						<Button size="small" type="text" onClick={resetZoom}>重置缩放</Button>
					</Space>
					<Spin spinning={timelineLoading}>
						<div style={{ overflowX: 'auto', overscrollBehavior: 'contain' }} onWheel={handleTimelineWheel}>
							<div style={{ minWidth: LABEL_WIDTH + timelineWidth }}>
								<div style={{ display: 'flex' }}>
									<div
										className="timeline-label timeline-label-header"
										style={{ width: LABEL_WIDTH, padding: '8px', borderRight: '1px solid #f0f0f0', borderBottom: '1px solid #d9d9d9' }}
									>
										<Text strong>房型</Text>
									</div>
									<div style={{ width: timelineWidth, display: 'grid', gridTemplateColumns: `repeat(${TOTAL_DAYS}, ${HOURS_PER_DAY * cellWidth}px)` }}>
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
									<div
										className="timeline-label timeline-label-header"
										style={{ width: LABEL_WIDTH, padding: '4px 8px', borderRight: '1px solid #f0f0f0', borderBottom: '1px solid #d9d9d9' }}
									>
										<Text type="secondary">小时</Text>
									</div>
									<div style={{ width: timelineWidth, display: 'grid', gridTemplateColumns: `repeat(${TOTAL_HOURS}, ${cellWidth}px)` }}>
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
									const displayName = room.name || `房型 #${room.id}`;
									return (
										<div key={room.id} style={{ display: 'flex', alignItems: 'stretch' }}>
											<div
												className="timeline-label timeline-label--clickable"
												style={{ width: LABEL_WIDTH, padding: '8px', borderRight: '1px solid #f0f0f0', borderBottom: '1px solid #f0f0f0' }}
												onClick={() => openRoomTypeDetail(room)}
												onKeyDown={(event) => handleRoomTypeKeyDown(event, room)}
												role="button"
												tabIndex={0}
												aria-label={`查看房型 ${displayName} 的详细规划`}
											>
												<Space direction="vertical" size={0}>
													<Text strong>{displayName}</Text>
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
													background: `repeating-linear-gradient(to right, rgba(0,0,0,0.04) 0, rgba(0,0,0,0.04) 1px, transparent 1px, transparent ${cellWidth}px)`
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
													const left = startOffset * cellWidth;
													const width = Math.max(duration * cellWidth, Math.max(6, cellWidth * 0.5));
													const meta = getBookingStatusMeta(booking.status);
													const color = meta.color || STATUS_COLOR_FALLBACK;
													const tooltipTitle = (
														<div>
															<div>订单 #{booking.id}</div>
															<div>酒店：{booking.hotelId ?? '—'} · 房型：{booking.roomTypeId ?? booking.roomId}</div>
															<div>用户：{booking.userId} · 人数：{booking.guests ?? '—'}</div>
															<div>状态：{meta.label}</div>
															<div>时间：{bookingStart.format('MM-DD HH:mm')} ~ {bookingEnd.format('MM-DD HH:mm')}</div>
															{booking.contactName && <div>联系人：{booking.contactName}</div>}
															{booking.contactPhone && <div>电话：{booking.contactPhone}</div>}
														</div>
													);
													return (
														<Tooltip key={booking.id} title={tooltipTitle} overlayInnerStyle={{ minWidth: 220 }}>
															<div
																className="timeline-booking-block"
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
																<div style={{ fontWeight: 600 }}>#{booking.id} · {meta.label}</div>
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
						{Object.entries(BOOKING_STATUS_META).map(([status, value]) => (
							<Tag key={status} color={value.color}>{value.label}</Tag>
						))}
					</Space>
					<Divider orientation="left" orientationMargin={0} style={{ margin: '24px 0 16px' }}>
						<span style={SECTION_TITLE_STYLE}>房间状态概览</span>
					</Divider>
					{roomInstancesLoading ? (
						<div style={{ textAlign: 'center', padding: '24px 0' }}><Spin /></div>
					) : groupedRooms.length === 0 ? (
						<Text type="secondary">暂无房间数据</Text>
					) : (
						<Space direction="vertical" size={24} style={{ width: '100%' }}>
							{groupedRooms.map(({ roomType, rooms: typeRooms }) => {
								const total = typeRooms.length;
								const available = typeRooms.filter((item) => Number(item.status) === 1).length;
								const fallbackRoomType = roomTypeMap.get(roomType.id) ?? roomType;
								const openTarget = {
									id: fallbackRoomType.id ?? roomType.id,
									hotelId: fallbackRoomType.hotelId ?? typeRooms[0]?.hotelId,
									name: fallbackRoomType.name ?? roomType.name,
									type: fallbackRoomType.type ?? roomType.type,
								};
								const isOpeningCurrent = roomTypeDetailLoading && roomTypeDetailTarget?.id === openTarget.id;
								return (
									<Card
										size="small"
										key={roomType.id}
										title={
											<Space size={12} wrap>
												<Text strong>{roomType.name || `房型 #${roomType.id}`}</Text>
												<Text type="secondary">房间数：{total}</Text>
												<Text type={available > 0 ? 'success' : 'danger'}>空房：{available}</Text>
											</Space>
										}
										extra={
											<Button
												type="link"
												size="small"
												onClick={() => openRoomTypeDetail(openTarget)}
												loading={isOpeningCurrent}
											>
												查看入住规划
											</Button>
										}
									>
										<div className="room-instance-grid">
											{typeRooms.map(renderRoomCell)}
										</div>
									</Card>
								);
							})}
						</Space>
					)}
				</Space>
			</Card>
			<Modal
				open={roomTypeDetailVisible}
				title={roomTypeDetailTarget ? `${roomTypeDetailTarget.name || `房型 #${roomTypeDetailTarget.id}`} · 入住规划` : '房型入住规划'}
				width="88vw"
				onCancel={closeRoomTypeDetail}
				footer={[
					roomTypeDetailTarget ? (
						<Button
							key="refresh"
							onClick={() => roomTypeDetailTarget && openRoomTypeDetail(roomTypeDetailTarget)}
							loading={roomTypeDetailLoading}
						>
							重新加载
						</Button>
					) : null,
					<Button key="close" onClick={closeRoomTypeDetail}>
						关闭
					</Button>,
				].filter(Boolean)}
			>
				<Spin spinning={roomTypeDetailLoading}>
					{roomTypeDetailTarget ? (
						<Space direction="vertical" size={16} style={{ width: '100%' }}>
							<Space wrap>
								<Text strong>{roomTypeDetailTarget.name || `房型 #${roomTypeDetailTarget.id}`}</Text>
								<Text type="secondary">房型ID：{roomTypeDetailTarget.id}</Text>
								{roomTypeDetailTarget.hotelId != null ? (
									<Text type="secondary">酒店ID：{roomTypeDetailTarget.hotelId}</Text>
								) : null}
								{roomTypeDetailTarget.type ? <Tag color="blue">{roomTypeDetailTarget.type}</Tag> : null}
								<Text type="secondary">时间范围：{weekRangeText}</Text>
							</Space>
							<div style={{ overflowX: 'auto', overscrollBehavior: 'contain' }} onWheel={handleTimelineWheel}>
								<div style={{ minWidth: LABEL_WIDTH + timelineWidth }}>
									<div style={{ display: 'flex' }}>
										<div
											className="timeline-label timeline-label-header"
											style={{ width: LABEL_WIDTH, padding: '8px', borderRight: '1px solid #f0f0f0', borderBottom: '1px solid #d9d9d9' }}
										>
											<Text strong>房间</Text>
										</div>
										<div style={{ width: timelineWidth, display: 'grid', gridTemplateColumns: `repeat(${TOTAL_DAYS}, ${HOURS_PER_DAY * cellWidth}px)` }}>
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
										<div
											className="timeline-label timeline-label-header"
											style={{ width: LABEL_WIDTH, padding: '4px 8px', borderRight: '1px solid #f0f0f0', borderBottom: '1px solid #d9d9d9' }}
										>
											<Text type="secondary">小时</Text>
										</div>
										<div style={{ width: timelineWidth, display: 'grid', gridTemplateColumns: `repeat(${TOTAL_HOURS}, ${cellWidth}px)` }}>
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
									{roomTypeDetailRooms.length === 0 ? (
										<div style={{ padding: '48px 0', borderBottom: '1px solid #f0f0f0' }}>
											<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无房间数据" />
										</div>
									) : (
										roomTypeDetailRooms.map((room) => {
											const roomKey = room.id ?? room.roomId ?? `${room.roomTypeId || roomTypeDetailTarget.id}-${room.roomNumber || 'unknown'}`;
											const roomBookings = roomTypeDetailBookingsByRoom.get(room.id ?? room.roomId) || [];
											const meta = getRoomStatusMeta(room?.status);
											return (
												<div key={roomKey} style={{ display: 'flex', alignItems: 'stretch' }}>
													<div className="timeline-label" style={{ width: LABEL_WIDTH, padding: '8px', borderRight: '1px solid #f0f0f0', borderBottom: '1px solid #f0f0f0' }}>
														<Space direction="vertical" size={0}>
															<Text strong>房间 {room.roomNumber || room.id || '未知'}</Text>
															<Text type="secondary" style={{ fontSize: 12 }}>ID #{room.id ?? room.roomId ?? '—'} · 状态：{meta.label || '未知'}</Text>
														</Space>
													</div>
													<div
														style={{
															width: timelineWidth,
															position: 'relative',
															borderBottom: '1px solid #f0f0f0',
															minHeight: 56,
															background: `repeating-linear-gradient(to right, rgba(0,0,0,0.04) 0, rgba(0,0,0,0.04) 1px, transparent 1px, transparent ${cellWidth}px)`
														}}
													>
														{roomBookings.length === 0 ? null : roomBookings.map((booking) => {
															const bookingStart = dayjs(booking.startTime);
															const bookingEnd = dayjs(booking.endTime);
															const effectiveStart = bookingStart.isBefore(timelineStart) ? timelineStart : bookingStart;
															const effectiveEnd = bookingEnd.isAfter(timelineEnd) ? timelineEnd : bookingEnd;
															if (!effectiveEnd.isAfter(effectiveStart)) return null;
															const startOffset = effectiveStart.diff(timelineStart, 'minute') / 60;
															const duration = effectiveEnd.diff(effectiveStart, 'minute') / 60;
															const left = startOffset * cellWidth;
															const width = Math.max(duration * cellWidth, Math.max(6, cellWidth * 0.5));
															const metaInfo = getBookingStatusMeta(booking.status);
															const color = metaInfo.color || STATUS_COLOR_FALLBACK;
															const tooltipTitle = (
																<div>
																	<div>订单 #{booking.id}</div>
																	<div>房间：{room.roomNumber || room.id || booking.roomId}</div>
																	<div>状态：{metaInfo.label}</div>
																	<div>时间：{bookingStart.format('MM-DD HH:mm')} ~ {bookingEnd.format('MM-DD HH:mm')}</div>
																	{booking.contactName && <div>联系人：{booking.contactName}</div>}
																	{booking.contactPhone && <div>电话：{booking.contactPhone}</div>}
																</div>
															);
															return (
																<Tooltip key={booking.id} title={tooltipTitle} overlayInnerStyle={{ minWidth: 220 }}>
																	<div
																		className="timeline-booking-block"
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
																			<div style={{ fontWeight: 600 }}>#{booking.id} · {metaInfo.label}</div>
																			<div style={{ fontSize: 12 }}>{bookingStart.format('MM-DD HH:mm')} ~ {bookingEnd.format('MM-DD HH:mm')}</div>
																		</div>
																	</Tooltip>
															);
													})}
												</div>
											</div>
										);
									})
								)}
							</div>
							</div>
							<Space wrap>
								{Object.entries(BOOKING_STATUS_META).map(([status, value]) => (
									<Tag key={status} color={value.color}>{value.label}</Tag>
								))}
							</Space>
						</Space>
					) : (
						<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请选择房型" />
					)}
				</Spin>
			</Modal>
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
			<Modal
				open={!!selectedRoom}
				title={selectedRoom ? `房间 ${selectedRoom.roomNumber || selectedRoom.id}` : '房间详情'}
				onCancel={() => setSelectedRoom(null)}
				footer={[
					<Button key="close" onClick={() => setSelectedRoom(null)}>
						关闭
					</Button>,
				]}
			>
				{selectedRoom ? (
					<Descriptions column={1} size="small" bordered>
						<Descriptions.Item label="房型">
							{roomTypeMap.get(selectedRoom.roomTypeId)?.name || `房型 #${selectedRoom.roomTypeId}`}
						</Descriptions.Item>
						<Descriptions.Item label="房间号">{selectedRoom.roomNumber || selectedRoom.id}</Descriptions.Item>
						<Descriptions.Item label="状态">
							{(() => {
								const meta = getRoomStatusMeta(selectedRoom.status);
								return (
									<Space size={8} wrap>
										<Tag color={meta.color}>{meta.label}</Tag>
										<Text type="secondary">{meta.description}</Text>
									</Space>
								);
							})()}
						</Descriptions.Item>
						<Descriptions.Item label="楼层">{selectedRoom.floor != null ? `${selectedRoom.floor}F` : '未知'}</Descriptions.Item>
						<Descriptions.Item label="最后退房时间">{selectedRoom.lastCheckoutTime ? dayjs(selectedRoom.lastCheckoutTime).format('YYYY-MM-DD HH:mm') : '暂无记录'}</Descriptions.Item>
						<Descriptions.Item label="创建时间">{selectedRoom.createdTime ? dayjs(selectedRoom.createdTime).format('YYYY-MM-DD HH:mm') : '未知'}</Descriptions.Item>
						<Descriptions.Item label="更新时间">{selectedRoom.updatedTime ? dayjs(selectedRoom.updatedTime).format('YYYY-MM-DD HH:mm') : '未知'}</Descriptions.Item>
					</Descriptions>
				) : null}
			</Modal>
		</Space>
	);
}
