# Website Monitor

A modern Next.js 15 application for monitoring and managing websites with comprehensive traffic analytics, site evaluation, and performance tracking capabilities.

**Status**: Development | **Last Updated**: November 8, 2025

## Project Structure

```
website-monitor/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/             # API routes
│   │   │   ├── sites/       # Site management endpoints
│   │   │   ├── evaluations/ # Site evaluation endpoints
│   │   │   ├── traffic/     # Traffic analytics endpoints
│   │   │   └── health/      # Health check endpoint
│   │   ├── layout.tsx       # Root layout
│   │   ├── page.tsx         # Home page
│   │   └── globals.css      # Global Tailwind styles
│   ├── components/          # Reusable React components
│   ├── lib/                 # Core utilities
│   │   ├── services/        # Business logic
│   │   │   ├── sites.service.ts
│   │   │   ├── traffic.service.ts
│   │   │   ├── evaluations.service.ts
│   │   │   └── ...
│   │   ├── types/           # TypeScript type definitions
│   │   ├── utils/           # Helper utilities
│   │   └── prisma.ts        # Prisma client singleton
│   └── middleware/          # Request middleware
├── prisma/
│   └── schema.prisma        # Database schema (PostgreSQL)
├── public/                  # Static assets
├── docs/                    # Documentation
├── .env.local.example       # Environment template
├── .eslintrc.json           # ESLint configuration
├── next.config.ts           # Next.js configuration
├── package.json             # Dependencies and scripts
├── postcss.config.js        # PostCSS configuration
├── tailwind.config.ts       # Tailwind CSS configuration
└── tsconfig.json            # TypeScript configuration
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm, yarn, or pnpm

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up your environment variables:
```bash
cp .env.local.example .env.local
```

3. Set up the database:
```bash
npm run prisma:generate
npm run prisma:migrate
```

### Development

Run the development server:
```bash
npm run dev
```

Open [http://localhost:3030](http://localhost:3030) in your browser (the app runs on port 3030).

## Available Scripts

```bash
# Development
npm run dev              # Start development server (http://localhost:3030)
npm run lint            # Run ESLint code quality checks

# Database
npm run prisma:generate # Generate/regenerate Prisma client
npm run prisma:migrate  # Run pending database migrations
npm run prisma:studio   # Open Prisma Studio for database management

# Type Checking (preferred over npm run build)
npx tsc --noEmit       # Check for TypeScript errors without emitting
```

**Note**: Use `npx tsc --noEmit` for type checking instead of `npm run build`.

## How to Use

### Quick Start
1. Clone the repository and install dependencies
2. Configure your `.env.local` file with database and API credentials
3. Set up the database with Prisma migrations
4. Run `npm run dev` to start the development server
5. Open http://localhost:3030 in your browser

### Main Features

**Site Management**
- Add and manage websites you want to monitor
- Track site metadata and configuration
- Monitor multiple websites from a single dashboard

**Traffic Analytics**
- View real-time traffic metrics (page views, visitors, sessions)
- Analyze bounce rates and user behavior
- Identify traffic trends and patterns
- Detect anomalies in traffic data

**Site Evaluation**
- Multi-dimensional scoring system for site quality assessment
- Evaluate sites across market, quality, SEO, traffic, and revenue dimensions
- Generate comparative leaderboards across different metrics
- Track performance changes over time

**Data Integration**
- Connect with Google Analytics for comprehensive traffic data
- Proxy support for secure data access through corporate networks
- Automatic data synchronization and caching

## Core Features

### Application Features
- **Site Management** - Create, update, and manage website entries
- **Traffic Analytics** - Track page views, unique visitors, sessions, and bounce rates
- **Site Evaluations** - Multi-dimensional scoring system (market, quality, SEO, traffic, revenue)
- **Leaderboards** - Rank sites by various metrics and dimensions
- **Traffic Anomaly Detection** - Identify unusual traffic patterns
- **Google Analytics Integration** - Connect to Google Analytics for data retrieval

### Technical Features
- **Next.js 15** - Latest React framework with App Router
- **TypeScript** - Full type safety with strict mode
- **Tailwind CSS** - Modern utility-first styling
- **Prisma ORM** - Type-safe database access with PostgreSQL
- **React 19** - Latest React capabilities
- **ESLint** - Code quality and consistency
- **CVA** - Component variant system
- **Decimal.js** - Precise number handling for financial data

## Environment Variables & Configuration

Create a `.env.local` file based on `.env.example`:

```env
# Database Configuration
DATABASE_URL="postgresql://user:password@localhost:5432/website_monitor?schema=website_manager"

# Application Configuration
NEXT_PUBLIC_API_URL="http://localhost:3030"
NODE_ENV="development"

# Proxy Configuration (optional, for accessing Google APIs through corporate proxy)
HTTP_PROXY="http://localhost:7890"
HTTPS_PROXY="http://localhost:7890"
```

### Google Analytics (GA) Configuration

1. **Create a Google Cloud Service Account**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new service account with "Editor" role
   - Download the service account key as JSON

2. **Save the key file**:
   - Name it `google-cloud-acount.json` (note the typo - it matches the code)
   - Or name it `google-cloud-account.json` (the code checks both)
   - Place it in the project root directory
   - It will be automatically ignored by git (see `.gitignore`)

3. **Enable required APIs**:
   - Enable "Google Analytics Data API" in your Google Cloud project
   - Enable "Google Analytics Reporting API"

4. **Add GA Property ID**:
   - Go to [Google Analytics](https://analytics.google.com/)
   - Find your Property ID (looks like: 123456789)
   - You can configure properties/sites through the application UI

### Google Search Console (GSC) Configuration

1. **Use the same service account**:
   - The application uses the same `google-cloud-acount.json` file
   - Or use `gsc-mcp-service-account.json` for MCP integration

2. **Grant Search Console access**:
   - Go to [Google Search Console](https://search.google.com/search-console)
   - Add the service account email (from the JSON file) as a property owner
   - This grants the service account permission to access your search data

3. **Verify site ownership**:
   - Add your website properties in Google Search Console
   - The service account needs access to each property you want to monitor

### File Locations

```
project-root/
├── google-cloud-acount.json          # GA & GSC service account key
├── gsc-mcp-service-account.json      # Alternative GSC key for MCP
└── .env.local                        # Environment variables (ignored by git)
```

**Note**: Service account key files are automatically ignored by git and should never be committed.

## Database Setup

1. Update `prisma/schema.prisma` with your data models
2. Run migrations: `npm run prisma:migrate`
3. Use Prisma Studio to manage data: `npm run prisma:studio`

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

## License

MIT
