# Design Guidelines: Claims Document Processing Application

## Design Approach
**System-Based Approach** - Inspired by Material Design and modern productivity tools (Linear, Notion, Asana)
- Rationale: Utility-focused application prioritizing efficiency, data clarity, and workflow optimization
- Focus on clean information hierarchy, clear status indicators, and streamlined data review

## Core Design Principles
1. **Data Clarity First**: All extracted information must be immediately scannable
2. **Progressive Disclosure**: Show complexity only when needed
3. **Workflow Efficiency**: Minimize steps between upload and export
4. **Trust & Transparency**: Clear confidence indicators and validation states

## Typography System
- **Primary Font**: Inter or IBM Plex Sans (via Google Fonts)
- **Hierarchy**:
  - Page titles: text-2xl font-semibold
  - Section headers: text-lg font-medium
  - Data labels: text-sm font-medium uppercase tracking-wide
  - Body/values: text-base font-normal
  - Helper text: text-sm text-muted

## Layout & Spacing
**Tailwind spacing units**: Consistently use 2, 4, 6, 8, 12, 16, 24 units
- Component padding: p-6 to p-8
- Section spacing: gap-8 to gap-12
- Card spacing: p-6
- Form elements: space-y-4
- Grid gaps: gap-6

## Component Library

### 1. Upload Zone (Hero Section)
- Large dropzone area (min-h-96) with dashed border
- Center-aligned upload icon (w-16 h-16) and instructional text
- "Browse files" button with backdrop-blur-md background
- Supported format indicators below
- Active drag state with visual feedback

### 2. Processing Status Bar
- Horizontal progress indicator showing current stage
- Steps: Upload → AI Processing → Review → Export
- Active step highlighted, completed steps with check icons
- Estimated time remaining during processing

### 3. Review Grid (Primary Interface)
**Two-column layout for extracted fields:**
- Left column: Field labels (w-1/3)
- Right column: Editable values with input fields (w-2/3)
- Each row includes:
  - Confidence badge (High/Medium/Low) with icon
  - Edit icon on hover
  - Validation indicator (checkmark or warning)

**Grid Specifications:**
- Alternating row backgrounds for scannability
- Sticky header row
- Fixed height with scroll (max-h-[600px])
- Minimum 12 common claim fields displayed

### 4. Document Preview Panel
- Fixed sidebar (w-96) showing uploaded document thumbnail
- Page navigation for multi-page PDFs
- Zoom controls
- Filename and file size display

### 5. Action Buttons
**Primary actions:**
- "Export JSON" (prominent, top-right)
- "Upload New Document" (secondary)
- "Edit Fields" toggle (when in read-only mode)

**Button styling:**
- Primary: Solid with slight shadow
- Secondary: Outline style
- All buttons: rounded-lg, px-6 py-3

### 6. Confidence Indicators
- Badge component with icon + text
- High: Checkmark icon
- Medium: Info icon
- Low: Warning icon
- Positioned inline with field values

### 7. Validation States
- Success: Subtle border highlight
- Warning: Amber border with warning icon
- Error: Red border with error message below
- Neutral: Standard border

### 8. Empty States
- Upload zone when no document loaded
- Review grid when processing
- Loading skeletons during AI processing

## Animations
**Minimal, purposeful only:**
- Upload progress bar animation
- Skeleton loader during processing
- Smooth transitions on field edits (200ms)
- Success checkmark animation on export

## Page Layout Structure

**Main Application View:**
1. Header: Logo + status bar + export button (h-16)
2. Two-column layout:
   - Main content (2/3 width): Upload zone OR review grid
   - Sidebar (1/3 width): Document preview (when document loaded)
3. Footer: Processing stats, file info

**Responsive Breakpoints:**
- Desktop (lg): Two-column layout
- Tablet (md): Stacked layout, collapsible sidebar
- Mobile: Single column, preview in modal

## Images
**No hero images needed** - This is a utility application focused on data processing. The upload zone serves as the entry point with icon-based visual guidance.

## Key Interactions
1. **Drag-and-drop**: Visual feedback with border highlight and cursor change
2. **Field editing**: Click to edit, inline validation, auto-save
3. **Grid navigation**: Keyboard shortcuts (Tab, Enter to navigate fields)
4. **Export**: One-click download with filename preview modal

## Container Strategy
- Max-width container: max-w-7xl mx-auto px-6
- Review grid: Full width within container
- Centered upload zone when no document loaded

This design prioritizes **workflow efficiency** and **data accuracy** over visual flair, creating a professional tool optimized for claims processing tasks.