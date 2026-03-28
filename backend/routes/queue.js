const express = require('express');
const store = require('../store');

const router = express.Router();

const PRIORITY_WEIGHTS = { high: 30, medium: 15, low: 0 };
const AGING_FACTOR = 1;

function addNotif(notification) {
	store.notifications.unshift({
		id: `n${Date.now()}${Math.random()}`,
		read: false,
		...notification,
	});
}

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

// POST /api/queue/join
router.post('/api/queue/join', (req, res) => {
	const { serviceId, userId, userName: bodyUserName, priority } = req.body;

	if (!serviceId || !userId) {
		return res.status(400).json({ error: 'serviceId and userId are required' });
	}

	const svc = store.services.find((s) => s.id === serviceId);
	if (svc && !svc.open) {
		return res.status(400).json({ error: 'This service is currently closed' });
	}

	if (!store.queue[serviceId]) store.queue[serviceId] = [];

	const alreadyInQueue = store.queue[serviceId].some(
		(e) => (typeof e === 'string' ? e : e.userId) === userId
	);
	if (alreadyInQueue) {
		return res.status(200).json({ success: true, message: 'User already in queue' });
	}

	const user = store.users.find((u) => u.id === userId);
	const entry = {
		userId,
		userName: bodyUserName || user?.name || userId,
		priority: priority || svc?.priority || 'low',
		joinedAt: new Date().toISOString(),
	};

	store.queue[serviceId].push(entry);
	addNotif({
		type: 'joined',
		message: `You joined ${svc?.name || serviceId} queue (${entry.priority} priority)`,
	});

	return res.status(201).json({ success: true, entry });
});

// DELETE /api/queue/leave
router.delete('/api/queue/leave', (req, res) => {
	const serviceId = req.body?.serviceId || req.query?.serviceId;
	const userId = req.body?.userId || req.query?.userId;

	if (!serviceId || !userId) {
		return res.status(400).json({ error: 'serviceId and userId are required' });
	}

	if (!store.queue[serviceId]) {
		return res.status(200).json({ success: true });
	}

	const svc = store.services.find((s) => s.id === serviceId);
	store.queue[serviceId] = store.queue[serviceId].filter(
		(e) => (typeof e === 'string' ? e : e.userId) !== userId
	);

	addNotif({
		type: 'left',
		message: `You left ${svc?.name || serviceId} queue`,
	});

	return res.status(200).json({ success: true });
});

// GET /api/queue/status?userId=...
router.get('/api/queue/status', (req, res) => {
	const { userId } = req.query;
	if (!userId) {
		return res.status(400).json({ error: 'userId is required' });
	}

	for (const serviceId of Object.keys(store.queue)) {
		const sorted = getSortedQueue(serviceId);
		const idx = sorted.findIndex((e) => e.userId === userId);

		if (idx >= 0) {
			const entry = sorted[idx];
			const svc = store.services.find((s) => s.id === serviceId);
			return res.status(200).json({
				serviceId,
				serviceName: svc?.name || serviceId,
				position: idx + 1,
				total: sorted.length,
				priority: entry.priority,
				joinedAt: entry.joinedAt,
				score: calcEffectiveScore(entry).toFixed(1),
				expectedWait: idx * (svc?.expected || 10),
			});
		}
	}

	return res.status(200).json(null);
});

// GET /api/history?userId=...
router.get('/api/history', (req, res) => {
	const { userId } = req.query;
	if (!userId) {
		return res.status(400).json({ error: 'userId is required' });
	}

	const history = store.history.filter((h) => h.userId === userId);
	return res.status(200).json(history);
});

module.exports = router;
