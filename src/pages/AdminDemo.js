import React from 'react';
import { Card, Space, Typography, InputNumber, Button, message, Row, Col, Table, Tag, Form, DatePicker, Select } from 'antd';
import { useNavigate } from 'react-router-dom';
import { getRooms, adjustRoomTotalCount, confirmBooking, checkoutBooking, adminListBookings } from '../services/api';

const { Title, Text } = Typography;

export default function AdminDemo() {
	const [rooms, setRooms] = React.useState([]);
	const [loading, setLoading] = React.useState(false);
	const [totalInput, setTotalInput] = React.useState({});
	const [bookingId, setBookingId] = React.useState();
  const [orders, setOrders] = React.useState({ items: [], page: 1, size: 10, total: 0 });
  const [ordersLoading, setOrdersLoading] = React.useState(false);
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

	const loadOrders = React.useCallback(async (params = {}) => {
		try {
			setOrdersLoading(true);
			const res = await adminListBookings({ page: orders.page, size: orders.size, ...params });
			setOrders(res || { items: [], page: 1, size: 10, total: 0 });
		} catch (e) {
			const msg = e?.data?.message || '订单加载失败';
			navigate('/error', { state: { status: String(e.status || 500), title: '加载订单失败', subTitle: msg, backTo: '/admin' }, replace: true });
		} finally {
			setOrdersLoading(false);
		}
	}, [orders.page, orders.size, navigate]);

	React.useEffect(() => { loadOrders(); }, [loadOrders]);

	const doAdjust = async (id) => {
		const v = totalInput[id];
		if (typeof v !== 'number') { message.warning('请输入有效的总数'); return; }
			try {
				const res = await adjustRoomTotalCount(id, v);
				if (!res) message.error('更新失败'); else { message.success('更新成功'); load(); }
			} catch (e) {
				const msg = e?.data?.message || '更新失败';
				navigate('/error', { state: { status: String(e.status || 500), title: '更新失败', subTitle: msg, backTo: '/admin' }, replace: true });
			}
	};

	const doConfirm = async () => {
		if (!bookingId) { message.warning('请输入预订ID'); return; }
			try {
				const res = await confirmBooking(bookingId);
				if (!res) message.error('确认失败'); else message.success('已确认');
			} catch (e) {
				const msg = e?.data?.message || '确认失败';
				navigate('/error', { state: { status: String(e.status || 500), title: '确认失败', subTitle: msg, backTo: '/admin' }, replace: true });
			}
	};

	const doCheckout = async () => {
		if (!bookingId) { message.warning('请输入预订ID'); return; }
			try {
				const res = await checkoutBooking(bookingId);
				if (!res) message.error('退房失败'); else message.success('已退房');
			} catch (e) {
				const msg = e?.data?.message || '退房失败';
				navigate('/error', { state: { status: String(e.status || 500), title: '退房失败', subTitle: msg, backTo: '/admin' }, replace: true });
			}
	};

  const orderColumns = [
    { title: '订单ID', dataIndex: 'id', key: 'id', width: 90 },
    { title: '用户ID', dataIndex: 'userId', key: 'userId', width: 90 },
    { title: '房型ID', dataIndex: 'roomId', key: 'roomId', width: 90 },
    { title: '开始', dataIndex: 'startTime', key: 'startTime' },
    { title: '结束', dataIndex: 'endTime', key: 'endTime' },
    { title: '金额', dataIndex: 'amount', key: 'amount', render: v => v != null ? `¥${v}` : '-' },
    { title: '状态', dataIndex: 'status', key: 'status', render: s => <Tag color={s === 'CANCELLED' ? 'red' : s === 'CONFIRMED' ? 'green' : 'blue'}>{s}</Tag> },
  ];

	return (
		<Space direction="vertical" size={16} style={{ width: '100%' }}>
			<Title level={3} style={{ margin: 0 }}>管理（演示）</Title>
			<Card>
				<Space>
					<Text>Booking ID:</Text>
					<InputNumber value={bookingId} onChange={setBookingId} min={1} />
					<Button onClick={doConfirm}>确认入住</Button>
					<Button onClick={doCheckout}>退房</Button>
				</Space>
			</Card>
			<Card title="订单管理">
				<Form
					layout="inline"
					onFinish={(vals) => {
						const { status, userId, roomId, range } = vals;
						const params = {
							status,
							userId,
							roomId,
							start: range?.[0]?.toISOString(),
							end: range?.[1]?.toISOString()
						};
						loadOrders(params);
					}}
				>
					<Form.Item label="状态" name="status">
						<Select allowClear style={{ width: 160 }} options={[
							{ label: 'PENDING', value: 'PENDING' },
							{ label: 'CONFIRMED', value: 'CONFIRMED' },
							{ label: 'CHECKED_OUT', value: 'CHECKED_OUT' },
							{ label: 'CANCELLED', value: 'CANCELLED' },
						]} />
					</Form.Item>
					<Form.Item label="用户ID" name="userId">
						<InputNumber min={1} />
					</Form.Item>
					<Form.Item label="房型ID" name="roomId">
						<InputNumber min={1} />
					</Form.Item>
					<Form.Item label="时间范围" name="range">
						<DatePicker.RangePicker showTime />
					</Form.Item>
					<Form.Item>
						<Space>
							<Button type="primary" htmlType="submit">查询</Button>
							<Button onClick={() => loadOrders()}>重置</Button>
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
