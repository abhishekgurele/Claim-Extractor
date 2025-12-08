# ClaimScan - AI Document Processing Application

## Overview

ClaimScan is an AI-powered document processing application that extracts structured data from insurance claims documents. Users upload PDF or image files, which are processed using Google's Gemini AI to extract relevant claims information. The extracted data can be reviewed, edited, and exported in JSON format.

**Core Workflow:**
1. Upload insurance claims documents (PDF, PNG, JPG)
2. AI processes document and extracts structured fields (policy numbers, claim amounts, dates, etc.)
3. Review extracted data with confidence indicators
4. Edit fields as needed
5. Export to JSON format

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework:** React with TypeScript using Vite as the build tool

**UI Components:** 
- Shadcn/ui component library with Radix UI primitives
- TailwindCSS for styling with custom design system
- Design follows Material Design and modern productivity tool patterns (Linear, Notion, Asana)
- Theme support with light/dark modes

**State Management:**
- React Query (@tanstack/react-query) for server state
- Local component state for UI interactions
- No global state management library

**Routing:** Wouter for lightweight client-side routing

**Key Design Principles:**
- Data clarity first: Scannable information display
- Progressive disclosure: Show complexity only when needed
- Workflow efficiency: Minimal steps from upload to export
- Trust and transparency: Clear confidence indicators for AI extractions

### Backend Architecture

**Framework:** Express.js with TypeScript

**Server Structure:**
- Single Express server handling both API routes and static file serving
- Development mode uses Vite middleware for HMR
- Production mode serves pre-built static assets

**File Processing:**
- Multer for handling multipart/form-data file uploads
- 10MB file size limit
- Supported formats: PDF, PNG, JPG/JPEG
- Files processed in-memory (no disk storage)

**API Endpoints:**
- `POST /api/documents/process` - Upload and process document with AI

**Build System:**
- esbuild for server bundling
- Vite for client bundling
- Selective dependency bundling to optimize cold start times

### Data Storage Solutions

**Current Implementation:** In-memory storage using Map-based MemStorage class

**Schema Definition:** Drizzle ORM with Zod validation schemas

**Database Configuration:** PostgreSQL setup ready via Drizzle (not currently active)

**Data Models:**
- User (basic authentication support)
- Document (file metadata and processing status)
- ExtractedField (AI-extracted data with confidence levels)

**Note:** Application currently uses in-memory storage but has infrastructure for PostgreSQL database migration when needed.

### AI Processing

**Provider:** Google Gemini AI (via @google/genai SDK)

**Model Recommendation:** gemini-2.5-flash or gemini-2.5-pro (specified in code comments)

**Extraction Process:**
1. Convert uploaded file to base64
2. Send to Gemini with structured extraction prompt
3. Parse JSON response into ExtractedField objects
4. Return fields with confidence levels (high/medium/low)

**Extracted Field Types:**
- Policy information (policy number, claim number)
- Dates (claim date, incident date, treatment date)
- Amounts (claim amount)
- Personal information (claimant name, address, phone, email)
- Incident details (description, location)
- Vehicle information (if applicable)
- Medical information (diagnosis codes, provider details, NPI)

**Error Handling:** Graceful fallback with error messages for missing API keys or processing failures

### External Dependencies

**Third-Party Services:**
- Google Gemini AI API (requires GEMINI_API_KEY environment variable)

**Major NPM Packages:**
- React ecosystem: react, react-dom, @tanstack/react-query
- UI components: @radix-ui/* (multiple components), lucide-react (icons)
- Backend: express, multer, drizzle-orm, zod
- Development: vite, typescript, tailwindcss, esbuild
- Database: pg (PostgreSQL driver), connect-pg-simple (session storage)
- Utilities: date-fns, nanoid, class-variance-authority, clsx

**Configuration Management:**
- Environment variables for sensitive data (DATABASE_URL, GEMINI_API_KEY)
- TypeScript path aliases for clean imports (@/, @shared/, @assets/)

**Authentication Infrastructure:**
- Basic user schema defined but not actively used
- Session management libraries included (express-session, passport, passport-local)
- Ready for authentication implementation when needed

### Underwriting Agent

**Purpose:** Assess insurance applications for individuals and companies using rule-based risk evaluation

**Page:** `/underwriting`

**Features:**
- Single application analysis with forms for individual or company data
- Bulk analysis: Generate 100+ random applications and analyze in batch
- Risk tier assignment: Preferred, Standard, Substandard, Decline
- Premium recommendation calculation based on risk factors
- Triggered signals with severity levels (critical, warning, info)

**Individual Risk Rules (UW001-UW012):**
- Age-based risk (elderly, young drivers)
- Credit score thresholds
- Smoking status and BMI
- Chronic conditions
- Hazardous hobbies
- Previous claims history

**Company Risk Rules (UW101-UW112):**
- Years in business
- Industry risk classification
- OSHA incident history
- Loss ratio analysis
- Safety certifications
- Liquidity and financial stability

**API Endpoints:**
- `POST /api/underwriting/analyze` - Analyze single application
- `GET /api/underwriting/sample-data` - Get sample individual/company data
- `GET /api/underwriting/generate-bulk?count=100&type=individual|company` - Generate random applications
- `POST /api/underwriting/analyze-bulk` - Bulk analysis with summary stats

**Key Files:**
- `shared/schema.ts` - Underwriting types and Zod schemas
- `server/underwriting-engine.ts` - Risk rules and analysis logic
- `client/src/pages/underwriting.tsx` - UI page