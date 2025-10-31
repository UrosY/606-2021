# Forms Application - Google Forms Clone

A complete web application for creating and managing forms, built with React + TypeScript frontend and Node.js microservices backend.

## Quick Start Guide (For First-Time Setup)

If you're cloning this repository for the first time, follow these steps:

### 1. Prerequisites
Ensure you have installed:
- **Node.js** (v20.19+ or v22.12+) - [Download here](https://nodejs.org/)
- **MySQL** (v8.0+) - [Download here](https://dev.mysql.com/downloads/)
- **npm** (comes with Node.js)

Verify installations:
```bash
node --version    # Should show v20.19+ or v22.12+
mysql --version   # Should show 8.0+
npm --version     # Should show 9.0+
```

### 2. Clone the Repository
```bash
git clone <repository-url>
cd react-proj
```

### 3. Set Up MySQL Database
```bash
# Start MySQL (varies by OS)
# Windows: Start MySQL from Services
# Mac: brew services start mysql
# Linux: sudo systemctl start mysql

# Log into MySQL
mysql -u root -p

# Create database and tables (run SQL from section "Database Setup" below)
```

### 4. Configure Backend
Edit database credentials in:
- `backend/auth-service/db.js`
- `backend/forms-service/db.js`

Update with your MySQL credentials:
```javascript
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',           // Your MySQL username
  password: 'your_password',  // Your MySQL password
  database: 'forms_app'
});
```

### 5. Install All Dependencies
From the project root, run:
```bash
npm run install:all
```
This installs dependencies for auth-service, forms-service, and frontend.

### 6. Start All Services
```bash
npm run dev
```

This starts:
- **Auth Service**: http://localhost:3001
- **Forms Service**: http://localhost:3002
- **Frontend**: http://localhost:5173 (or next available port)

### 7. Open the Application
Navigate to http://localhost:5173 in your browser and register a new account!



### 8. How to run e2e tests [link](frontend/cypress/README.md)
