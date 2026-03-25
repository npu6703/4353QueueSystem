// In-memory store used while the backend server is running.
// TODO: Replace these hardcoded mock values with real data sources
// once the services/users backend integration is finished.
const store = {
	users: [
		{
			id: 'admin1',
			email: 'admin@queue.com',
			password: 'admin123',
			name: 'Admin',
			isAdmin: true,
		},
		{
			id: 'user1',
			email: 'user@queue.com',
			password: 'user123',
			name: 'John Doe',
			isAdmin: false,
		},
	],
	services: [
		{
			id: 's1',
			name: 'Dine-in',
			description: 'Table service',
			expected: 30,
			priority: 'medium',
			open: true,
		},
		{
			id: 's2',
			name: 'Takeaway',
			description: 'Quick pickup',
			expected: 10,
			priority: 'low',
			open: true,
		},
	],
	queue: {},
	history: [],
	notifications: [],
};

module.exports = store;