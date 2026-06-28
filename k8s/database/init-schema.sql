-- ============================================================================
-- Task Management System - Complete Database Schema
-- ============================================================================
-- This is the single source of truth for the database schema
-- Safe to run multiple times - includes idempotency checks
-- ============================================================================

CREATE DATABASE IF NOT EXISTS task_management;
USE task_management;

-- Start transaction
START TRANSACTION;

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Users table with soft delete support
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    keycloak_user_id VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    global_role ENUM('admin', 'manager', 'member', 'viewer') DEFAULT 'member',
    avatar_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    deleted_by INT NULL DEFAULT NULL,
    INDEX idx_keycloak_user_id (keycloak_user_id),
    INDEX idx_global_role (global_role),
    INDEX idx_email (email),
    INDEX idx_deleted_at (deleted_at),
    INDEX idx_active_users (is_active, deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add foreign key for deleted_by after users table exists
ALTER TABLE users 
ADD CONSTRAINT fk_users_deleted_by 
FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL;

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#2196F3',
    created_by INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_created_by (created_by),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Team members table (note: 'leader' not 'manager' for team role)
CREATE TABLE IF NOT EXISTS team_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    team_id INT NOT NULL,
    user_id INT NOT NULL,
    team_role ENUM('leader', 'member', 'viewer') NOT NULL,
    added_by INT NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE RESTRICT,
    UNIQUE KEY unique_team_user (team_id, user_id),
    INDEX idx_team_id (team_id),
    INDEX idx_user_id (user_id),
    INDEX idx_team_role (team_role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status ENUM('todo', 'in-progress', 'done') DEFAULT 'todo',
    priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
    team_id INT NOT NULL,
    assigned_to INT,
    created_by INT NOT NULL,
    due_date DATE,
    estimated_hours DECIMAL(5,2) DEFAULT 0.00,
    actual_hours DECIMAL(5,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_team_id (team_id),
    INDEX idx_assigned_to (assigned_to),
    INDEX idx_status (status),
    INDEX idx_priority (priority),
    INDEX idx_due_date (due_date),
    INDEX idx_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Task comments table
CREATE TABLE IF NOT EXISTS task_comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL,
    user_id INT NOT NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_task_id (task_id),
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Task attachments table
CREATE TABLE IF NOT EXISTS task_attachments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL,
    uploaded_by INT NOT NULL,
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INT,
    mime_type VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_task_id (task_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- AUDIT & LOGGING TABLES
-- ============================================================================

-- Audit logs for tracking all system operations
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id INT,
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_resource_type (resource_type),
    INDEX idx_resource_id (resource_id),
    INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Authentication logs for tracking auth events
CREATE TABLE IF NOT EXISTS authentication_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    username VARCHAR(100),
    action VARCHAR(50) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_username (username),
    INDEX idx_action (action),
    INDEX idx_success (success),
    INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- System events for general system tracking
CREATE TABLE IF NOT EXISTS system_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    description TEXT,
    severity ENUM('info', 'warning', 'error', 'critical') DEFAULT 'info',
    metadata JSON,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_event_type (event_type),
    INDEX idx_severity (severity),
    INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User operations log for bulk operations
CREATE TABLE IF NOT EXISTS user_operations_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    operation_type ENUM('import', 'export', 'delete', 'bulk_delete') NOT NULL,
    admin_user_id INT NOT NULL,
    affected_users_count INT DEFAULT 0,
    successful_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    file_name VARCHAR(255) NULL,
    file_size INT NULL,
    status ENUM('in_progress', 'completed', 'failed', 'partial') NOT NULL DEFAULT 'in_progress',
    error_details JSON NULL,
    operation_details JSON NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    duration_seconds INT NULL,
    FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_operation_type (operation_type),
    INDEX idx_admin_user_id (admin_user_id),
    INDEX idx_status (status),
    INDEX idx_started_at (started_at),
    INDEX idx_completed_at (completed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User deletion log for detailed deletion tracking
CREATE TABLE IF NOT EXISTS user_deletion_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    operation_log_id INT NULL,
    deleted_user_id INT NOT NULL,
    deleted_username VARCHAR(100) NOT NULL,
    deleted_email VARCHAR(255) NOT NULL,
    deleted_full_name VARCHAR(255),
    deleted_global_role ENUM('admin', 'manager', 'member', 'viewer') NOT NULL,
    keycloak_user_id VARCHAR(255) NOT NULL,
    admin_user_id INT NOT NULL,
    deletion_reason TEXT NULL,
    tasks_reassigned_count INT DEFAULT 0,
    tasks_unassigned_count INT DEFAULT 0,
    team_memberships_removed INT DEFAULT 0,
    keycloak_deletion_success BOOLEAN DEFAULT FALSE,
    sessions_revoked_count INT DEFAULT 0,
    deletion_status ENUM('pending', 'completed', 'failed', 'partial') DEFAULT 'pending',
    error_message TEXT NULL,
    deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (operation_log_id) REFERENCES user_operations_log(id) ON DELETE SET NULL,
    FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_operation_log_id (operation_log_id),
    INDEX idx_deleted_user_id (deleted_user_id),
    INDEX idx_deleted_username (deleted_username),
    INDEX idx_admin_user_id (admin_user_id),
    INDEX idx_deletion_status (deletion_status),
    INDEX idx_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- VIEWS FOR EFFICIENT QUERIES
-- ============================================================================

-- Active users view (commonly used)
CREATE OR REPLACE VIEW active_users AS
SELECT 
    id,
    keycloak_user_id,
    username,
    email,
    full_name,
    global_role,
    avatar_url,
    is_active,
    created_at,
    updated_at
FROM users 
WHERE is_active = TRUE AND deleted_at IS NULL;

-- Deleted users view (for audit)
CREATE OR REPLACE VIEW deleted_users AS
SELECT 
    u.id,
    u.keycloak_user_id,
    u.username,
    u.email,
    u.full_name,
    u.global_role,
    u.avatar_url,
    u.is_active,
    u.created_at,
    u.updated_at,
    u.deleted_at,
    u.deleted_by,
    deleter.username as deleted_by_username,
    deleter.full_name as deleted_by_name
FROM users u
LEFT JOIN users deleter ON u.deleted_by = deleter.id
WHERE u.deleted_at IS NOT NULL;

-- User team roles view
CREATE OR REPLACE VIEW user_team_roles AS
SELECT 
    u.id as user_id,
    u.username,
    u.email,
    u.full_name,
    u.global_role,
    t.id as team_id,
    t.name as team_name,
    tm.team_role,
    tm.added_at
FROM users u
LEFT JOIN team_members tm ON u.id = tm.user_id
LEFT JOIN teams t ON tm.team_id = t.id
WHERE u.is_active = TRUE 
  AND u.deleted_at IS NULL 
  AND (t.is_active = TRUE OR t.id IS NULL);

-- Task details view
CREATE OR REPLACE VIEW task_details AS
SELECT 
    t.id,
    t.title,
    t.description,
    t.status,
    t.priority,
    t.due_date,
    t.estimated_hours,
    t.actual_hours,
    team.name as team_name,
    team.color as team_color,
    CASE 
      WHEN assigned.deleted_at IS NOT NULL THEN CONCAT(assigned.username, ' (deleted)')
      ELSE assigned.username 
    END as assigned_to_username,
    CASE 
      WHEN assigned.deleted_at IS NOT NULL THEN CONCAT(assigned.full_name, ' (deleted)')
      ELSE assigned.full_name 
    END as assigned_to_name,
    CASE 
      WHEN creator.deleted_at IS NOT NULL THEN CONCAT(creator.username, ' (deleted)')
      ELSE creator.username 
    END as created_by_username,
    CASE 
      WHEN creator.deleted_at IS NOT NULL THEN CONCAT(creator.full_name, ' (deleted)')
      ELSE creator.full_name 
    END as created_by_name,
    t.created_at,
    t.updated_at,
    t.completed_at
FROM tasks t
JOIN teams team ON t.team_id = team.id
LEFT JOIN users assigned ON t.assigned_to = assigned.id
JOIN users creator ON t.created_by = creator.id
WHERE team.is_active = TRUE;

-- Comprehensive audit trail view
CREATE OR REPLACE VIEW audit_trail AS
SELECT 
    'operation' as log_type,
    al.id,
    al.user_id,
    u.username,
    u.full_name,
    al.action,
    al.resource_type,
    al.resource_id,
    al.old_values,
    al.new_values,
    al.ip_address,
    al.user_agent,
    al.timestamp,
    NULL as success,
    NULL as error_message,
    NULL as severity
FROM audit_logs al
LEFT JOIN users u ON al.user_id = u.id

UNION ALL

SELECT 
    'authentication' as log_type,
    auth.id,
    auth.user_id,
    auth.username,
    u.full_name,
    auth.action,
    'authentication' as resource_type,
    NULL as resource_id,
    NULL as old_values,
    NULL as new_values,
    auth.ip_address,
    auth.user_agent,
    auth.timestamp,
    auth.success,
    auth.error_message,
    NULL as severity
FROM authentication_logs auth
LEFT JOIN users u ON auth.user_id = u.id

UNION ALL

SELECT 
    'system' as log_type,
    se.id,
    NULL as user_id,
    'system' as username,
    'System Event' as full_name,
    se.event_type as action,
    'system' as resource_type,
    NULL as resource_id,
    NULL as old_values,
    se.metadata as new_values,
    NULL as ip_address,
    NULL as user_agent,
    se.timestamp,
    NULL as success,
    se.description as error_message,
    se.severity
FROM system_events se

ORDER BY timestamp DESC;

-- User operations statistics view
CREATE OR REPLACE VIEW user_operations_stats AS
SELECT 
    DATE(started_at) as operation_date,
    operation_type,
    COUNT(*) as total_operations,
    SUM(affected_users_count) as total_users_affected,
    SUM(successful_count) as total_successful,
    SUM(failed_count) as total_failed,
    AVG(duration_seconds) as avg_duration_seconds,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_operations,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_operations,
    COUNT(CASE WHEN status = 'partial' THEN 1 END) as partial_operations
FROM user_operations_log
GROUP BY DATE(started_at), operation_type
ORDER BY operation_date DESC, operation_type;

-- Recent user operations view (last 30 days)
CREATE OR REPLACE VIEW recent_user_operations AS
SELECT 
    uol.id,
    uol.operation_type,
    uol.affected_users_count,
    uol.successful_count,
    uol.failed_count,
    uol.file_name,
    uol.status,
    uol.started_at,
    uol.completed_at,
    uol.duration_seconds,
    admin.username as admin_username,
    admin.full_name as admin_full_name
FROM user_operations_log uol
JOIN users admin ON uol.admin_user_id = admin.id
WHERE uol.started_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
ORDER BY uol.started_at DESC;

-- Commit the transaction
COMMIT;

SELECT 'Database schema initialized successfully!' as result;
