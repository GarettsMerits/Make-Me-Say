# dont-make-me-say

A portfolio project showcasing web development skills with AI integration and security features.

## Project Structure

```
├── frontend/          # React + TypeScript frontend
├── backend/           # Service layer (Express prototype, migrating to ASP.NET Core Web API)  
├── database/          # MySQL schema and migrations
├── .github/           # CI/CD workflows
└── Documentation/     # Project documentation
```

## Getting Started

### Prerequisites
- Node.js 18+
- MySQL 8.0+
- Git

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd "dont-make-me-say"
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Edit .env with your configuration
   npm run dev
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   npm start
   ```

4. **Database Setup**
   ```bash
   mysql -u root -p < database/schema.sql
   ```

## Current Status

✅ **Week 1 Complete** (August 2025)
- Project structure created
- Backend API with authentication gate
- Frontend React TypeScript setup
- MySQL database schema
- CI/CD pipeline configured
- Security middleware implemented

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Zustand, Framer Motion
- **Backend**: ASP.NET Core 8 Web API (Node/Express prototype currently active until migration completes)
- **Security**: Helmet, CORS, Rate Limiting, JWT (plus future Cloudflare/Turnstile hardening)
- **Database**: MySQL 8.0
- **DevOps**: GitHub Actions, Docker (planned)

## API Endpoints

- `GET /health` - Health check
- `POST /api/auth/verify` - Passphrase verification
- `GET /api/target-word` - Get current target word
- `POST /api/chat` - LLM chat interaction
- `GET /api/leaderboard` - Get leaderboard
- `POST /api/leaderboard` - Submit score

## Security Features

- Rolling monthly passphrase system
- Rate limiting for DDoS protection
- Security headers via Helmet
- CORS configuration
- Input validation

## License

Private portfolio project