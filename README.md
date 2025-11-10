# Easier Backup (Backend)

This repository contains the backend server for Easier Backup, an agent-based backup management system. This server handles user authentication, agent (computer) management, task scheduling, job history, and real-time communication with agents via WebSockets.

## 🌟 Core Features

* **User Management:** Secure user registration, login, and logout.
* **Password Recovery:** Secure, hash-based recovery code system.
* **Agent Management:** Register new agents, monitor online/offline status, and manage computer records.
* **Task Scheduling:** Create, update, and delete backup tasks with cron-based scheduling.
* **Job History:** Track the history and status (success/failure) of all backup jobs.
* **Automated Scheduler:** A minute-by-minute scheduler (`node-cron`) checks for and queues due tasks.
* **Admin Dashboard:** Endpoints for system statistics and viewing user audit logs.
* **Real-time Communication:** Uses WebSockets (`ws`) for instant communication with agents (heartbeats, start-backup commands, job results).

---

## 🔒 Security-First Design

This backend was built with a strong focus on security:

* **Password Hashing:** Passwords are never stored in plaintext. They are hashed using **bcryptjs** with a saltRounds of 12.
* **JWT Authentication:** User sessions are managed via **JSON Web Tokens (JWT)**. These tokens are stored in secure, **`HttpOnly`** cookies to prevent XSS attacks. Cookies are also set with `Secure` (in production) and `SameSite` attributes.
* **Token Revocation on Password Change:** All active JWTs are automatically invalidated if a user changes their password, as the system checks the token's issued-at time (`iat`) against the `password_changed_at` timestamp in the database.
* **Path Traversal Prevention:** All `source_path` and `destination_path` inputs for tasks are rigorously sanitized and normalized to prevent path traversal attacks.
* **Rate Limiting:** Key endpoints like `login`, `register`, `reset-with-code`, and `request-agent-reg-token` are protected by rate-limiting to mitigate brute-force attacks.
* **Comprehensive Input Validation:** All incoming request bodies (`POST`, `PUT`) are validated using a custom middleware to ensure correct data types, lengths, and formats.
* **Secure Headers:** Uses `helmet` to apply essential security headers (like HSTS, Referrer Policy, etc.) to all responses.
* **CORS:** Cross-Origin Resource Sharing (CORS) is strictly enforced and limited to origins specified in the `ALLOWED_ORIGINS` environment variable.
* **Role-Based Access Control (RBAC):** A clear distinction is made between `user` and `admin` roles, with an `adminOnly` middleware protecting sensitive administrative endpoints.
* **Audit Logging:** Critical user actions (e.g., login, register, create/delete task, password reset) are logged with the user's ID and IP address for full traceability.
* **Secure Agent Registration Flow:**
    1.  A user must first authenticate (log in) to request a **short-lived (5-min), single-scope (`agent:register`) JWT**.
    2.  The agent software must use this short-lived token to register itself.
    3.  Upon successful registration, the agent receives a **permanent, cryptographically random `auth_token`**.
* **WebSocket Security:**
    1.  Agents must authenticate their WebSocket connection by providing their permanent `auth_token` in the `X-Agent-Token` header.
    2.  All WebSocket messages are subject to payload size limits (64KB) and message rate limits to prevent abuse.

---

## 🛠️ Tech Stack

* **Runtime:** Node.js
* **Framework:** Express.js
* **Language:** TypeScript
* **Database:** PostgreSQL
* **ORM:** Prisma
* **Authentication:** JWT (jsonwebtoken), bcryptjs
* **Real-time:** WebSockets (`ws`)
* **Scheduling:** `node-cron`, `cron-parser`

---

## 📚 API Documentation

**Base URL:** `/api/v1`

### 1. User Authentication (Auth)

[Route File: `src/api/routes/users.route.ts`]

#### `POST /users/register`
* **Description:** Registers a new user.
* **Body:**
    ```json
    {
      "username": "testuser",
      "email": "user@example.com",
      "password": "yourStrongPassword123"
    }
    ```

#### `POST /users/login`
* **Description:** Logs in a user and returns a `HttpOnly` session cookie.
* **Body:**
    ```json
    {
      "email": "user@example.com",
      "password": "yourStrongPassword123"
    }
    ```

#### `POST /users/logout`
* **Description:** Logs out a user by clearing the session cookie.
* **Body:** (Empty)

---

### 2. Password Recovery

[Route File: `src/api/routes/auth.route.ts`]

#### `POST /auth/reset-with-code`
* **Description:** Resets a user's password using a valid recovery code (no login required).
* **Body:**
    ```json
    {
      "email": "user@example.com",
      "code": "RECOVERY-CODE-123",
      "password": "myNewStrongPassword123"
    }
    ```

#### `POST /auth/recovery-codes`
* **Description:** (Login Required) Generates a new set of 10 recovery codes. This invalidates all old, unused codes.
* **Body:** (Empty)

#### `GET /auth/recovery-codes-status`
* **Description:** (Login Required) Checks if the user has viewed their codes and how many active codes remain.

#### `POST /auth/recovery-codes-viewed`
* **Description:** (Login Required) Marks the user's recovery codes as "viewed".
* **Body:**
    ```json
    {
      "viewed": true
    }
    ```

---

### 3. Agent Registration Flow

#### `POST /agent-auth/request-token`
* **Description:** (Login Required) Authenticates a user (owner) and returns a short-lived (5 min) token for registering a new agent.
* **Body:** (Verifies user ownership)
    ```json
    {
      "email": "user@example.com",
      "password": "yourPassword"
    }
    ```
* **Returns:** `{ "registrationToken": "..." }`

#### `POST /computers`
* **Description:** (Agent Reg Token Required) Registers a new computer (agent) using the short-lived token.
* **Authentication:** `Authorization: Bearer <registrationToken>`
* **Body:**
    ```json
    {
      "name": "My-Work-PC",
      "os": "Windows 11",
      "default_backup_keep_count": 5,
      "default_retry_attempts": 3,
      "default_retry_delay_seconds": 60
    }
    ```
* **Returns:** `{ "agentToken": "..." }` (This is the permanent token for WebSocket auth)

---

### 4. Computer (Agent) Management

(All endpoints require user login)
[Route File: `src/api/routes/computers.route.ts`]

#### `GET /computers`
* **Description:** Lists all computers registered to the logged-in user.

#### `PUT /computers/:computerId`
* **Description:** Updates a computer's name.
* **Body:**
    ```json
    {
      "name": "New-PC-Name"
    }
    ```

#### `DELETE /computers/:computerId`
* **Description:** Deletes a computer and all associated tasks and job histories.

---

### 5. Backup Task Management

(All endpoints require user login)
[Route File: `src/api/routes/tasks.route.ts`]

#### `POST /tasks`
* **Description:** Creates a new backup task for one of the user's computers. Paths are validated for security.
* **Body:**
    ```json
    {
      "computer_id": "123",
      "name": "Daily Documents Backup",
      "source_path": "C:\\Users\\MyUser\\Documents",
      "destination_path": "D:\\Backups\\Documents",
      "schedule": "0 22 * * *",
      "is_active": "true",
      "backup_keep_count": 7,
      "retry_attempts": 3,
      "retry_delay_seconds": 60,
      "folder_prefix": "backup_",
      "timestamp_format": "%Y%m%d_%H%M%S",
      "discord_webhook_url": "[https://discord.com/api/webhooks/](https://discord.com/api/webhooks/)...",
      "notification_on_success": "✅ Backup succeeded",
      "notification_on_failure": "❌ Backup failed"
    }
    ```

#### `PUT /tasks/:taskId`
* **Description:** Updates an existing task.
* **Body:** (Same as `POST /tasks`)

#### `DELETE /tasks/:taskId`
* **Description:** Deletes a task.

#### `POST /tasks/:taskId/start-now`
* **Description:** Sends a command via WebSocket to force an agent to run a task immediately.
* **Body:** (Empty)

#### `GET /tasks/user`
* **Description:** Gets all tasks for the logged-in user across all computers.

#### `GET /tasks/user/count`
* **Description:** Counts the total number of tasks for the logged-in user.

#### `GET /tasks/computer/:computerId`
* **Description:** Gets all tasks for a specific computer.

---

### 6. Backup Job History

(All endpoints require user login)
[Route File: `src/api/routes/backup_jobs.route.ts`]

#### `GET /jobs/task/:taskId`
* **Description:** Gets the 50 most recent job histories for a specific task.

---

### 7. Admin

(All endpoints require user login with `admin` role)
[Route File: `src/api/routes/admin.route.ts`]

#### `GET /admin/audit-logs`
* **Description:** Retrieves audit logs with pagination.

#### `GET /admin/stats`
* **Description:** Gets system-wide statistics (total users, computers, tasks).

---

## 🔌 WebSocket API

[Service File: `src/services/websocket.service.ts`]

The WebSocket server is used for real-time communication between the server and the agents.

* **Endpoint:** `wss://your-domain.com/ws`
* **Authentication:** The agent must connect with the permanent `agentToken` (received from `POST /computers`) sent in a header:
    * `X-Agent-Token: <your-agent-auth-token>`

### 1. Client (Agent) -> Server

#### `heartbeat`
* **Description:** Sent by the agent periodically (e.g., every 1 minute) to signal it is still online.
* **Payload:**
    ```json
    {
      "action": "heartbeat"
    }
    ```

#### `update-job-status`
* **Description:** Sent by the agent after it finishes a `start-backup` command.
* **Payload:**
    ```json
    {
      "action": "update-job-status",
      "jobId": "12345",
      "status": "success",
      "details": "Backed up 5 files."
    }
    ```
    (If failed, `status` is `"failed"` and `details` contains the error message)

### 2. Server -> Client (Agent)

#### `start-backup`
* **Description:** Sent by the server to instruct the agent to perform a backup. This is triggered by the scheduler or a `start-now` request.
* **Payload:**
    ```json
    {
      "action": "start-backup",
      "jobId": "12345",
      "taskId": "123",
      "sourceFile": "C:\\Users\\MyUser\\Documents",
      "destinationBaseFolder": "D:\\Backups\\Documents",
      "keepCount": 7,
      "retryAttempts": 3,
      "retryDelay": 60,
      "folderPrefix": "backup_",
      "timestampFormat": "%Y%m%d_%H%M%S",
      "discordWebhookUrl": "...",
      "notificationOnSuccess": "...",
      "notificationOnFailure": "..."
    }
    ```

---

## 📄 License

This project is licensed under the **Apache License 2.0**.
