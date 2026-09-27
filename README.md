# CollabZ — Real-Time Multi-Model AI Collaboration Platform

[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![NodeJS](https://img.shields.io/badge/Node.js-22.x-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.8-010101?style=for-the-badge&logo=socketdotio&logoColor=white)](https://socket.io/)
[![Gemini](https://img.shields.io/badge/Gemini_AI-3.5_Flash-0091FF?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-4.0-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![JWT](https://img.shields.io/badge/Security-JWT_HttpOnly-FF007F?style=for-the-badge&logo=jsonwebtokens&logoColor=white)](https://jwt.io/)
[![RBAC](https://img.shields.io/badge/Control-RBAC_Enterprise-orange?style=for-the-badge)](https://en.wikipedia.org/wiki/Role-based_access_control)

CollabZ is a production-grade, real-time MERN SaaS platform that redefines how teams interact with Artificial Intelligence. Rather than restricting prompting to an isolated, single-user window, CollabZ introduces a high-performance **multiplayer workspace** where product managers, software engineers, and researchers can collaboratively refine prompts, stream comparative responses from Google Gemini and other simulated LLMs simultaneously, track administrative telemetry, and audit workspace security.

---

## 🚀 2. Project Overview

CollabZ is an enterprise-grade solution designed to eliminate the single-user silos in modern generative AI tools. By shifting prompting into a real-time collaborative workspace, teams can build better prompt pipelines together. 

### Core Value Pillars:
*   **Real-Time AI Collaboration:** Low-latency multiplayer rooms powered by WebSockets ensure that when one user edits a prompt or alters configurations, the entire team witnesses the changes instantly.
*   **Multi-Model Streaming:** Parallel asynchronous pipelines dispatch prompting payloads to multiple language models (featuring live native streaming from the Gemini API) and render responses side-by-side.
*   **Collaborative Workspaces:** Multi-tenant environments structured around private, invite-only boundaries where conversations and prompts are isolated.
*   **Admin Analytics & RBAC:** A specialized command center for operations teams to monitor platform health, manage user permissions, and suspend accounts in real time.
*   **AI Comparison Workflows:** Side-by-side interface metrics comparing prompt duration, token throughput rendering, and markdown accuracy across models to identify optimal prompt strategies.

---

## ✨ 3. Core Features

### 👥 Realtime Collaboration
*   **Collaborative Rooms:** Multiplayer workspaces bound to specific channel routing. Users join dedicated room namespaces securely.
*   **Live Presence:** Real-time visual representation of active team members working in the workspace, complete with color-coded cursors.
*   **Typing Indicators:** Real-time visual indicators displaying who is currently editing prompt boxes or typing responses, eliminating input conflicts.
*   **Workspace Invites:** Cryptographically secure workspace invitations that allow owners to securely add collaborators to their prompt engineering rooms.
*   **Synchronized Updates:** Bidirectional socket updates that instantly mirror prompt text changes, model selections, and conversational threads across all active screens.

### 🤖 AI Features
*   **Gemini Streaming:** Native integrations with the `@google/genai` library to stream token responses from `gemini-3.5-flash` with zero buffering.
*   **Multi-Model Comparison:** Parallel comparative layout rendering streaming responses from multiple models simultaneously, complete with diagnostic shimmers.
*   **Markdown Rendering:** Advanced frontend parsing of incoming chunk packets into stylized HTML, with full support for tables, blockquotes, and nested syntax highlighting.
*   **Prompt Workflows:** Versioned, structured conversation streams enabling teams to save prompt templates, run variables, and iterate on prompt structures.
*   **AI Response Persistence:** A persistent bookmark library that permits teams to pin exceptional model completions directly to the workspace dashboard.

### 🛡️ Admin System
*   **Admin Dashboard:** A unified platform operations panel for systems administrators to review telemetry and user metrics.
*   **Analytics:** Recharts-powered graphs monitoring daily active users, total database usage, API request count, and AI query response latencies.
*   **Audit Logs:** A forensic log audit trail capturing authentication events, user status modifications, workspace creations, and role updates, complete with IP tracking.
*   **User Management:** Administrative options to modify roles (user/admin), promote members, or search system registers.
*   **Role-Based Access Control (RBAC):** Strict software checks restricting administrative routes and API operations exclusively to validated admins.
*   **Workspace Moderation:** Global oversight tools enabling administrators to audit active channels, delete workspace instances, and moderate user content.

### 🔒 Security Features
*   **JWT Auth:** Stateless user verification utilizing short-lived JSON Web Tokens passed in secure Authorization headers.
*   **Access + Refresh Tokens:** Dual-token structure to maintain security posture while sustaining active, uninterrupted user sessions.
*   **HttpOnly Cookies:** Storing critical refresh tokens in `HttpOnly`, `Secure`, `SameSite: None` cookies to prevent client-side script interception (XSS protection).
*   **Helmet:** Secure HTTP headers configured to prevent clickjacking, MIME-sniffing, and cross-site scripting vulnerabilities.
*   **Rate Limiting:** Throttling algorithms (`express-rate-limit`) preventing API abuse globally, with strict rate limits on authentication routes (`/api/auth/login`, `/api/auth/register`).
*   **Socket Authentication:** Web socket connection verification using handshakes to validate JWT signatures before opening socket tunnels.
*   **Protected Routes:** React and Express router guards restricting resource access based on authentication status and user roles.

### ⚙️ SaaS Engineering Features
*   **MongoDB Architecture:** Optimized document-based data modeling with virtual parameters, custom schemas, and compound index performance mappings.
*   **Zustand State Management:** A unified slice-based frontend state aggregator handling asynchronous auth loops, socket connections, and reactive UI boundaries.
*   **React Query:** In-app state hydration, caching, and background synchronization for RESTful API requests, preventing duplicate network requests.
*   **Socket.IO:** Real-time event communication channel using room bindings and custom event dispatch queues.
*   **Scalable Architecture:** Structured modular codebase separating business routing logic, validation layers, real-time socket events, and database models.
*   **Responsive UI:** A premium Tailwind-engineered interface implementing fluid grid layouts, dark mode glassmorphism, and responsive transitions.

---

## 🛠️ 4. Tech Stack

### Frontend Layer
*   **React 19:** View rendering engine supporting concurrent layouts.
*   **TypeScript 5.8:** Strict type definitions across UI layouts and state stores.
*   **Vite 6:** Rapid frontend builder running Hot Module Replacement.
*   **Tailwind CSS 4.0:** Dynamic custom utility styling engine with glassmorphic variables.
*   **Zustand 5.0:** Fast state store handling reactive client synchronization.
*   **React Query (TanStack):** High-fidelity data caching, request synchronization, and server mutation.
*   **Framer Motion:** Micro-animations, modal transitions, and dynamic card streams.
*   **Socket.IO Client:** Low-latency client websocket wrapper linking to the server.

### Backend Layer
*   **Node.js 22:** Performance-oriented asynchronous event-driven JavaScript server environment.
*   **Express 4.21:** Lightweight HTTP router serving REST endpoints.
*   **MongoDB:** Document-oriented database cluster.
*   **Mongoose 9.6:** Object Data Modeling (ODM) layer executing strict database schemas.
*   **Socket.IO:** Real-time network orchestrator.
*   **JWT (jsonwebtoken):** Secure cryptographic tokens for authorization.
*   **Zod 4.4:** Direct runtime validation for API schemas.
*   **Gemini API (@google/genai):** LLM integration to handle real-time streaming tokens.

### Infrastructure & Operations
*   **Vercel:** Optimized edge hosting for static single-page React assets.
*   **Render / Railway:** High-availability server deployments executing continuous integration.
*   **MongoDB Atlas:** Distributed cloud database manager.

---

## 📊 5. System Architecture

CollabZ organizes workflows across distinct system layers, maintaining separate boundaries for data storage, real-time messaging, and application execution:

```
+-----------------------------------------------------------------------------+
|                               FRONTEND LAYER                                |
|  [React 19 App] -- (Zustand State Engine) -- (React Query / Axios Client)     |
|         |                                           |                       |
|         | (Socket.IO Connection)                    | (REST API Calls)      |
+---------+-------------------------------------------+-----------------------+
          |                                           |
          v                                           v
+-----------------------------------------------------------------------------+
|                                BACKEND LAYER                                |
|                        [Unified Express HTTP Server]                        |
|                                                                             |
|   +-----------------------+                       +---------------------+   |
|   |     SOCKET LAYER      |                       |    AUTH & ROUTING   |   |
|   | • Handshake JWT Auth  |                       | • Rate Limit Guards |   |
|   | • Room Isolation      |                       | • Zod Validation    |   |
|   | • Presence Tracking   |                       | • Helmet HTTP Sec   |   |
|   +-----------+-----------+                       +----------+----------+   |
|               |                                              |              |
+---------------+----------------------------------------------+--------------+
                |                                              |
                v                                              v
+-----------------------------------------------------------------------------+
|                            EXTERNAL & PERSISTENCE                           |
|                                                                             |
|   +-------------------------------+      +------------------------------+   |
|   |     MongoDB Persistence       |      |    AI STREAMING FLOW         |   |
|   | • User, Messages Schemas      |      | • @google/genai Client       |   |
|   | • Admin Analytics Pipeline    |      | • Parallel Gemini Streams    |   |
|   +-------------------------------+      +------------------------------+   |
+-----------------------------------------------------------------------------+
```

### Architectural Stream & Storage Pipeline
1.  **Frontend Layer:** The React single-page application binds components to Zustand store events. React Query handles cache invalidations and aggregates remote REST API states.
2.  **Backend Layer:** The Node server runs Express routes and hooks into a unified HTTP server hosting the Socket.IO engine on port `3000`.
3.  **Socket Layer:** Manages room boundaries based on workspace parameters (`workspace:${workspaceId}`) and coordinates typing, prompt edits, and active presence.
4.  **Auth & Routing:** Implements global rate limit configurations and validates incoming client tokens.
5.  **AI Streaming Flow:** Bypasses conventional blocking REST channels. The backend initiates concurrent socket events that stream raw tokens from the Gemini API back to the UI in parallel chunks.
6.  **MongoDB Persistence:** Serves as the primary source of truth. Features indexing on key database fields (`email`, `workspaceId`, `conversationId`) and schedules background aggregation operations for the admin analytics pipeline.

---

## 🔐 6. Authentication Flow

CollabZ features a secure authentication architecture leveraging dual-token rotation, cross-site scripting (XSS) defenses, and strict access controls.

```
Client App (Zustand)           Express API Gateway               Database (MongoDB)
   │                                  │                                  │
   ├────────── POST /login ──────────>│                                  │
   │        (Credentials Payload)     ├──────── getUserByEmail() ───────>│
   │                                  │<─────── User Record & Hash ──────┤
   │                                  │                                  │
   │                                  ├─ Verify Cryptographic Hash       │
   │                                  ├─ Sign Access Token (15m)         │
   │                                  ├─ Sign Rotated Refresh (7d)       │
   │                                  ├──────── Save Refresh Token ─────>│
   │                                  │                                  │
   │<────── Access Token (Headers) ───┤                                  │
   │<────── Rotated Refresh (Cookie) ─┤ (HttpOnly, Secure, SameSite: None)
```

### Token Engineering Matrix
*   **Access Token:** Encrypted using `JWT_ACCESS_SECRET` with an expiration window of 15 minutes. This token is stored in-memory by the frontend client application and attached to Axios request headers as a Bearer authorization token.
*   **Refresh Token:** Encrypted using `JWT_REFRESH_SECRET` with an expiration window of 7 days. Stored inside a secure cookie parameter under `HttpOnly`, `Secure`, and `SameSite: None` settings.
*   **HttpOnly Cookies:** Prevents dynamic browser scripts from querying or retrieving the token payload, eliminating token capture from malicious XSS vectors.
*   **JWT Validation:** Middleware checks the validity and expiration of incoming header tokens before executing API routes.
*   **RBAC System:** Validates user claims (`user.role === 'admin'`) before allowing configuration updates or administrative portal entry.
*   **Socket Authentication:** The WebSocket server executes token verification on incoming handshakes:
    ```typescript
    const decoded = jwt.verify(token, getJwtSecret()) as { id: string; role: string };
    const user = await db.getUserById(decoded.id);
    if (!user || user.blocked) return next(new Error("Unauthorized"));
    socket.data = { user };
    ```

---

## 📡 7. Realtime Engine

The real-time workspace runs on a customized **Socket.IO synchronization layer** designed for heavy collaborative environments.

```
Collaborator A                   Socket Sync Server                 Collaborator B
   │                                     │                                 │
   ├─────── join-workspace ─────────────>│                                 │
   │        (workspaceId)                ├─────── join-workspace ─────────>│
   │                                     │        (workspaceId)            │
   ├─────── prompt-text-change ─────────>│                                 │
   │        (Shared Prompt Content)      ├─────── prompt-text-sync ───────>│
   │                                     │        (Prompt Content Sync)    │
   ├─────── user-typing-start ──────────>│                                 │
   │                                     ├─────── user-typing ────────────>│
   │                                     │        (A is typing...)         │
```

### Real-Time Pipeline Specs
*   **Socket.IO Architecture:** Operates over web socket tunnels, falling back to long polling in restricted network environments.
*   **Room Isolation:** Dynamic room mapping isolates clients by assigning them to a unique room string: `workspace:${workspaceId}`. The socket server ensures no packets cross room boundaries.
*   **Live Synchronization:** Real-time prompt changes and canvas operations are transmitted using debounced event broadcasts, keeping collaborative screens updated.
*   **Collaborative Updates:** Bidirectional updates allow prompt configurations and AI model lists to update globally without requiring manual browser refreshes.
*   **Typing Indicators:** Broadcasts active state parameters (`user-typing-start`, `user-typing-stop`) to render inline visual indicators on collaborator screens.
*   **Reconnect Flow:** Integrated client-side logic to handle connection losses. Upon reconnection, the client automatically requests a handshake update, re-authenticates the socket session, and re-joins active workspace rooms.

---

## 📊 8. Admin Panel

The administrative panel provides a centralized interface for monitoring platform usage, reviewing security logs, and managing platform access:

```
+--------------------------------------------------------------------------------+
|                             ADMIN COMMAND CENTER                               |
+--------------------------------------------------------------------------------+
|  [Telemetry Board]                 [Workspace Monitoring]   [User Management]  |
|  • Active User Metries             • Audit Active Channels  • Promote Roles    |
|  • DB Document Registry            • Channel Moderation     • Account Blocks   |
|  • AI Query Latency Graphs         • Purge Sandboxes        • Active Session   |
|                                                                                |
|  [Audit Logging / SIEM]                                                        |
|  • Tracks Auth Attempts, Role Elevations, IP Records                           |
+--------------------------------------------------------------------------------+
```

### Operations Features:
*   **Analytics Dashboard:** Displays system health, active database connections, daily API operations, and prompt latencies.
*   **User Management:** Offers search features to review user attributes, change account levels (`user`/`admin`), and suspend active accounts.
*   **Workspace Monitoring:** Monitors workspace creations, monitors active channels, and provides global tools to delete workspaces when necessary.
*   **Audit Logging:** Tracks and records system events (failed auth, user registrations, role adjustments) in an audit database schema (`AuditLogModel`) with IP tracking.
*   **AI Monitoring:** Measures LLM execution, tracking streaming performance, token processing times, and endpoint errors.
*   **RBAC System:** Limits platform settings, server database seeds, and operational metrics exclusively to accounts verified as `admin`.

---

## 🖼️ 9. Screenshots Section

### Auth Portal & Login Page
![Login Page](assets/login_page.png)
*Figure 9.1: Glassmorphic auth gateway implementing dual-token access validation, secure cookie transport, and automated rate-limiting protectors.*

### User Workspace
![User Workspace](assets/user_workspace.png)
*Figure 9.2: Multiplayer collaborative workspace showcasing live prompt refinement channels, dynamic editor sync, and active session listings.*

### AI Comparison
![AI Comparison](assets/ai_comparison.png)
*Figure 9.3: Asynchronous parallel streaming container illustrating comparative Gemini token delivery, rich markdown structures, and timing diagnostics.*

### Collaborative Rooms
![Collaborative Rooms](assets/user_workspace.png)
*Figure 9.4: Multi-tenant room isolation boundaries mapping active user channels, presence avatars, and typing triggers.*

### Admin Dashboard
![Admin Dashboard](assets/admin_dashboard.png)
*Figure 9.5: Systems Control Panel displaying user suspension operations, dynamic RBAC overrides, and active workspace governance models.*

### Analytics
![Analytics](assets/admin_dashboard.png)
*Figure 9.6: High-fidelity telemetry metrics utilizing Recharts models to visualize daily client logs, network traffic spikes, and LLM throughput latency.*

### Audit Logs
![Audit Logs](assets/admin_dashboard.png)
*Figure 9.7: Forensic database activity ledger tracing authentication requests, status updates, and security details alongside client IP signatures.*

---

## ⚙️ 10. Installation Guide

### Frontend Client Setup
1.  Navigate to your terminal and clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Launch the integrated development environment:
    ```bash
    npm run dev
    ```

### Backend Server Setup
The backend runs in tandem with the frontend using the unified server launch configuration.
1.  Verify that your local or cloud MongoDB instances are running.
2.  Configure your local `.env` variables (as detailed in Section 12).
3.  Launch the backend and compilation pipeline:
    ```bash
    npm run dev
    ```
The server will initialize on port `3000`. Point your browser to `http://localhost:3000`.

---

## 📄 11. Environment Variables

### Frontend Variables
Create a local `.env` file in the frontend build folder (or inject them via your Vercel control settings):
```env
VITE_SOCKET_URL="http://localhost:3000"
```

### Backend Variables
Configure these variables in your root workspace `.env` file for the Express/Socket engine:
```env
PORT=3000
NODE_ENV="development"

# Cryptographic Token Seeds
JWT_ACCESS_SECRET="synapse-ai-access-quantum-secret-2026"
JWT_REFRESH_SECRET="synapse-ai-refresh-quantum-secret-2026"
JWT_SECRET="synapse-ai-exclusive-quantum-secret-2026"

# CORS Whitelist Settings
CLIENT_URL="http://localhost:3000"

# MongoDB Database Connection URI
MONGO_URI="mongodb+srv://admin-user:StrongPassword@cluster.mongodb.net/collabz"

# LLM Integrations
GEMINI_API_KEY="your_api_key"

# Startup Autoseed Configuration
ADMIN_NAME="System Super Administrator"
ADMIN_EMAIL="admin@synapse.ai"
ADMIN_PASSWORD="Password@123"
```

---

## 🚢 12. Deployment Guide

### Vercel Deployment (Frontend Client SPA)
Vercel is optimized to host your compiled single-page React assets:
1.  Connect your GitHub repository to Vercel.
2.  Configure the build framework to **Vite**.
3.  Set the **Build Command** to: `npm run build`
4.  Set the **Output Directory** to: `dist`
5.  Inject the Environment variables:
    *   `VITE_SOCKET_URL` -> Deployed Backend Socket Server URL.

### Railway or Render Deployment (Backend HTTP / Socket Server)
Run your backend in a persistent container environment supporting active WebSocket handshakes:
1.  Link your repository in Railway or Render.
2.  Set the environment properties to use **Node.js 22 LTS**.
3.  Set the **Build Command** to compile assets:
    ```bash
    npm run build
    ```
4.  Configure the **Start Command** to run the bundled server:
    ```bash
    npm run start
    ```
5.  Add your production environment variables (e.g. `MONGO_URI`, `JWT_ACCESS_SECRET`, `GEMINI_API_KEY`). Ensure `PORT` is assigned to `3000` or dynamic cloud ports.

### MongoDB Atlas Deployment
1.  Create a Free Tier M0 Cluster in MongoDB Atlas.
2.  Add a database user with read/write permissions for your collection.
3.  Under **Network Access**, whitelist your server's deployment IP addresses (or allow access from anywhere `0.0.0.0/0` if hosting on dynamic container providers like Railway).
4.  Copy the connection string and assign it to the `MONGO_URI` variable on your server environment.

### Production Security Checklist:
*   **Production Environment Setup:** Set `NODE_ENV` to `"production"`.
*   **CORS Config:** Set `CLIENT_URL` to your production frontend domain.
*   **Secure Cookies:** Refresh tokens are served with `secure: true` and `sameSite: 'none'`. This configuration requires active HTTPS connections to register cookies successfully.
*   **HTTPS Requirements:** Ensure all routes run over secure HTTPS/WSS channels to prevent credential sniffing.

---

## 🔒 13. Security Implementation

CollabZ is hardened against modern web application vulnerabilities:

*   **JWT Security:** Implements stateless validation for request handling. Access tokens are kept in-memory to prevent browser storage sniffing.
*   **Refresh Token Rotation:** Employs a rotation model where the server replaces the old refresh token with a new one upon session refresh. If a token reuse conflict is detected, the database revokes the active session keys instantly to lock out unauthorized access.
*   **HttpOnly Cookies:** Restricts cookie access to server HTTP communications, securing tokens against XSS cross-site scripting vulnerabilities.
*   **Helmet:** Configures HTTP headers to protect against common attacks, such as clickjacking and MIME-type vulnerabilities.
*   **Rate Limiting:** Protects endpoints from brute-force attempts and DDoS traffic by enforcing request thresholds:
    ```typescript
    const globalLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 3000,
      message: { error: 'Too many requests' }
    });
    ```
*   **RBAC:** Standard routes, database seeding, and administrative panels are restricted using validation middlewares:
    ```typescript
    export function adminOnly(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin role required.' });
      next();
    }
    ```
*   **Socket Auth:** WebSocket connections are authenticated during the handshake phase, rejecting unauthenticated clients.
*   **Protected APIs:** Server routes verify access tokens before executing logic or database operations.

---

## 🚀 14. Performance Optimizations

To maintain responsiveness under collaborative loads, the platform implements several optimization strategies:

*   **Lazy Loading:** React pages and heavy administrative modules are loaded dynamically using `React.lazy()` and `Suspense`, reducing the initial payload size.
*   **React Query Caching:** Leverages TanStack Query to cache REST payloads. This prevents redundant database queries by reusing valid cache states.
*   **Optimized Rerenders:** Integrates selector functions inside Zustand stores:
    ```typescript
    const currentUser = useStore(state => state.auth.user);
    ```
    This ensures that components only re-render when their specific slice of the state changes, preventing global layout redraws.
*   **MongoDB Indexing:** Optimizes query execution times by applying indices on highly queried collection fields:
    ```typescript
    UserSchema.index({ email: 1 });
    WorkspaceSchema.index({ ownerId: 1, memberIds: 1 });
    ConversationSchema.index({ workspaceId: 1 });
    MessageSchema.index({ conversationId: 1, createdAt: 1 });
    ```
*   **Pagination:** Implements pagination on message histories, loading history records in segments to limit memory overhead:
    ```typescript
    const docs = await MessageModel.find({ conversationId })
      .sort({ createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit);
    ```
*   **Socket Optimization:** Debounces collaborative typing events and prompt updates, reducing network packet overhead.

---

## 🗺️ 15. Future Roadmap

- [ ] **Redis scaling:** Integrate a Redis Pub/Sub adapter to sync socket rooms across multiple backend nodes behind load balancers.
- [ ] **OpenAI/Claude integrations:** Add native API integrations with OpenAI's GPT-4o and Anthropic's Claude 3.5 Sonnet to support broader model comparisons.
- [ ] **Kubernetes deployment:** Package the application into Docker containers and configure Kubernetes files to support automated scaling.
- [ ] **AI memory system:** Add semantic search capabilities to saved prompt responses using MongoDB Vector Search or PGVector.
- [ ] **Enterprise billing:** Integrate Stripe subscriptions to support tiered billing structures, billing cycles, and team usage limits.
- [ ] **Team organizations:** Expand workspaces to support multi-team enterprise directories, custom permissions, and domain-based access rules.

---

## 🎓 16. Resume Value Section

### What This Project Demonstrates:
*   **MERN Expertise:** Advanced full-stack integration of MongoDB, Express, React, and Node.js with strict type-safety across layers.
*   **Realtime Architecture:** Real-time state synchronization, handling room isolation, connection failures, and multiplayer conflict resolutions.
*   **AI Integration:** Native streaming integrations with LLM interfaces, managing comparative streaming states and parsing markdown payloads.
*   **SaaS Engineering:** Designing scalable databases, managing clean environment variables, and configuring single-package production builds.
*   **RBAC:** Implementing role-based route protection on both the client (React guards) and server (Express gateway middlewares).
*   **Production Authentication:** Secure session management using Access/Refresh token rotation and secure cookie configurations.
*   **Admin Systems:** Implementing telemetry monitoring dashboards, interactive charts, and system audit logs.

---

## 👤 17. Author Section

*   **Lead Maintainer:** `Naresh Kamarthy`
*   **Professional Website:** [Naresh Kamarthy Portfolio](https://naresh-kamarthy-portfolio.vercel.app)
*   **LinkedIn Profile:** [linkedin.com/in/naresh-kamarthy-aa1239130](https://www.linkedin.com/in/naresh-kamarthy-aa1239130)

---

## 📄 18. License

Distributed under the MIT License. See [LICENSE](file:///C:\Users\Admin\Desktop\AI-Workspace_MERN\collabz-realtime-platform\LICENSE) for more information.
