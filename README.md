# College Appointment API

A role-based backend API for scheduling appointments between professors and students.

The service supports user registration, JWT login, professor availability management, student appointment booking, appointment cancellation, and updating an existing free availability slot. It runs with MongoDB locally and can connect to Amazon DocumentDB when deployed on EC2.

## What This Project Does

- Registers students and professors
- Authenticates users with JWT tokens
- Allows professors to create free appointment slots
- Allows students to view free professor slots
- Allows students to book appointments
- Allows professors to update an existing free slot without deleting it
- Allows professors to cancel booked appointments for a student
- Keeps cancelled appointments in the database with status `cancelled`
- Returns consistent JSON error messages

## Core Workflow

```mermaid
flowchart TD
    A[Client or Postman request] --> B[Express app in index.js]
    B --> C[Security and request middleware]
    C --> D{Route group}
    D --> E[/users]
    D --> F[/professor]
    D --> G[/general]
    E --> H[Register, login, profile]
    F --> I[JWT check]
    I --> J[Professor role check]
    J --> K[Create, update, or cancel]
    G --> L[JWT check]
    L --> M{Student-only route?}
    M -->|Yes| N[Student role check]
    M -->|No| O[Availability lookup]
    N --> P[Book or view appointments]
    K --> Q[Mongoose models]
    O --> Q
    P --> Q
    Q --> R[MongoDB or Amazon DocumentDB]
    R --> S[JSON response]
```

## Business Logic

The project separates free professor time from booked appointments.

```text
Availability = a free time window opened by a professor
Appointment  = a student booking inside a professor's available time
```

Important behavior:

- Creating availability adds one or more `Availability` documents.
- Booking creates an `Appointment` document.
- Booking does not delete the availability document.
- Availability lookup hides slots that already contain a booked appointment.
- Cancelling an appointment changes its status to `cancelled`.
- Updating a free slot changes the same `Availability` document.
- Updating availability does not reschedule booked appointments.
- Students cannot create, update, or cancel professor availability.
- Professors can update only their own availability slots.

## Tech Stack

| Area | Technology |
| --- | --- |
| Runtime | Node.js |
| Server | Express |
| Database ODM | Mongoose |
| Database | MongoDB / Amazon DocumentDB |
| Authentication | JWT |
| Password hashing | bcryptjs |
| Security middleware | Helmet |
| Logging | Morgan |
| CORS | cors |
| Config | dotenv |
| Test runner | Jest |

## Project Structure

```text
.
|-- index.js
|-- package.json
|-- package-lock.json
|-- .env.example
|-- .gitignore
|-- controllers/
|   |-- user.js
|   |-- proff.js
|   `-- general.js
|-- middleware/
|   |-- auth.js
|   `-- error.js
|-- models/
|   |-- user.js
|   |-- availability.js
|   |-- appointment.js
|   `-- error.js
`-- routes/
    |-- user.js
    |-- proff.js
    `-- general.js
```

## File Responsibilities

| Path | Purpose |
| --- | --- |
| `index.js` | Loads config, sets Express middleware, mounts routes, connects to MongoDB/DocumentDB, starts the server |
| `routes/user.js` | Maps user endpoints: register, login, profile |
| `routes/proff.js` | Maps professor endpoints: availability creation, free-slot update, appointment cancellation |
| `routes/general.js` | Maps shared/student endpoints: view availability, book appointment, view student appointments |
| `controllers/user.js` | Handles registration, password hashing, login, JWT creation, and profile lookup |
| `controllers/proff.js` | Handles professor availability rules, overlap checks, ownership checks, and cancellations |
| `controllers/general.js` | Handles free-slot lookup, student booking, duplicate-booking checks, and pending appointment list |
| `middleware/auth.js` | Verifies JWT tokens and checks professor/student roles |
| `middleware/error.js` | Handles unknown routes and formats API errors |
| `models/user.js` | Defines users with `student` and `professor` roles |
| `models/availability.js` | Defines professor free slots with start/end date validation |
| `models/appointment.js` | Defines bookings, status values, and booking indexes |
| `models/error.js` | Defines the `HttpError` helper used across controllers |
| `.env.example` | Safe placeholder template for local and deployment config |
| `.gitignore` | Keeps secrets, dependencies, logs, and local-only files out of Git |

## Data Models

### User

Stores account details and role.

| Field | Meaning |
| --- | --- |
| `name` | User display name |
| `email` | Unique lowercase login email |
| `password` | bcrypt-hashed password |
| `role` | `student` or `professor` |

### Availability

Stores free time created by a professor.

| Field | Meaning |
| --- | --- |
| `professorId` | Professor who owns the slot |
| `startTime` | Slot start time |
| `endTime` | Slot end time; must be after `startTime` |

### Appointment

Stores a student booking.

| Field | Meaning |
| --- | --- |
| `studentId` | Student who booked the appointment |
| `professorId` | Professor being booked |
| `time` | Appointment time |
| `status` | `booked`, `completed`, or `cancelled` |

## API Summary

### User Routes

| Method | Endpoint | Auth | What it does | Returns |
| --- | --- | --- | --- | --- |
| `POST` | `/users/register` | Public | Creates a student or professor | Created user without password |
| `POST` | `/users/login` | Public | Logs in an existing user | JWT token, user id, name, role |
| `GET` | `/users/profile/:id` | Token | Fetches a user profile | User profile without password |

### Professor Routes

| Method | Endpoint | Auth | What it does | Returns |
| --- | --- | --- | --- | --- |
| `POST` | `/professor/availability` | Professor token | Creates one or more free slots | Created availability list |
| `PATCH` | `/professor/availability/:availabilityId` | Professor token | Updates an existing free slot | Updated availability |
| `PATCH` | `/professor/cancel-appointments/:studentId` | Professor token | Cancels booked appointments with a student | Cancel message and count |

### General / Student Routes

| Method | Endpoint | Auth | What it does | Returns |
| --- | --- | --- | --- | --- |
| `GET` | `/general/professor/:professorId/availability` | Token | Lists future free slots for a professor | `availableSlots` |
| `POST` | `/general/book` | Student token | Books a student appointment | Created appointment |
| `GET` | `/general/appointments` | Student token | Lists pending student appointments | Appointment list or empty array |

## Endpoint Behavior

| Endpoint | Required body | Main validations |
| --- | --- | --- |
| `POST /users/register` | `name`, `email`, `password`, `confirmPassword`, `role` | required fields, unique email, matching passwords, valid role |
| `POST /users/login` | `email`, `password` | valid credentials |
| `POST /professor/availability` | `startTime`, `endTime` or an array of slots | valid dates, start before end, no overlapping availability |
| `PATCH /professor/availability/:availabilityId` | `startTime`, `endTime` | ownership, free slot only, no booked appointment, no overlap |
| `POST /general/book` | `professorId`, `time` | professor exists, time is inside availability, time is not already booked |

Common response patterns:

- Login returns `token`, `id`, `name`, and `role`.
- Availability APIs return slot id, professor name, `startTimeUtc`, and `endTimeUtc`.
- Booking returns appointment id, student name, professor name, UTC time, and status.
- Empty student appointment lookup returns `appointments: []`.
- Errors return `{ "message": "..." }`.

## Local Setup

Requirements:

- Node.js
- npm
- MongoDB
- Postman or another REST client

Install dependencies:

```bash
npm install
```

Create a local config file:

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

Fill the local `.env` file with the required values from `.env.example`.

Start development server:

```bash
npm run dev
```

Start normal server:

```bash
npm start
```

Base URL:

```text
http://localhost:5001
```

## EC2 and DocumentDB Run

The same API can run on EC2 and connect to Amazon DocumentDB when `USE_DOCDB=true`.

Basic EC2 commands:

```bash
sudo dnf update -y
sudo dnf install -y git nodejs npm
git clone <repository-url>
cd UnQue-2.0-main
npm ci --omit=dev
cp .env.example .env
```

Download the Amazon trust bundle for DocumentDB TLS:

```bash
curl -fsSLo global-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
```

Start:

```bash
npm start
```

Background run:

```bash
nohup npm start > app.log 2>&1 &
tail -f app.log
```

EC2 URL format:

```text
http://<EC2_PUBLIC_IPV4>:5001
```

Network checklist:

- EC2 allows inbound access to the API port.
- EC2 can reach DocumentDB on port `27017`.
- DocumentDB security group allows inbound `27017` from the EC2 security group.
- DocumentDB connection string includes `retryWrites=false`.
- `DOCDB_CA_FILE` points to the downloaded `global-bundle.pem`.

## Postman Checks

Create Postman variables:

```text
baseUrl=http://localhost:5001
professorToken=
studentToken=
professorId=
studentId=
availabilityId=
```

Suggested flow:

1. Register professor and student.
2. Login both users and save tokens.
3. Create professor availability with professor token.
4. View professor availability with any valid token.
5. Book an appointment with student token.
6. Confirm booked slot no longer appears as free.
7. Update another free availability slot with professor token.
8. Cancel the student's appointment with professor token.
9. Confirm student appointments returns an empty list.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start with Nodemon |
| `npm start` | Start with Node |
| `npm test` | Run Jest |

## Security Notes

- Keep real `.env` files out of Git.
- Commit `.env.example` only as a placeholder template.
- Store only hashed passwords.
- Use HTTPS or restricted networks for deployed API access.
- Keep DocumentDB private and reachable only from EC2.
- Do not expose JWT secrets, database passwords, AWS keys, or private keys.

## Troubleshooting

| Problem | Check |
| --- | --- |
| Server exits on startup | `JWT_SECRET` and `MONGO_URL` are set |
| Login fails | Email exists and password is correct |
| Token rejected | Header is `Authorization: Bearer <token>` |
| Professor route returns 403 | Token belongs to a professor user |
| Booking route returns 403 | Token belongs to a student user |
| Availability update fails | Slot is free, owned by professor, and does not overlap another slot |
| DocumentDB connection fails | Security groups, TLS bundle, credentials, and `retryWrites=false` |
