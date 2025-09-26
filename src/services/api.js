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
	return request('/rooms', { auth: false, redirectOn401: false });
}

export async function getRoomById(id) {
	// 公共浏览
	return request(`/rooms/${id}`, { auth: false, redirectOn401: false });
}

export async function adjustRoomTotalCount(id, totalCount) {
	return request(`/rooms/${id}/adjust`, { method: 'PUT', query: { totalCount } });
}

export async function getRoomAvailability(id, { start, end }) {
	// 公共浏览
	return request(`/rooms/${id}/availability`, { query: { start, end }, auth: false, redirectOn401: false });
}

export async function createBooking({ roomId, userId, start, end }) {
	// backend accepts form/query; we pass as query for simplicity
	const q = { start, end };
	if (userId) q.userId = userId;
	return request(`/rooms/${roomId}/book`, { method: 'POST', query: q });
}

// Admin booking ops
export async function confirmBooking(bookingId) {
	return request(`/rooms/bookings/${bookingId}/confirm`, { method: 'PUT' });
}

export async function checkoutBooking(bookingId) {
	return request(`/rooms/bookings/${bookingId}/checkout`, { method: 'PUT' });
}

// User bookings
export async function getBookingsByUser(userId, { page = 1, size = 10, status } = {}) {
	return request(`/users/${userId}/bookings`, { query: { page, size, status } });
}

export async function cancelBooking(bookingId) {
	return request(`/bookings/${bookingId}/cancel`, { method: 'PUT' });
}

export function getImageList(images) {
	if (!images) return [];
	return images.split(',').map(s => s.trim()).filter(Boolean);
}

// Admin: list bookings with filters
export async function adminListBookings({ page = 1, size = 10, status, userId, roomId, start, end } = {}) {
	const query = { page, size, status, userId, roomId, start, end };
	return request('/bookings', { query });
}
