USE railway;

-- 1. UserCredentials
CREATE TABLE IF NOT EXISTS UserCredentials (
  user_id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('user', 'admin') DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. UserProfile
CREATE TABLE IF NOT EXISTS UserProfile (
  profile_id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  preferences TEXT,
  FOREIGN KEY (user_id) REFERENCES UserCredentials(user_id)
);

-- 3. Service
CREATE TABLE IF NOT EXISTS Service (
  service_id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  expected_duration INT NOT NULL,
  priority ENUM('low', 'medium', 'high') DEFAULT 'medium'
);

-- 4. Queue
CREATE TABLE IF NOT EXISTS Queue (
  queue_id VARCHAR(36) PRIMARY KEY,
  service_id VARCHAR(36) NOT NULL,
  status ENUM('open', 'closed') DEFAULT 'open',
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (service_id) REFERENCES Service(service_id)
);

-- 5. QueueEntry
CREATE TABLE IF NOT EXISTS QueueEntry (
  entry_id VARCHAR(36) PRIMARY KEY,
  queue_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  position INT NOT NULL,
  join_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('waiting', 'served', 'cancelled') DEFAULT 'waiting',
  FOREIGN KEY (queue_id) REFERENCES Queue(queue_id),
  FOREIGN KEY (user_id) REFERENCES UserCredentials(user_id)
);

-- 6. Notification
CREATE TABLE IF NOT EXISTS Notification (
  notification_id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  message TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('sent', 'viewed') DEFAULT 'sent',
  FOREIGN KEY (user_id) REFERENCES UserCredentials(user_id)
);