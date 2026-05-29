# Punjab Finance HR Incumbency System

Enterprise MERN stack incumbency management system for the Government of Punjab Finance Department.

## Product Architecture

### Core Domains

- Organization hierarchy: wings, offices, sections, sub-sections
- Designations and BPS/grade catalog
- Seat/post management with vacancy and additional charge tracking
- Employee master profile with service and contact data
- Posting history, transfers, leave, retirement, death, resignation
- Printable and exportable reports
- Role-based administration and audit logging

### Backend Layers

- `config`: MongoDB connection and app bootstrap helpers
- `controllers`: route logic for auth, users, employees, hierarchy, seats, workflows, reports
- `models`: Mongoose schemas for all entities
- `routes`: REST endpoints grouped by module
- `middleware`: auth, role checks, and centralized error handling
- `utils`: shared response helpers, async wrapper, logging, query helpers, seat workflow helpers

### Frontend Layers

- `components/layout`: sidebar, topbar, page headers
- `components/common`: reusable table, badges, dialogs, search, print helpers
- `components/forms`: employee and master-data forms
- `pages`: dashboard, CRUD pages, reports, settings, roles
- `services`: API wrappers
- `context` and `hooks`: auth/session and data hooks

## Database Schema Design

### `User`

- `fullName`, `email`, `passwordHash`, `role`, `isActive`, `lastLoginAt`

### `Wing`

- `name`, `code`, `description`, `sortOrder`, `isActive`

### `OfficeSection`

- `name`, `code`, `parentOfficeSection`, `wing`, `ancestors`, `level`, `description`, `displayOrder`, `isActive`

### `Designation`

- `name`, `bps`, `category`, `sortOrder`, `isActive`

### `Seat`

- `seatTitle`, `designation`, `officeSection`, `wing`, `bps`, `seatStatus`, `currentEmployee`, `additionalChargeHolder`, `remarks`, `isActive`

### `Employee`

- Personal: `fullName`, `fatherName`, `cnic`, `dateOfBirth`, `gender`, `domicile`, `district`
- Service: `personnelNumber`, `designation`, `bps`, `employeeType`, `employmentStatus`, joining dates
- Contact: `mobileNumber`, `whatsappNumber`, `email`, `address`
- Posting: `currentWing`, `currentOfficeSection`, `currentSeat`, `currentDesignation`, `remarks`
- Media: `profilePhoto`, `attachments`
- Lifecycle: `isArchived`, `archivedAt`

### Workflow Collections

- `PostingHistory`
- `TransferRecord`
- `LeaveRecord`
- `AdditionalCharge`
- `ActivityLog`

## API Routes List

### Auth

- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`

### Users

- `GET /api/v1/users`
- `POST /api/v1/users`
- `GET /api/v1/users/:id`
- `PUT /api/v1/users/:id`
- `PATCH /api/v1/users/:id/status`
- `PATCH /api/v1/users/:id/role`
- `DELETE /api/v1/users/:id`

### Employees

- `GET /api/v1/employees`
- `POST /api/v1/employees`
- `GET /api/v1/employees/:id`
- `PUT /api/v1/employees/:id`
- `DELETE /api/v1/employees/:id`
- `PATCH /api/v1/employees/:id/status`

### Wings

- `GET /api/v1/wings`
- `POST /api/v1/wings`
- `GET /api/v1/wings/:id`
- `PUT /api/v1/wings/:id`
- `DELETE /api/v1/wings/:id`

### Offices / Sections

- `GET /api/v1/offices`
- `GET /api/v1/offices/tree`
- `POST /api/v1/offices`
- `GET /api/v1/offices/:id`
- `PUT /api/v1/offices/:id`
- `DELETE /api/v1/offices/:id`

### Designations

- `GET /api/v1/designations`
- `POST /api/v1/designations`
- `GET /api/v1/designations/:id`
- `PUT /api/v1/designations/:id`
- `DELETE /api/v1/designations/:id`

### Seats

- `GET /api/v1/seats`
- `GET /api/v1/seats/vacant`
- `POST /api/v1/seats`
- `GET /api/v1/seats/:id`
- `PUT /api/v1/seats/:id`
- `PATCH /api/v1/seats/:id/assign`
- `PATCH /api/v1/seats/:id/vacate`
- `PATCH /api/v1/seats/:id/additional-charge`

### Transfers

- `GET /api/v1/transfers`
- `POST /api/v1/transfers`
- `GET /api/v1/transfers/:id`

### Leave

- `GET /api/v1/leaves`
- `POST /api/v1/leaves`
- `GET /api/v1/leaves/:id`
- `PUT /api/v1/leaves/:id`
- `PATCH /api/v1/leaves/:id/approve`

### Additional Charge

- `GET /api/v1/additional-charges`
- `POST /api/v1/additional-charges`
- `GET /api/v1/additional-charges/:id`
- `PUT /api/v1/additional-charges/:id`
- `PATCH /api/v1/additional-charges/:id/end`

### Reports

- `GET /api/v1/reports/dashboard`
- `GET /api/v1/reports/incumbency`
- `GET /api/v1/reports/vacant-seats`
- `GET /api/v1/reports/additional-charge`
- `GET /api/v1/reports/transfers`
- `GET /api/v1/reports/leaves`
- `GET /api/v1/reports/retirements-due`
- `GET /api/v1/reports/summary/:dimension`

## UI Page Structure

1. Login Page
2. Dashboard
3. Employees
4. Add Employee
5. Employee Detail Page
6. Edit Employee
7. Wings
8. Offices / Sections
9. Designations
10. Seats / Posts
11. Vacant Seats
12. Additional Charge
13. Transfers
14. Leave Management
15. Reports
16. Print Layouts
17. Settings
18. Users & Roles

## Development Plan

1. Project setup
2. Backend server bootstrap
3. MongoDB connection
4. Auth and RBAC
5. Core models
6. Employee CRUD
7. Office hierarchy CRUD
8. Designation CRUD
9. Seat management
10. Transfer workflow
11. Additional charge workflow
12. Leave workflow
13. Reporting and print layouts
14. Dashboard analytics
15. Final UI polish

