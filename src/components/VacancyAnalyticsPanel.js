import React from 'react';
import {
	Card,
	Space,
	Typography,
	DatePicker,
	Select,
	Segmented,
	Button,
	Spin,
	Tooltip,
	List,
	Modal,
	Table,
	Switch,
	message,
} from 'antd';
import { Line } from '@ant-design/plots';
import dayjs from 'dayjs';
import html2canvas from 'html2canvas';
import { saveAs } from 'file-saver';
import { getRooms, fetchVacancyAnalytics } from '../services/api';

const { Title, Text } = Typography;

const METRIC_OPTIONS = [
	{ label: '空置数量', value: 'vacancyCount' },
	{ label: '空置率', value: 'vacancyRate' },
	{ label: '预订率', value: 'bookingRate' },
];

const GRANULARITY_OPTIONS = [
	{ label: '小时', value: 'HOUR' },
	{ label: '日', value: 'DAY' },
];

const RANGE_PRESETS = [
	{ label: '近7天', value: 'LAST_7_DAYS' },
	{ label: '近30天', value: 'LAST_30_DAYS' },
	{ label: '本季度', value: 'THIS_QUARTER' },
	{ label: '自定义', value: 'CUSTOM' },
];

const DEFAULT_THRESHOLD_HIGH = 0.7;
const DEFAULT_THRESHOLD_LOW = 0.2;

function resolveRange(preset, customRange, granularity) {
	const now = dayjs();
	switch (preset) {
		case 'LAST_7_DAYS':
			return granularity === 'HOUR'
				? [now.startOf('day'), now.endOf('day')]
				: [now.subtract(7, 'day').startOf('day'), now.endOf('day')];
		case 'LAST_30_DAYS':
			return granularity === 'HOUR'
				? [now.startOf('day'), now.endOf('day')]
				: [now.subtract(30, 'day').startOf('day'), now.endOf('day')];
		case 'THIS_QUARTER': {
			const quarter = Math.floor((now.month()) / 3);
			const start = now.startOf('year').add(quarter * 3, 'month').startOf('month');
			if (granularity === 'HOUR') {
				return [now.startOf('day'), now.endOf('day')];
			}
			return [start, start.add(3, 'month').subtract(1, 'day').endOf('day')];
		}
		case 'CUSTOM':
			if (customRange?.length === 2) return customRange;
			break;
		default:
			break;
	}
	if (granularity === 'HOUR') {
		return [now.subtract(1, 'day').startOf('day'), now.endOf('day')];
	}
	return [now.subtract(30, 'day').startOf('day'), now.endOf('day')];
}

function formatMetric(value, metric) {
	if (value == null) return '-';
	if (metric === 'vacancyCount') {
		return Number(value).toFixed(2);
	}
	return `${(Number(value) * 100).toFixed(2)}%`;
}

const DETAIL_COLUMNS = [
	{ title: '指标', dataIndex: 'label', key: 'label' },
	{ title: '数值', dataIndex: 'value', key: 'value' },
];

export default function VacancyAnalyticsPanel() {
	const [rooms, setRooms] = React.useState([]);
	const [loadingRooms, setLoadingRooms] = React.useState(false);
	const [analytics, setAnalytics] = React.useState(null);
	const [loading, setLoading] = React.useState(false);
	const [selectedRooms, setSelectedRooms] = React.useState([]);
	const [metric, setMetric] = React.useState('vacancyRate');
	const [granularity, setGranularity] = React.useState('DAY');
	const [rangePreset, setRangePreset] = React.useState('LAST_30_DAYS');
	const [customRange, setCustomRange] = React.useState(null);
	const [thresholdHigh, setThresholdHigh] = React.useState(DEFAULT_THRESHOLD_HIGH);
	const [thresholdLow, setThresholdLow] = React.useState(DEFAULT_THRESHOLD_LOW);
	const [includeForecast, setIncludeForecast] = React.useState(true);
	const [detailPoint, setDetailPoint] = React.useState(null);

	const chartRef = React.useRef(null);
	const chartContainerRef = React.useRef(null);

	React.useEffect(() => {
		const loadRooms = async () => {
			try {
				setLoadingRooms(true);
				const data = await getRooms();
				const normalized = Array.isArray(data) ? data.filter(r => r && r.id != null) : [];
				setRooms(normalized);
				if (normalized.length && selectedRooms.length === 0) {
					setSelectedRooms(normalized.slice(0, Math.min(3, normalized.length)).map(r => r.id));
				}
			} catch (e) {
				message.error('房型列表加载失败');
			} finally {
				setLoadingRooms(false);
			}
		};
		loadRooms();
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const loadAnalytics = React.useCallback(async () => {
		const [rangeStart, rangeEnd] = resolveRange(rangePreset, customRange, granularity);
		if (!rangeStart || !rangeEnd) return;
		try {
			setLoading(true);
			const payload = await fetchVacancyAnalytics({
				roomTypeIds: selectedRooms,
				start: rangeStart.toISOString(),
				end: rangeEnd.toISOString(),
				granularity,
				thresholdHigh,
				thresholdLow,
				forecastDays: includeForecast ? undefined : 0,
			});
			setAnalytics(payload);
		} catch (e) {
			const status = e?.status || 500;
			const msg = e?.data?.message || '空置数据加载失败';
			message.error(`${status}：${msg}`);
		} finally {
			setLoading(false);
		}
	}, [customRange, granularity, includeForecast, rangePreset, selectedRooms, thresholdHigh, thresholdLow]);

	React.useEffect(() => {
		if (selectedRooms.length) {
			loadAnalytics();
		}
	}, [loadAnalytics, selectedRooms]);

	const dataset = React.useMemo(() => {
		if (!analytics?.series?.length) return [];
		const rows = [];
		analytics.series.forEach(series => {
			(series.points || []).forEach(point => {
				if (!includeForecast && point.forecast) return;
				const value = metric === 'vacancyCount' ? point.vacancyCount : metric === 'vacancyRate' ? point.vacancyRate : point.bookingRate;
				if (value == null || Number.isNaN(value)) return;
				rows.push({
					roomTypeId: series.roomTypeId,
					roomTypeName: series.roomTypeName,
					timestamp: dayjs(point.timestamp).toDate(),
					value,
					vacancyCount: point.vacancyCount,
					vacancyRate: point.vacancyRate,
					bookingRate: point.bookingRate,
					forecast: point.forecast,
					sourceBreakdown: point.sourceBreakdown,
					statusBreakdown: point.statusBreakdown,
					averagePrice: point.averagePrice,
					priceStrategy: point.priceStrategy,
					totalRooms: series.totalRooms,
				});
			});
		});
		return rows.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
	}, [analytics, includeForecast, metric]);

	const yDomain = React.useMemo(() => {
		if (!dataset.length) return null;
		const values = dataset
			.map(row => (typeof row.value === 'number' ? row.value : null))
			.filter(val => val != null && Number.isFinite(val));
		if (!values.length) return null;
		let min = Math.min(...values);
		let max = Math.max(...values);
		if (min === max) {
			const padding = min === 0 ? 1 : Math.abs(min) * 0.1 || 1;
			min -= padding;
			max += padding;
		}
		return {
			min,
			max,
			range: max - min,
		};
	}, [dataset]);

	const alertAnnotations = React.useMemo(() => {
		if (!analytics?.alerts?.length || !yDomain) return [];
		return analytics.alerts.flatMap(alert => {
			const startDate = dayjs(alert.start).toDate();
			const endDate = dayjs(alert.end).toDate();
			const color = alert.level === 'HIGH' ? '#ff7875' : '#1677ff';
			const midDate = new Date((startDate.getTime() + endDate.getTime()) / 2);
			const topPosition = yDomain.max + yDomain.range * 0.05;
			return [
				{
					type: 'line',
					start: [startDate, yDomain.min],
					end: [startDate, yDomain.max],
					style: { stroke: color, lineDash: [4, 4], lineWidth: 1 },
				},
				{
					type: 'line',
					start: [endDate, yDomain.min],
					end: [endDate, yDomain.max],
					style: { stroke: color, lineDash: [4, 4], lineWidth: 1 },
				},
				{
					type: 'text',
					position: [midDate, topPosition],
					content: `${alert.reason}(${Math.round(alert.actual * 100)}%)`,
					offsetY: -12,
					style: {
						fill: color,
						fontSize: 12,
						fontWeight: 500,
						background: { fill: 'rgba(255,255,255,0.9)', padding: [2, 6] },
					},
				},
			];
		});
	}, [analytics, yDomain]);

	const eventMarkers = React.useMemo(() => {
		if (!analytics?.events?.length || !yDomain) return [];
		return analytics.events.map(event => ({
			type: 'line',
			start: [dayjs(event.timestamp).toDate(), yDomain.min],
			end: [dayjs(event.timestamp).toDate(), yDomain.max],
			style: { stroke: '#faad14', lineDash: [3, 3] },
			label: {
				position: 'end',
				content: `${event.title}`,
				style: { fill: '#faad14', fontSize: 12 },
			},
		}));
	}, [analytics, yDomain]);

	const chartConfig = React.useMemo(() => ({
		data: dataset,
		xField: 'timestamp',
		yField: 'value',
		seriesField: 'roomTypeName',
		smooth: true,
		xAxis: { type: 'time', tickCount: 6 },
		yAxis: {
			title: {
				text: METRIC_OPTIONS.find(m => m.value === metric)?.label ?? '数值',
			},
			label: {
				formatter: (val) => metric === 'vacancyCount' ? Number(val).toFixed(0) : `${(Number(val) * 100).toFixed(0)}%`,
			},
		},
		point: { size: 3 },
		legend: { position: 'top-left' },
		tooltip: {
			shared: true,
			customItems: (items) => items.map(item => {
				const datum = item.data;
				return {
					...item,
					name: `${datum.roomTypeName}${datum.forecast ? '（预测）' : ''}`,
					value: formatMetric(datum[metric], metric),
				};
			}),
		},
		lineStyle: ({ forecast }) => (forecast ? { lineDash: [4, 4], opacity: 0.8 } : {}),
		state: {
			active: {
				style: {
					shadowColor: '#888', shadowBlur: 6,
				},
			},
		},
		interactions: [{ type: 'legend-filter' }, { type: 'element-active' }],
		annotations: [...alertAnnotations, ...eventMarkers],
	}), [dataset, metric, alertAnnotations, eventMarkers]);

	const onChartReady = React.useCallback((plot) => {
		chartRef.current = plot;
		plot.on('element:click', (evt) => {
			const datum = evt?.data?.data;
			if (datum) {
				setDetailPoint({
					...datum,
					timestamp: dayjs(datum.timestamp),
				});
			}
		});
	}, []);

	const handleExportCsv = React.useCallback(() => {
		if (!dataset.length) {
			message.info('暂无数据可导出');
			return;
		}
		const headers = ['房型', '时间', '空置数量', '空置率', '预订率', '是否预测'];
		const rows = dataset.map(row => ([
			row.roomTypeName,
			dayjs(row.timestamp).format('YYYY-MM-DD HH:mm'),
			row.vacancyCount,
			row.vacancyRate,
			row.bookingRate,
			row.forecast ? '是' : '否',
		]));
		const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
		const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
		saveAs(blob, `vacancy-${dayjs().format('YYYYMMDD-HHmmss')}.csv`);
	}, [dataset]);

	const handleScreenshot = React.useCallback(async () => {
		if (!chartContainerRef.current) return;
		const canvas = await html2canvas(chartContainerRef.current, { backgroundColor: '#fff', useCORS: true, scale: 2 });
		canvas.toBlob((blob) => {
			if (blob) {
				saveAs(blob, `vacancy-chart-${dayjs().format('YYYYMMDD-HHmmss')}.png`);
			}
		});
	}, []);

	const detailDataSource = React.useMemo(() => {
		if (!detailPoint) return [];
		const rows = [
			{ key: 'room', label: '房型', value: detailPoint.roomTypeName },
			{ key: 'time', label: '时间', value: detailPoint.timestamp.format('YYYY-MM-DD HH:mm') },
			{ key: 'vacancy', label: '空置数量', value: detailPoint.vacancyCount?.toFixed(2) },
			{ key: 'vacancyRate', label: '空置率', value: (detailPoint.vacancyRate * 100).toFixed(2) + '%' },
			{ key: 'bookingRate', label: '预订率', value: (detailPoint.bookingRate * 100).toFixed(2) + '%' },
			{ key: 'price', label: '平均价格', value: detailPoint.averagePrice != null ? `¥${Number(detailPoint.averagePrice).toFixed(2)}` : '-' },
			{ key: 'strategy', label: '价格策略', value: detailPoint.priceStrategy || '-' },
		];
		return rows;
	}, [detailPoint]);

	const detailStatusData = React.useMemo(() => {
		if (!detailPoint?.statusBreakdown) return [];
		return Object.entries(detailPoint.statusBreakdown).map(([k, v]) => ({ key: k, label: `状态-${k}`, value: v }));
	}, [detailPoint]);

	const detailSourceData = React.useMemo(() => {
		if (!detailPoint?.sourceBreakdown) return [];
		return Object.entries(detailPoint.sourceBreakdown).map(([k, v]) => ({ key: k, label: `来源-${k}`, value: v }));
	}, [detailPoint]);

	return (
		<Card title={<Space><Title level={4} style={{ margin: 0 }}>房型空置曲线</Title></Space>}>
			<Space direction="vertical" size={16} style={{ width: '100%' }}>
				<Space wrap>
					<Text strong>时间粒度</Text>
					<Segmented options={GRANULARITY_OPTIONS} value={granularity} onChange={setGranularity} />
					<Text strong>时间范围</Text>
					<Segmented options={RANGE_PRESETS} value={rangePreset} onChange={setRangePreset} />
					{rangePreset === 'CUSTOM' && (
						<DatePicker.RangePicker
							allowClear={false}
							value={customRange}
							showTime={granularity === 'HOUR'}
							onChange={(vals) => setCustomRange(vals)}
						/>
					)}
					<Text strong>房型</Text>
					<Select
						mode="multiple"
						placeholder="选择房型"
						style={{ minWidth: 200 }}
						loading={loadingRooms}
						options={rooms.map(room => ({ label: `${room.name ?? room.type ?? '房型'} (#${room.id})`, value: room.id }))}
						value={selectedRooms}
						onChange={setSelectedRooms}
					/>
					<Text strong>指标</Text>
					<Segmented options={METRIC_OPTIONS} value={metric} onChange={setMetric} />
				</Space>
				<Space wrap>
					<Tooltip title="空置率高于该阈值将触发预警">
						<Text>高位阈值</Text>
					</Tooltip>
					<InputNumberWithStep value={thresholdHigh} onChange={setThresholdHigh} />
					<Tooltip title="空置率低于该阈值将触发预警">
						<Text>低位阈值</Text>
					</Tooltip>
					<InputNumberWithStep value={thresholdLow} onChange={setThresholdLow} />
					<Space align="center">
						<Text>包含预测</Text>
						<Switch checked={includeForecast} onChange={setIncludeForecast} />
					</Space>
					<Button type="primary" onClick={loadAnalytics} disabled={!selectedRooms.length}>刷新数据</Button>
					<Button onClick={handleExportCsv}>导出CSV</Button>
					<Button onClick={handleScreenshot}>生成截图</Button>
				</Space>
				<div ref={chartContainerRef}>
					<Spin spinning={loading}>
						{dataset.length ? (
							<Line {...chartConfig} onReady={onChartReady} />
						) : (
							<div style={{ textAlign: 'center', padding: '48px 0' }}>
								<Text type="secondary">暂无数据</Text>
							</div>
						)}
					</Spin>
				</div>
				{analytics?.alerts?.length ? (
					<Card size="small" title="阈值预警">
						<List
							dataSource={analytics.alerts}
							renderItem={alert => (
								<List.Item>
									<Space direction="vertical" size={0}>
										<Text strong>{alert.roomTypeName}</Text>
										<Text>{dayjs(alert.start).format('YYYY-MM-DD HH:mm')} ~ {dayjs(alert.end).format('YYYY-MM-DD HH:mm')}</Text>
										<Text type={alert.level === 'HIGH' ? 'danger' : 'success'}>
											{alert.reason}（阈值 {Math.round(alert.threshold * 100)}%，实际 {Math.round(alert.actual * 100)}%）
										</Text>
									</Space>
								</List.Item>
							)}
						/>
					</Card>
				) : null}
				{analytics?.events?.length ? (
					<Card size="small" title="关键节点标注">
						<List
							dataSource={analytics.events}
							renderItem={event => (
								<List.Item>
									<Space direction="vertical" size={0}>
										<Text strong>{event.title}</Text>
										<Text>{dayjs(event.timestamp).format('YYYY-MM-DD')} · {event.category}</Text>
										<Text type="secondary">{event.description}</Text>
									</Space>
								</List.Item>
							)}
						/>
					</Card>
				) : null}
			</Space>
			<Modal
				open={!!detailPoint}
				title="时间点详情"
				footer={null}
				onCancel={() => setDetailPoint(null)}
				width={640}
			>
				<Table
					columns={DETAIL_COLUMNS}
					pagination={false}
					showHeader={false}
					dataSource={[...detailDataSource, ...detailStatusData, ...detailSourceData]}
					size="small"
				/>
			</Modal>
		</Card>
	);
}

function InputNumberWithStep({ value, onChange }) {
	const [inner, setInner] = React.useState(value);

	React.useEffect(() => { setInner(value); }, [value]);

	return (
		<Segmented
			options={[
				{ label: '20%', value: 0.2 },
				{ label: '30%', value: 0.3 },
				{ label: '50%', value: 0.5 },
				{ label: '70%', value: 0.7 },
				{ label: '自定义', value: 'custom' },
			]}
			value={typeof inner === 'number' ? inner : 'custom'}
			onChange={(val) => {
				if (val === 'custom') {
					const input = window.prompt('请输入阈值（0-1之间的小数）', inner);
					if (input == null) return;
					const parsed = Number(input);
					if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 1) {
						onChange(parsed);
						setInner(parsed);
					} else {
						message.error('请输入0到1之间的数');
					}
				} else {
					onChange(val);
					setInner(val);
				}
			}}
		/>
	);
}
