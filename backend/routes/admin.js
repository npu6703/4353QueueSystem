const express = require('express');
const store = require('../store');

const router = express.Router();

const PRIORITY_WEIGHTS = { high: 30, medium: 15, low: 0 };
const AGING_FACTOR = 1;

function calcEffectiveScore(entry) {
	const waited = (Date.now() - new Date(entry.joinedAt).getTime()) / 60000;
	return PRIORITY_WEIGHTS[entry.priority] + waited * AGING_FACTOR;
}

function getQueueForService(serviceId) {
	if (!store.queue[serviceId]) store.queue[serviceId] = [];
	return store.queue[serviceId].map((entry) => {
		if (typeof entry === 'string') {
			return {
				userId: entry,
				userName: entry,
				priority: 'low',
				joinedAt: new Date().toISOString(),
			};
		}
		return entry;
	});
}

function getSortedQueue(serviceId) {
	const entries = getQueueForService(serviceId);
	return [...entries].sort((a, b) => {
		const scoreA = calcEffectiveScore(a);
		const scoreB = calcEffectiveScore(b);
		if (scoreB !== scoreA) return scoreB - scoreA;
		return new Date(a.joinedAt) - new Date(b.joinedAt);
	});
}

// GET /api/admin/stats
// Mirrors AdminDashboard stats calculations from the frontend.
router.get('/api/admin/stats', (_req, res) => {
	const services = store.services;
	const history = store.history;

	const totalInQueue = services.reduce((sum, s) => sum + getSortedQueue(s.id).length, 0);
	const openCount = services.filter((s) => s.open).length;
	const closedCount = services.length - openCount;

	const todayServed = history.filter((h) => {
		const d = new Date(h.date);
		const now = new Date();
		return d.toDateString() === now.toDateString();
	}).length;

	return res.status(200).json({
		totalServices: services.length,
		openCount,
		closedCount,
		totalInQueue,
		todayServed,
	});
});

// GET /api/notifications
// Same behavior as getNotifications() in localApi.js.
router.get('/api/notifications', (_req, res) => {
	return res.status(200).json(store.notifications);
});

// PUT /api/notifications/read
// Same behavior as markNotifsRead() in localApi.js.
router.put('/api/notifications/read', (_req, res) => {
	store.notifications.forEach((n) => {
		n.read = true;
	});

	return res.status(200).json({ success: true });
});

module.exports = router;
