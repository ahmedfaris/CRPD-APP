# User Role Management System Documentation

## Overview
The User Role Management system is a highly secure, enterprise-grade module designed to handle the creation, assignment, and auditing of administrative roles within the application. It features a bilingual React frontend (English/Arabic), a Node.js/Express backend API, and a robust PostgreSQL database architecture.

## 1. Core Features

### 1.1. Role Administration
- **Create & Edit Roles:** Administrators can define custom roles and assign fine-grained permissions across different application modules (e.g., Ticket Management, Electronic Archiving).
- **Users Assigned View:** Administrators can instantly see how many users are assigned to a specific role. Clicking the user count opens a detailed modal listing the assigned users (names, emails, avatars).
- **Impact Warnings:** Before saving edits to a role that is already in use, the system displays a confirmation warning showing the exact number of users who will be affected by the permission changes.

### 1.2. Soft Deletion Protocol
- **Safe Deletes:** Roles cannot be deleted if they are currently assigned to one or more active users.
- **Soft Deletion:** When a role is deleted, it is not permanently erased from the database. Instead, it is marked as `isDeleted`.
- **Read-Only State:** Deleted roles remain visible in the UI (styled with a grey, strikethrough appearance and a "Deleted" badge) for historical auditing but cannot be edited, re-assigned, or deleted again.

### 1.3. Enterprise Audit Logging
- **Action Tracking:** Every lifecycle event of a role (CREATE, EDIT, DELETE) is securely logged in the database.
- **Audit UI (Role Info):** An "Info" button on each role displays a timeline-based history, showing exactly *who* created, edited, or deleted the role, along with exact timestamps.

## 2. Security Architecture

The module implements strict server-side security protocols:

- **CSRF Protection (Anti-Forgery):** All state-modifying endpoints (POST, PUT, DELETE) require a strict `X-App-Action: strict-client-action` header.
- **Input Sanitization (XSS Prevention):** Incoming data payloads are processed through `sanitize-html` to strip malicious scripts or HTML tags at the controller level before further processing.
- **Complex Validation (Zod):** 
  - Role names are strictly limited to a maximum of 20 characters.
  - Regex validation ensures that only English letters, Arabic letters, and spaces are permitted (numbers and special characters are explicitly rejected).
- **Authorization:** All endpoints are protected by an administrative middleware (`requireAdmin`), ensuring only users with the `Admin` role can perform these actions.

## 3. Database Schema

### `roles` Table
- `id` (Serial, Primary Key)
- `name` (Text, Unique) - e.g., "IT Support"
- `permissions` (Text Array) - e.g., `["Ticket Management.View", "Ticket Management.Edit"]`
- `createdBy` (FK -> users.uid) - Tracks original creator
- `isDeleted` (Boolean) - Default: false
- `deletedAt` (Timestamp) - Records exact time of soft deletion
- `deletedBy` (FK -> users.uid) - Tracks who deleted the role

### `role_audit_logs` Table
- `id` (Serial, Primary Key)
- `roleId` (FK -> roles.id)
- `action` (Text) - 'CREATE', 'EDIT', or 'DELETE'
- `performedBy` (FK -> users.uid)
- `details` (Text) - Brief description of the action
- `createdAt` (Timestamp) - Automatically recorded on insert

## 4. API Endpoints (`/api/roles`)

- **`GET /api/roles`**: Fetches all roles, enriches them with assigned user arrays, creator/deleter information, and a sorted array of audit logs.
- **`POST /api/roles`**: Validates, sanitizes, and creates a new role. Generates a 'CREATE' audit log.
- **`PUT /api/roles/:id`**: Validates, sanitizes, and updates an existing role. Blocks edits if the role is soft-deleted. Generates an 'EDIT' audit log.
- **`DELETE /api/roles/:id`**: Verifies no users are currently assigned. Marks the role as `isDeleted` and stamps `deletedAt`/`deletedBy`. Generates a 'DELETE' audit log.
