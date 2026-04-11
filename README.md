# StageSuite

StageSuite is a rehearsal operations platform for theatre organisations.  
It centralises production workflows — scheduling, communication, and coordination — so cast and crew always know what’s happening and when.

---

## Overview

StageSuite replaces fragmented tools (group chats, spreadsheets, emails) with a single, role-aware platform tailored for theatre production teams.

Users interact with production-specific dashboards that surface only what they need, based on their role.

---

## Core Features

### Authentication & Access
- Email/password authentication
- Social sign-in (Google, Apple)
- Organisation-aware SSO routing
- Role-based access control across productions

### Organisations & Onboarding
- Create and manage organisations
- Guided onboarding flow for new users
- Invite-based access with secure join links

### Productions
- Create and manage multiple productions
- Switch between production dashboards
- Role-specific views (Director, Cast, Crew, etc.)

### Dashboard
- Personalised production dashboard
- Upcoming rehearsals overview
- Announcements feed
- File access and visibility controls
- Conflict submission tracking

### Communication
- Post announcements with role-based visibility
- Centralised updates (no more WhatsApp chaos)

### File Management
- Upload and share production files
- Role-based visibility controls
- Recent files panel for quick access

### Scheduling (Current)
- Manual rehearsal block creation
- Conflict collection from cast & crew
- Centralised schedule visibility
- Automatically generate optimal rehearsal schedules

### Production Management
- Manage members and roles
- Configure production details (venue, dates, etc.)
- Director-role customisation

### Attendance Tracking
- Rehearsal check-ins
- Absence tracking and reporting

---

## Planned Features

### Task Management
- Assign and track tasks across production teams

### Notifications
- Email and push notifications
- Alerts for schedule updates and announcements

### File System Enhancements
- Tagging and search
- Versioning and history

### Advanced Production Management
- Budget tracking
- Audition management
- Role templates per organisation

---

## Tech Stack

- **Frontend:** Next.js (App Router), React, Tailwind CSS  
- **Backend:** Next.js Server Actions / API routes  
- **Database:** PostgreSQL (Prisma ORM)  
- **Auth:** Custom auth (Better Auth / NextAuth-style)  
- **Hosting:** Azure (Container Apps / Static Web Apps)  
- **CI/CD:** GitHub Actions
