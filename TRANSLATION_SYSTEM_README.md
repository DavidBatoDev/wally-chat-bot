# Translation Project Management System

A comprehensive Next.js translation project management system with role-based dashboards and workflow automation.

## Features

### User Roles & Authentication
- **Project Manager (PM)**: Can upload projects, view kanban board, manage workflow
- **Translator**: Can view assigned projects, accept/decline assignments, mark work complete
- **Proofreader**: Can review completed translations, access layout view, approve or request revisions

### Project Workflow
1. **Project Upload & OCR Processing**: PM uploads project, system simulates OCR processing
2. **OCR Confirmation**: PM reviews extracted data and confirms or rejects
3. **Translator Assignment**: Auto-assigns qualified translator based on language pairs
4. **Translation Work**: Translator accepts assignment and marks work complete
5. **Proofreader Assignment**: Auto-assigns qualified proofreader after translation
6. **Proofreading**: Proofreader reviews and can access layout view
7. **Final Approval**: PM reviews and approves or requests revisions

### Kanban Board (PM View)
- **Row 1: Agent Processing**: New Projects | Assigned | In Progress | Proofreading | Completed
- **Row 2: User Action Request**: OCR Confirmation | Final Approval

### Dashboard Features
- **PM Dashboard**: Kanban board with drag-and-drop, project upload form, real-time counts
- **Translator Dashboard**: Statistics cards, project table, accept/decline buttons
- **Proofreader Dashboard**: Review statistics, layout access, complete review actions

## Technical Implementation

### State Management
- Zustand store with localStorage persistence
- Real-time updates across all views
- Auto-assignment logic with random selection from qualified team members

### Key Components
- `ProjectCard`: Displays project information in kanban board
- `ProjectUploadModal`: Form for creating new projects
- `ProjectDetailsModal`: Detailed project view with actions
- `LayoutView`: Proofreader layout access (simulates the workflow shown in image)
- `ProcessingOverlay`: Loading states for automated processes

### Data Structure
```typescript
interface Project {
  id: string
  qCode: string // Auto-generated (e.g., Q299676373)
  clientName: string
  sourceLanguage: string
  targetLanguages: string[]
  deadline: datetime
  deliveryDate: datetime
  document: DocumentPage[]
  status: ProjectStatus
  assignedTranslator?: string
  assignedProofreader?: string
  actionType?: "confirmation" | "final-approval"
}
```

## Usage

1. Navigate to `/exp` to access the translation management system
2. Select your role (Project Manager, Translator, or Proofreader)
3. Choose a specific user from the dropdown
4. Access the appropriate dashboard for your role

### Demo Data
The system includes sample projects in various states to demonstrate the workflow:
- Projects pending OCR confirmation
- Assigned projects for translators
- In-progress translations
- Projects under proofreading
- Projects pending final approval

## Workflow Simulation

The system simulates real translation agency workflows:
- **OCR Processing**: 3-second simulation with progress indicator
- **Auto-assignment**: Random selection from qualified team members
- **Processing Delays**: Realistic timing for automated processes
- **Role-based Access**: Each role sees only relevant projects and actions

## Layout View (Proofreader)

The proofreader can access a layout view that simulates the workflow shown in the image:
- Shows the three-step process: Translate → Layout → Final Layout
- Layout step is highlighted as active (red circle with checkmark)
- Allows proofreaders to review document layout and formatting
- Maintains the visual design from the provided image

## Future Enhancements

- Real OCR integration
- File upload and processing
- Advanced assignment algorithms
- Real-time notifications
- Team communication features
- Quality metrics and reporting 