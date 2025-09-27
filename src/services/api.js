const BASE = '/api';

function getToken() {
	try {
		return localStorage.getItem('auth:token') || '';
	} catch {
		return '';
	}
}

async function parseBody(res) {
	const text = await res.text();
	try { return text ? JSON.parse(text) : null; } catch { return text; }
}

function toBoolean(value) {
	if (typeof value === 'boolean') return value;
	if (typeof value === 'number') return value !== 0;
	if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'yes';
	return !!value;
}

function normalizeAmenityList(value) {
	if (!value) return [];
	if (Array.isArray(value)) return value.filter(Boolean);
	if (typeof value === 'string') {
		try {
			const parsed = JSON.parse(value);
			if (Array.isArray(parsed)) return parsed.filter(Boolean);
		} catch (e) {
			const urlMatches = value.match(/https?:\/\/[^\s,]+/g);
			if (urlMatches && urlMatches.length) {
				return urlMatches.map((item) => item.trim()).filter(Boolean);
			}
			const parts = value.split(',').map((item) => item.trim()).filter(Boolean);
			if (parts.length) return parts;
		}
	}
	return [];
}

function normalizeRoom(room) {
	if (!room || typeof room !== 'object') return room;
	const normalized = { ...room };
	if (normalized.hotel_id != null && normalized.hotelId == null) {
		normalized.hotelId = normalized.hotel_id;
	}
	if (normalized.total_count != null && normalized.totalCount == null) {
		normalized.totalCount = normalized.total_count;
	}
	if (normalized.available_count != null && normalized.availableCount == null) {
		normalized.availableCount = normalized.available_count;
	}
	if (normalized.price_per_night != null && normalized.pricePerNight == null) {
		normalized.pricePerNight = normalized.price_per_night;
	}
	if (normalized.area_sqm != null && normalized.areaSqm == null) {
		normalized.areaSqm = normalized.area_sqm;
	}
	if (normalized.max_guests != null && normalized.maxGuests == null) {
		normalized.maxGuests = normalized.max_guests;
	}
	if (normalized.bed_type != null && normalized.bedType == null) {
		normalized.bedType = normalized.bed_type;
	}
	if (normalized.is_active != null && normalized.isActive == null) {
		normalized.isActive = normalized.is_active;
	}
	if (normalized.isActive != null) {
		normalized.isActive = toBoolean(normalized.isActive);
	}
	if (normalized.amenities != null) {
		normalized.amenities = normalizeAmenityList(normalized.amenities);
	}
	if (normalized.areaSqm != null) {
		normalized.areaSqm = Number(normalized.areaSqm);
	}
	if (normalized.maxGuests != null) {
		normalized.maxGuests = Number(normalized.maxGuests);
	}
	if (normalized.totalCount != null) {
		normalized.totalCount = Number(normalized.totalCount);
	}
	if (normalized.availableCount != null) {
		normalized.availableCount = Number(normalized.availableCount);
	}
	if (normalized.pricePerNight != null) {
		const price = Number(normalized.pricePerNight);
		normalized.pricePerNight = Number.isNaN(price) ? normalized.pricePerNight : price;
	}
	return normalized;
}

function normalizeBooking(booking) {
	if (!booking || typeof booking !== 'object') return booking;
	const normalized = { ...booking };
	if (normalized.room_type_id != null && normalized.roomTypeId == null) {
		normalized.roomTypeId = normalized.room_type_id;
	}
	if (normalized.room_id != null && normalized.roomId == null) {
		normalized.roomId = normalized.room_id;
	}
	if (normalized.hotel_id != null && normalized.hotelId == null) {
		normalized.hotelId = normalized.hotel_id;
	}
	if (normalized.roomTypeId == null && normalized.roomId != null) {
		normalized.roomTypeId = normalized.roomId;
	}
	if (normalized.start_time != null && normalized.startTime == null) {
		normalized.startTime = normalized.start_time;
	}
	if (normalized.end_time != null && normalized.endTime == null) {
		normalized.endTime = normalized.end_time;
	}
	if (normalized.contact_name != null && normalized.contactName == null) {
		normalized.contactName = normalized.contact_name;
	}
	if (normalized.contact_phone != null && normalized.contactPhone == null) {
		normalized.contactPhone = normalized.contact_phone;
	}
	if (normalized.remark == null && normalized.remarks != null) {
		normalized.remark = normalized.remarks;
	}
	if (normalized.created_at != null && normalized.createdAt == null) {
		normalized.createdAt = normalized.created_at;
	}
	if (normalized.updated_at != null && normalized.updatedAt == null) {
		normalized.updatedAt = normalized.updated_at;
	}
	if (normalized.status != null) {
		normalized.status = String(normalized.status).toUpperCase();
	}
	if (normalized.amount != null) {
		const amount = Number(normalized.amount);
		normalized.amount = Number.isNaN(amount) ? normalized.amount : amount;
	}
	if (normalized.guests != null) {
		const guests = Number(normalized.guests);
		normalized.guests = Number.isNaN(guests) ? normalized.guests : guests;
	}
	return normalized;
}

function normalizeHotel(hotel) {
	if (!hotel || typeof hotel !== 'object') return hotel;
	const normalized = { ...hotel };
	if (normalized.hero_image_url != null && normalized.heroImageUrl == null) {
		normalized.heroImageUrl = normalized.hero_image_url;
	}
	if (normalized.gallery_images != null && normalized.galleryImages == null) {
		normalized.galleryImages = normalized.gallery_images;
	}
	if (normalized.star_level != null && normalized.starLevel == null) {
		normalized.starLevel = normalized.star_level;
	}
	if (normalized.created_time != null && normalized.createdTime == null) {
		normalized.createdTime = normalized.created_time;
	}
	if (normalized.updated_time != null && normalized.updatedTime == null) {
		normalized.updatedTime = normalized.updated_time;
	}
	if (normalized.galleryImages != null && !Array.isArray(normalized.galleryImages)) {
		normalized.galleryImages = getImageList(normalized.galleryImages);
	}
	if (normalized.galleryImages == null) {
		normalized.galleryImages = [];
	}
	return normalized;
}

function normalizePageResponse(payload, mapper) {
	if (!payload) return payload;
	if (Array.isArray(payload)) return mapper ? payload.map(mapper) : payload;
	if (payload && Array.isArray(payload.items) && mapper) {
		return { ...payload, items: payload.items.map(mapper) };
	}
	return payload;
}

async function request(path, { method = 'GET', headers = {}, body, query, auth = true, json = false, redirectOn401 = true } = {}) {
	const url = new URL(BASE + path, window.location.origin);
	if (query) {
		Object.entries(query).forEach(([k, v]) => {
			if (v === undefined || v === null || v === '') return;
			url.searchParams.append(k, String(v));
		});
	}
	const h = { ...headers };
	if (auth) {
		const token = getToken();
		if (token) h['Authorization'] = `Bearer ${token}`;
	}
	if (json && body && !(body instanceof FormData)) {
		h['Content-Type'] = 'application/json';
		body = JSON.stringify(body);
	}
	const res = await fetch(url.toString(), { method, headers: h, body });
	if (!res.ok) {
		const data = await parseBody(res);
		const err = { status: res.status, data };
		if (res.status === 401) {
			err.unauthorized = true;
			if (redirectOn401) {
				try {
					localStorage.removeItem('auth:token');
					localStorage.removeItem('auth:user');
				} catch {}
				if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
					window.location.assign('/login');
				}
			}
		}
		throw err;
	}
	// try parse json, else return text/null
	return parseBody(res);
}

// Auth
export async function loginApi({ username, password }) {
	return request('/auth/login', { method: 'POST', json: true, body: { username, password }, auth: false });
}

export async function meApi() {
	return request('/auth/me', { method: 'GET' });
}

// Rooms
export async function getRooms() {
	// 公共浏览：不要求鉴权，401 不跳转
	const data = await request('/rooms', { auth: false, redirectOn401: false });
	if (!Array.isArray(data)) return [];
	return data
		.map(normalizeRoom)
		.filter((room) => room && typeof room === 'object');
}

export async function getRoomById(id) {
	// 公共浏览
	const data = await request(`/rooms/${id}`, { auth: false, redirectOn401: false });
	const normalized = normalizeRoom(data);
	return normalized && typeof normalized === 'object' ? normalized : null;
}

export async function adjustRoomTotalCount(id, totalCount) {
	return request(`/rooms/${id}/adjust`, { method: 'PUT', query: { totalCount } });
}

export async function getRoomAvailability(id, { start, end }) {
	// 公共浏览
	const data = await request(`/rooms/${id}/availability`, { query: { start, end }, auth: false, redirectOn401: false });
	if (data && typeof data === 'object') {
		const availableCount = Number(data.availableCount);
		return {
			...data,
			available: toBoolean(data.available),
			availableCount: Number.isNaN(availableCount) ? data.availableCount : availableCount
		};
	}
	return data;
}

export async function createBooking({ roomId, userId, start, end, guests, contactName, contactPhone, remark, hotelId }) {
	// backend accepts form/query; we pass as query for simplicity
	const q = { start, end };
	if (userId) q.userId = userId;
	if (guests != null) q.guests = guests;
	if (contactName) q.contactName = contactName;
	if (contactPhone) q.contactPhone = contactPhone;
	if (remark) q.remark = remark;
	if (hotelId) q.hotelId = hotelId;
	return request(`/rooms/${roomId}/book`, { method: 'POST', query: q });
}

// Admin booking ops
export async function confirmBooking(bookingId) {
	const data = await request(`/bookings/${bookingId}/confirm`, { method: 'PUT' });
	return normalizeBooking(data);
}

export async function checkoutBooking(bookingId) {
	const data = await request(`/bookings/${bookingId}/checkout`, { method: 'PUT' });
	return normalizeBooking(data);
}

export async function checkinBooking(bookingId) {
	const data = await request(`/bookings/${bookingId}/checkin`, { method: 'PUT' });
	return normalizeBooking(data);
}

export async function rejectBooking(bookingId) {
	const data = await request(`/bookings/${bookingId}/reject`, { method: 'PUT' });
	return normalizeBooking(data);
}

export async function deleteBooking(bookingId) {
	const data = await request(`/bookings/${bookingId}`, { method: 'DELETE' });
	return normalizeBooking(data);
}

// User bookings
export async function getBookingsByUser(userId, { page = 1, size = 10, status } = {}) {
	const data = await request(`/users/${userId}/bookings`, { query: { page, size, status } });
	return normalizePageResponse(data, normalizeBooking);
}

export async function cancelBooking(bookingId) {
	const data = await request(`/bookings/${bookingId}/cancel`, { method: 'PUT' });
	return normalizeBooking(data);
}

export function getImageList(images) {
	if (!images) return [];
	if (Array.isArray(images)) return images.filter(Boolean);
	if (typeof images !== 'string') return [];
	return images.split(',').map(s => s.trim()).filter(Boolean);
}

// Admin: list bookings with filters
export async function adminListBookings({ page = 1, size = 10, status, userId, roomTypeId, roomId, hotelId, contactPhone, start, end } = {}) {
	const query = { page, size, status, userId, roomTypeId, roomId, hotelId, contactPhone, start, end };
	const data = await request('/bookings', { query });
	const normalized = normalizePageResponse(data, normalizeBooking);
	if (Array.isArray(normalized)) {
		return { items: normalized, page, size, total: normalized.length };
	}
	return normalized;
}

export async function getBookingDetail(id) {
	const data = await request(`/bookings/${id}`);
	return normalizeBooking(data);
}

export async function rescheduleBooking(id, { start, end }) {
	const data = await request(`/bookings/${id}/reschedule`, { method: 'PUT', query: { start, end } });
	return normalizeBooking(data);
}

export async function fetchVacancyAnalytics({ roomTypeIds = [], start, end, granularity, thresholdHigh, thresholdLow, forecastDays } = {}) {
	const query = {};
	if (Array.isArray(roomTypeIds) && roomTypeIds.length) {
		query.roomTypeIds = roomTypeIds.join(',');
	}
	if (start) query.start = start;
	if (end) query.end = end;
	if (granularity) query.granularity = granularity;
	if (thresholdHigh != null) query.thresholdHigh = thresholdHigh;
	if (thresholdLow != null) query.thresholdLow = thresholdLow;
	if (forecastDays != null) query.forecastDays = forecastDays;
	return request('/analytics/vacancy', { query });
}

// Hotel info
export async function getPrimaryHotel() {
	const data = await request('/hotel/primary', { auth: false, redirectOn401: false });
	return normalizeHotel(data);
}

export async function getHotelById(id) {
	const data = await request(`/hotel/${id}`, { auth: false, redirectOn401: false });
	return normalizeHotel(data);
}
