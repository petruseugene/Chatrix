# Online Chat Server — Requirements

## 1. Introduction

The task is to implement a classic web-based online chat application with support for:

- user registration and authentication
- public and private chat rooms
- one-to-one personal messaging
- contacts/friends
- file and image sharing
- basic moderation and administration features
- persistent message history

The application should represent a typical “classic web chat” experience.

The system is intended for moderate scale and should support up to **300 simultaneously connected users**.

---

## 2. Functional Requirements

### 2.1 User Accounts and Authentication

#### Registration

- email
- password
- unique username

#### Rules

- Email must be unique
- Username must be unique
- Username is immutable
- No email verification required

#### Authentication

- sign in (email + password)
- sign out (only current session)
- persistent login

#### Password Management

- password reset
- password change
- passwords must be hashed

#### Account Removal

- deletes account
- deletes owned rooms + all data inside them
- removes membership in other rooms

---

### 2.2 User Presence and Sessions

#### Statuses

- online
- AFK
- offline

#### AFK Rule

Inactive > 1 minute → AFK

#### Multi-tab logic

- active in ≥1 tab → online
- all inactive → AFK
- all closed → offline

#### Sessions

- view active sessions
- logout selected sessions

---

### 2.3 Contacts / Friends

- friend list
- friend requests (username / from room)
- confirmation required
- remove friends

#### Ban user

- blocks all communication
- freezes chat history
- removes friendship

#### Messaging rule

Only friends (and no bans) can message

---

### 2.4 Chat Rooms

#### Properties

- name (unique)
- description
- public / private
- owner
- admins
- members
- banned users

#### Public rooms

- visible in catalog
- searchable
- free join (if not banned)

#### Private rooms

- invite only

#### Rules

- users can leave
- owner cannot leave (only delete room)

#### Deletion

Deletes:

- all messages
- all files

---

### Roles

#### Admin

- delete messages
- remove users
- ban users
- manage bans
- remove other admins (except owner)

#### Owner

- full control
- delete room

---

### 2.5 Messaging

- text (UTF-8, max 3KB)
- multiline
- emoji
- attachments
- replies

#### Features

- edit messages (with “edited” label)
- delete messages
- persistent history
- infinite scroll

---

### 2.6 Attachments

- images + files
- upload / paste
- original filename preserved
- optional comment

#### Access

- only room members / participants

#### Persistence

- files remain even if user loses access
- deleted only if room is deleted

---

### 2.7 Notifications

- unread indicators (rooms & contacts)
- low latency presence updates

---

## 3. Non-Functional Requirements

### Capacity

- 300 concurrent users
- 1000 users per room
- unlimited rooms per user

### Performance

- message delivery < 3s
- presence updates < 2s
- support 10,000+ messages per room

### Storage

- persistent messages
- infinite scroll history

### Files

- stored locally
- max file: 20MB
- max image: 3MB

### Sessions

- no auto logout
- multi-tab support

### Reliability

- consistent:
  - memberships
  - bans
  - permissions
  - history

---

## 4. UI Requirements

### Layout

- top menu
- center chat
- bottom input
- sidebar (rooms + contacts)

### Chat behavior

- auto-scroll (if at bottom)
- no auto-scroll when reading history
- infinite scroll

### Input

- multiline
- emoji
- attachments
- replies

### Admin UI

- ban/unban
- remove users
- manage admins
- delete messages
- delete room

---

## 5. Notes

- username & email are unique
- username immutable
- room names unique
- public rooms discoverable
- private rooms invite-only
- personal chats = 2 users only
- bans freeze chat history
- deleting room deletes all data
- losing access = no access to messages/files
- files persist unless room deleted
- classic chat UI (not соцсеть)
- offline = no open tabs

---

## 6. Advanced Requirements

### Jabber (XMPP)

- client connections via Jabber
- federation (server-to-server messaging)
- use existing library

### Load test

- 50+ users on server A
- 50+ users on server B
- cross-server messaging

### Admin UI

- federation dashboard
- traffic stats

---

## 7. Submission

- public GitHub repo
- must run via:

```bash
docker compose up
```
