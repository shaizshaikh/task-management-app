# Prismex

A professional team and workforce management platform with role-based access control (RBAC), real-time collaboration, comprehensive audit logging, and enterprise-grade accessibility features.

## Project Status: Production Ready

Prismex is a fully functional platform for managing users, teams, permissions, tasks, and collaboration with complete RBAC implementation, administrative features, and WCAG 2.2 Level AA accessibility compliance.

## Core Features

### Authentication & Security
- Keycloak integration with OAuth 2.0 / OpenID Connect
- JWT token-based authentication
- Role-based access control with granular permissions
- Secure password management with temporary password support
- Session management and token validation

### User Management
- Complete user lifecycle management
- Bulk user import/export (CSV and Excel formats)
- User soft delete with restoration capabilities
- Keycloak synchronization
- User profile management
- Import history tracking with detailed audit logs

### Team Management
- Multi-team support with flexible member assignments
- Team-specific roles (Leader, Member, Viewer)
- Team creation and deletion (Admin/Manager only)
- Member management with role updates
- Team-based task organization
- Shared component architecture for consistent UX

### Task Management
- Create, assign, and track tasks
- Task status workflow (To Do, In Progress, Done)
- Priority levels (Low, Medium, High)
- Due date tracking with overdue indicators
- Task attachments and file uploads
- Task comments and collaboration
- Team-filtered task assignment
- Real-time task updates

### Real-time Collaboration
- WebSocket-powered live updates
- RBAC-aware real-time notifications
- Task creation/update/deletion broadcasts
- Comment notifications
- Connection status monitoring
- Automatic reconnection handling

### Administrative Features
- System-wide dashboard with statistics
- User management panel with pagination
- Audit log viewer with filtering
- Team management interface
- Role management and assignment
- System health monitoring

### Manager Panel
- Team-specific dashboard and analytics
- Task management for managed teams
- Team member oversight
- Performance metrics
- Filtered views based on team leadership

### Audit & Compliance
- Comprehensive activity tracking
- User action logging
- Authentication event logging
- System event monitoring
- Audit log filtering and search
- Compliance reporting capabilities

## Technology Stack

### Frontend
- React 19 with modern hooks
- React Router v6 for navigation
- Axios for HTTP requests
- Socket.IO Client for real-time features
- React Toastify for notifications
- Keycloak JavaScript adapter
- WCAG 2.2 compliant components

### Backend
- Node.js with Express framework
- Socket.IO for WebSocket connections
- MySQL2 with connection pooling
- JWT token validation
- Keycloak Admin Client
- Multer for file uploads
- CORS protection
- Comprehensive middleware stack

### Database
- MySQL 8.0
- RBAC schema with team-based permissions
- Audit logging tables
- Soft delete implementation
- Optimized indexes for performance

### Authentication
- Keycloak 23.0
- OAuth 2.0 / OpenID Connect
- JWT token management
- Role mapping and synchronization
- Realm configuration

### Infrastructure
- Docker containerization
- Docker Compose orchestration
- Nginx reverse proxy
- Multi-stage builds for optimization
- Kubernetes deployment ready

## Architecture Overview

### System Components

```
Frontend (React)          Backend (Node.js)        Database (MySQL)
Port: 3000                Port: 5000               Port: 3306
     |                         |                         |
     +-------------------------+-------------------------+
                               |
                    Nginx Reverse Proxy
                         Port: 8080
                               |
                         Keycloak Auth
                         Port: 8081
```

### Network Architecture
- Bridge network for container isolation
- Single entry point through reverse proxy
- Internal service discovery via Docker DNS
- Secure inter-service communication

### Security Model
- Defense in depth architecture
- Minimal attack surface (single exposed port)
- Network segmentation
- JWT token validation
- SQL injection prevention
- File upload validation
- CORS protection

## Quick Start Guide

### Prerequisites
- Docker and Docker Compose installed
- Git for repository cloning
- 4GB RAM minimum
- 10GB disk space

### Installation Steps

1. Clone the repository
```bash
git clone <repository-url>
cd task-management-app
```

2. Configure environment variables
```bash
# Windows
setup-env.bat

# Linux/Mac
chmod +x setup-env.sh
./setup-env.sh

# Or manually
cp .env.example .env
# Edit .env with your configuration
```

3. Update critical settings in .env
- Database passwords
- SMTP configuration for email
- Keycloak admin credentials
- CORS origins for production

4. Start all services
```bash
# Windows
start-with-keycloak.bat

# Linux/Mac
./start-with-keycloak.sh

# Or manually
docker-compose up -d
```

5. Access the application
- Application: http://localhost:8080
- Keycloak Admin: http://localhost:8081
- Default admin credentials: admin/admin123

### Network Access
The application automatically works on your local network:
1. Find your machine's IP address
   - Windows: `ipconfig`
   - Linux/Mac: `ip addr` or `ifconfig`
2. Access from any device: `http://YOUR_IP:8080`
3. Keycloak automatically uses the same IP

### Initial Setup
The startup script automatically:
- Configures Keycloak realm and client
- Sets up database schema with RBAC
- Creates initial admin user
- Configures role mappings

## Project Structure

```
task-management-app/
├── frontend/                    # React application
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   │   ├── admin/         # Admin-specific components
│   │   │   ├── manager/       # Manager-specific components
│   │   │   └── layout/        # Layout components (Sidebar, TopBar)
│   │   ├── pages/             # Page components
│   │   ├── contexts/          # React contexts (Auth, etc.)
│   │   ├── hooks/             # Custom React hooks
│   │   ├── services/          # API service layer
│   │   ├── styles/            # Global styles and themes
│   │   ├── utils/             # Utility functions
│   │   └── config/            # Configuration files
│   ├── public/                # Static assets
│   ├── Dockerfile             # Multi-stage build
│   └── package.json
├── backend/                    # Node.js API server
│   ├── routes/                # API route handlers
│   │   ├── auth.js           # Authentication routes
│   │   ├── tasks.js          # Task management
│   │   ├── teams.js          # Team management
│   │   ├── users.js          # User management
│   │   └── audit.js          # Audit logging
│   ├── middleware/            # Express middleware
│   │   ├── auth.js           # JWT authentication
│   │   ├── rbac.js           # Role-based access control
│   │   ├── audit.js          # Audit logging
│   │   └── fileUpload.js     # File upload handling
│   ├── services/              # Business logic services
│   │   ├── taskService.js    # Task operations
│   │   ├── emailService.js   # Email notifications
│   │   ├── keycloakAdmin.js  # Keycloak integration
│   │   ├── realtimeService.js # WebSocket management
│   │   └── userSync.js       # User synchronization
│   ├── utils/                 # Utility functions
│   │   ├── permissions.js    # Permission helpers
│   │   ├── fileCleanup.js    # File management
│   │   └── userUtils.js      # User utilities
│   ├── config/                # Configuration
│   │   └── keycloak.js       # Keycloak config
│   ├── uploads/               # File storage
│   ├── server.js              # Application entry point
│   ├── database.js            # Database connection
│   └── routes.js              # Route registration
├── database/                   # Database schemas
│   ├── init-schema.sql        # Initial schema
│   ├── rbac-schema.sql        # RBAC tables
│   └── audit-schema.sql       # Audit logging
├── nginx/                      # Reverse proxy config
│   ├── myapp.conf             # Development config
│   └── production.conf        # Production config
├── k8s/                        # Kubernetes manifests
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── secrets.yaml
│   ├── ingress.yaml
│   ├── frontend/              # Frontend deployment
│   ├── backend/               # Backend deployment
│   ├── database/              # Database deployment
│   ├── keycloak/              # Keycloak deployment
│   ├── nginx/                 # Nginx deployment
│   └── argocd/                # ArgoCD configuration
├── docker-compose.yml          # Multi-service orchestration
├── realm-export.json           # Keycloak realm config
└── .env.example                # Environment template
```

## Role-Based Access Control

### Role Hierarchy

1. **Admin**
   - Full system access
   - User management (create, edit, delete, restore)
   - Team management (create, edit, delete)
   - Audit log access
   - System configuration
   - All manager and member permissions

2. **Manager**
   - Team management (create, edit, view)
   - Task management across all teams
   - Team member management
   - Limited audit log access
   - Dashboard analytics
   - All member permissions

3. **Member**
   - Task creation and editing within assigned teams
   - Task viewing and updates
   - Comment on tasks
   - Upload attachments
   - View team information

4. **Viewer**
   - Read-only access to assigned teams
   - View tasks and comments
   - No creation or editing permissions

### Permission System

**Team-based Permissions:**
- Users belong to teams with specific roles
- Team roles: Leader, Member, Viewer
- Team leaders can manage team members
- Hierarchical permission inheritance

**Resource-level Permissions:**
- Granular permissions on tasks
- Comment access control
- Attachment permissions
- Audit trail for all actions

**Global vs Team Roles:**
- Global role: System-wide permissions (Admin, Manager, Member, Viewer)
- Team role: Team-specific permissions (Leader, Member, Viewer)
- Combined evaluation for access decisions

## Docker Configuration

### Multi-Stage Builds

**Frontend Dockerfile:**
- Stage 1: Node.js build environment (npm install, npm run build)
- Stage 2: Nginx serving static files
- Size reduction: 487MB to 81MB (83% smaller)
- No Node.js or npm in production image
- Security: Minimal attack surface

**Backend Dockerfile:**
- Production-optimized Node.js image
- Non-root user execution
- Health check endpoint
- Optimized layer caching

### Container Architecture

**Services:**
- frontend: React app served by Nginx (port 80)
- backend: Node.js API server (port 5000)
- database: MySQL 8.0 (port 3306)
- keycloak: Authentication server (port 8080)
- nginx: Reverse proxy (port 8080 exposed)

**Network:**
- Bridge network: app-network
- Internal DNS resolution
- Service discovery by name
- Isolated from host network

**Volumes:**
- mysql_data: Database persistence
- uploads: File attachment storage
- Configuration bind mounts

### Nginx Reverse Proxy

**Routing Configuration:**
- `/` - Frontend React application
- `/api` - Backend API endpoints
- `/socket.io/` - WebSocket connections

**Features:**
- WebSocket upgrade support
- Client IP preservation (X-Real-IP, X-Forwarded-For)
- Request timeout configuration
- Gzip compression
- Static asset caching

## Kubernetes Deployment

### Cluster Architecture

**Namespaces:**
- task-management: Application namespace
- Isolated resource management
- Network policies

**Deployments:**
- Frontend: 2 replicas, rolling updates
- Backend: 3 replicas, auto-scaling ready
- Database: StatefulSet with persistent volume
- Keycloak: 1 replica with persistent storage
- Nginx: 2 replicas, load balancing

**Services:**
- ClusterIP for internal communication
- LoadBalancer for external access
- Service discovery via DNS

**ConfigMaps & Secrets:**
- Environment configuration
- Database credentials
- Keycloak settings
- SSL certificates

**Ingress:**
- HTTPS termination
- Path-based routing
- SSL certificate management
- Rate limiting

### ArgoCD GitOps

**Continuous Deployment:**
- Git repository as source of truth
- Automated synchronization
- Rollback capabilities
- Health monitoring
- Deployment history

**Configuration:**
- Application manifests in k8s/argocd/
- Automated sync policy
- Self-healing enabled
- Prune resources on deletion

### Azure Kubernetes Service (AKS)

**Cluster Setup:**
- Managed Kubernetes service
- Auto-scaling node pools
- Azure Container Registry integration
- Azure Active Directory integration
- Network policies

**Infrastructure:**
- Virtual network integration
- Load balancer configuration
- Persistent volume claims
- Backup and disaster recovery

## Docker Hub Integration

### Image Registry

**Published Images:**
- Frontend: `<username>/task-management-frontend:latest`
- Backend: `<username>/task-management-backend:latest`
- Tagged versions for releases

**Build and Push:**
```bash
# Build images
docker-compose build

# Tag images
docker tag task-management-app-frontend <username>/task-management-frontend:latest
docker tag task-management-app-backend <username>/task-management-backend:latest

# Push to Docker Hub
docker push <username>/task-management-frontend:latest
docker push <username>/task-management-backend:latest
```

**Automated Builds:**
- GitHub Actions integration
- Automated testing
- Multi-architecture builds
- Version tagging

## SSL/TLS Configuration

### Development Environment

**Self-Signed Certificates:**
```bash
# Generate certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/nginx.key \
  -out nginx/ssl/nginx.crt
```

**Nginx SSL Configuration:**
```nginx
server {
    listen 443 ssl;
    ssl_certificate /etc/nginx/ssl/nginx.crt;
    ssl_certificate_key /etc/nginx/ssl/nginx.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
}
```

### Production Environment

**Let's Encrypt Integration:**
- Certbot for certificate management
- Automatic renewal
- ACME challenge handling
- Certificate monitoring

**SSL Best Practices:**
- TLS 1.2 and 1.3 only
- Strong cipher suites
- HSTS headers
- Certificate pinning
- OCSP stapling

**Kubernetes Ingress SSL:**
- cert-manager for automation
- Let's Encrypt ClusterIssuer
- Automatic certificate renewal
- Secret management

## API Documentation

### Authentication Endpoints

**POST /api/auth/login**
- Keycloak token exchange
- Returns JWT access token
- User profile information

**GET /api/auth/profile**
- Current user profile
- Role information
- Team memberships
- Permissions

**POST /api/auth/logout**
- Token invalidation
- Session cleanup

### Task Endpoints

**GET /api/tasks**
- List tasks with RBAC filtering
- Query parameters: team_id, status, priority
- Pagination support

**POST /api/tasks**
- Create new task
- Requires team_id
- Permission validation

**PUT /api/tasks/:id**
- Update task details
- RBAC permission check
- Audit logging

**DELETE /api/tasks/:id**
- Soft delete task
- Permission validation
- Cascade handling

**PUT /api/tasks/:id/status**
- Update task status
- Workflow validation
- Real-time broadcast

### Team Endpoints

**GET /api/teams**
- List user's teams
- Role-based filtering
- Member count

**POST /api/teams**
- Create new team (Admin/Manager only)
- Team configuration
- Initial member assignment

**GET /api/teams/:id/members**
- List team members
- Role information
- User details

**POST /api/teams/:id/members**
- Add team member
- Role assignment
- Permission validation

**DELETE /api/teams/:id/members/:userId**
- Remove team member
- Permission check
- Task reassignment

### User Endpoints

**GET /api/users**
- List users (Admin only)
- Pagination support
- Search and filtering

**POST /api/users**
- Create new user
- Keycloak integration
- Temporary password

**PUT /api/users/:id/role**
- Update user role
- Permission validation
- Audit logging

**DELETE /api/users/:id**
- Soft delete user
- Task reassignment
- Session revocation

**POST /api/users/:id/restore**
- Restore deleted user
- Keycloak reactivation

**POST /api/users/import**
- Bulk user import
- CSV/Excel support
- Validation and error handling

**GET /api/users/export**
- Export users to CSV/Excel
- Filtered export
- Include deleted users option

### Audit Endpoints

**GET /api/audit**
- Audit log retrieval (Admin only)
- Filtering by user, action, date
- Pagination support

**GET /api/audit/stats**
- Audit statistics
- Activity metrics
- Compliance reporting

## Development Guide

### Local Development Setup

**Backend Development:**
```bash
cd backend
npm install
npm run dev:local
```

**Frontend Development:**
```bash
cd frontend
npm install
npm start
```

**Database Setup:**
```bash
mysql -u root -p < database/init-schema.sql
mysql -u root -p < database/rbac-schema.sql
mysql -u root -p < database/audit-schema.sql
```

### Environment Configuration

**Backend .env:**
```
NODE_ENV=development
DB_HOST=localhost
DB_USER=taskuser
DB_PASSWORD=taskpassword123
DB_NAME=task_management
KEYCLOAK_URL=http://localhost:8081
CORS_ORIGIN=http://localhost:3000
```

**Frontend .env:**
```
REACT_APP_API_URL=http://localhost:5000
REACT_APP_KEYCLOAK_URL=http://localhost:8081
REACT_APP_KEYCLOAK_REALM=task-management
REACT_APP_KEYCLOAK_CLIENT_ID=task-management-client
```

### Testing

**Backend Tests:**
```bash
npm test
npm run test:coverage
```

**Frontend Tests:**
```bash
npm test
npm run test:e2e
```

**Integration Tests:**
```bash
npm run test:integration
```

## Performance Optimization

### Frontend Optimizations
- Code splitting and lazy loading
- React.memo for component memoization
- useMemo and useCallback hooks
- Optimized re-renders
- Bundle size optimization
- Image optimization
- Service worker caching

### Backend Optimizations
- Database connection pooling
- Query optimization with indexes
- Caching strategies
- Async/await patterns
- Batch operations
- Rate limiting
- Response compression

### Database Optimizations
- Indexed columns for frequent queries
- Query result caching
- Connection pooling
- Optimized schema design
- Partitioning for large tables
- Regular maintenance tasks

### Network Optimizations
- Gzip compression
- HTTP/2 support
- CDN integration ready
- Asset minification
- Browser caching headers
- WebSocket connection reuse

## Monitoring and Logging

### Application Logging
- Structured logging format
- Log levels: INFO, WARN, ERROR
- Request/response logging
- Error stack traces
- Performance metrics

### Audit Logging
- User action tracking
- Authentication events
- System changes
- Compliance reporting
- Retention policies

### Health Monitoring
- Health check endpoints
- Service status monitoring
- Database connection health
- Keycloak connectivity
- WebSocket connection status

### Metrics Collection
- Request rate and latency
- Error rates
- Database query performance
- Memory and CPU usage
- Active user sessions

## Deployment Checklist

### Pre-Deployment
- [ ] Update environment variables for production
- [ ] Configure production database credentials
- [ ] Set up SSL certificates
- [ ] Configure backup strategy
- [ ] Review and update CORS origins
- [ ] Set production logging levels
- [ ] Configure email SMTP settings
- [ ] Update Keycloak URLs
- [ ] Test all critical paths
- [ ] Review security settings

### Production Deployment
- [ ] Deploy database with backups
- [ ] Deploy Keycloak with realm configuration
- [ ] Deploy backend services
- [ ] Deploy frontend application
- [ ] Configure reverse proxy
- [ ] Set up monitoring and alerting
- [ ] Configure log aggregation
- [ ] Test authentication flow
- [ ] Verify real-time features
- [ ] Load testing

### Post-Deployment
- [ ] Monitor error logs
- [ ] Check performance metrics
- [ ] Verify backup procedures
- [ ] Test disaster recovery
- [ ] Update documentation
- [ ] Train support team
- [ ] Monitor user feedback
- [ ] Plan scaling strategy

## Troubleshooting

### Common Issues

**Database Connection Errors:**
- Verify database credentials in .env
- Check database container is running
- Verify network connectivity
- Check connection pool settings

**Keycloak Authentication Failures:**
- Verify Keycloak URL configuration
- Check realm and client settings
- Verify redirect URIs
- Check token expiration settings

**WebSocket Connection Issues:**
- Verify nginx WebSocket headers
- Check CORS configuration
- Verify Socket.IO version compatibility
- Check firewall settings

**File Upload Failures:**
- Check upload directory permissions
- Verify file size limits
- Check disk space
- Verify multer configuration

### Debug Commands

```bash
# Check container logs
docker logs task-backend --tail 100 -f
docker logs task-frontend --tail 100 -f

# Check container status
docker ps -a

# Check network connectivity
docker exec -it task-backend ping database
docker exec -it task-nginx ping backend

# Check database connection
docker exec -it task_management_db mysql -u taskuser -p

# Check disk usage
docker system df

# Clean up unused resources
docker system prune -a
```

## Security Best Practices

### Application Security
- JWT token validation on every request
- SQL injection prevention with parameterized queries
- XSS protection with input sanitization
- CSRF protection
- Rate limiting on API endpoints
- File upload validation
- Secure password storage

### Infrastructure Security
- Minimal container images
- Non-root user execution
- Network isolation
- Secret management
- Regular security updates
- Vulnerability scanning
- Access control lists

### Data Security
- Encryption at rest
- Encryption in transit (TLS)
- Secure backup procedures
- Data retention policies
- GDPR compliance ready
- Audit trail for all actions

## Accessibility Features

The application is built with WCAG 2.2 Level AA compliance:

**Keyboard Navigation:**
- Full keyboard accessibility throughout the application
- Tab navigation with proper focus management
- Arrow key navigation in menus and lists
- Escape key to close modals and menus
- Enter and Space key activation for interactive elements

**Screen Reader Support:**
- Semantic HTML structure
- ARIA labels and descriptions
- Live regions for dynamic content
- Focus trap in modals
- Proper heading hierarchy
- Form field associations

**Visual Accessibility:**
- High contrast color schemes
- Sufficient color contrast ratios
- Focus indicators on all interactive elements
- Responsive text sizing
- No information conveyed by color alone
- Reduced motion support

**Focus Management:**
- Automatic focus restoration
- Focus trap in modal dialogs
- Skip navigation links
- Visible focus indicators
- Logical tab order
- No keyboard traps

**Additional Features:**
- Accessible notifications and alerts
- Keyboard-accessible file upload
- Sidebar state persistence
- Mobile-responsive design
- Touch-friendly interface
- Error message accessibility

## License

This project is licensed under the MIT License.

## Support

For issues, questions, or contributions, please contact the development team or open an issue in the repository.

## Version History

**Current Version:** 2.0.0

**Recent Updates:**
- Enhanced accessibility features (WCAG 2.2 Level AA)
- Shared component architecture for team management
- Improved focus management and keyboard navigation
- Manager panel enhancements
- Task creation bug fixes
- Sidebar state persistence
- File upload accessibility improvements
- Real-time collaboration features
- Comprehensive audit logging

---

Last Updated: January 2025
Verified Configuration: Docker Desktop with WSL2 on Windows, tested on Linux and macOS
