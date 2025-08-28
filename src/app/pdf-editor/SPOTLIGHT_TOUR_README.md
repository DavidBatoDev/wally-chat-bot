# Spotlight Tour Feature

## Overview

The Spotlight Tour feature provides a guided tour experience for first-time users of the PDF Editor. It includes a dark overlay that dims the background and focuses attention on specific elements, with informative popups explaining each feature.

## Features

### Automatic Tour Launch

- Automatically starts for first-time users when they enter the "translate" workflow step
- Uses localStorage to track if the user has completed the tour
- Can be manually triggered via the help button in the header

### Tour Steps

The tour includes 6 comprehensive steps:

1. **Welcome** - Introduction to the PDF Editor
2. **Workflow Overview** - Explanation of the three main workflow steps
3. **Translation Step** - Details about the translate functionality
4. **Sidebar Features** - Overview of sidebar navigation and tools
5. **Header Tools** - Explanation of header controls and workflow navigation
6. **Getting Started** - Final guidance for users to begin working

### User Controls

- **Next/Previous** - Navigate between tour steps
- **Skip Tour** - Exit the tour at any time
- **Close** - X button to close the tour
- **Reset Tour** - Available in the sidebar tools section to restart the tour

## Implementation Details

### Components

#### SpotlightTour.tsx

- Main tour component with modal overlay
- Handles step navigation and user interactions
- Includes smooth animations and transitions

#### useSpotlightTour.ts

- Custom hook managing tour state and localStorage
- Provides tour step configuration
- Handles tour lifecycle (start, close, reset, complete)

### Integration Points

#### PDFEditorContent.tsx

- Main integration point for the tour
- Auto-starts tour for first-time users
- Manages tour state and passes props to child components

#### PDFEditorHeader.tsx

- Contains the tour start button (help icon)
- Allows users to manually trigger the tour

#### PDFEditorSidebar.tsx

- Contains the reset tour button in the tools section
- Allows users to restart the tour after completion

### LocalStorage

- **Key**: `pdfEditorTourCompleted`
- **Value**: `"true"` when tour is completed
- **Purpose**: Prevents automatic tour launch for returning users

## Usage

### For Users

1. **First Visit**: Tour automatically starts when entering translate mode
2. **Manual Start**: Click the help icon (?) in the header
3. **Reset Tour**: Go to sidebar → Tools → Reset Tour button
4. **Navigation**: Use Next/Previous buttons or click outside to skip

### For Developers

1. **Adding New Steps**: Modify the `tourSteps` array in `useSpotlightTour.ts`
2. **Customizing Content**: Update step titles and descriptions
3. **Styling**: Modify CSS classes in `SpotlightTour.tsx`
4. **Integration**: Add tour hooks to other components as needed

## Tour Step Configuration

Each tour step includes:

- `id`: Unique identifier for the step
- `title`: Step heading displayed to the user
- `description`: Detailed explanation of the feature
- `position`: Optional positioning hint for future spotlight features
- `showSpotlight`: Whether to show the dark overlay (currently all set to true)

## Future Enhancements

### Spotlight Functionality

- Target specific elements by ID for focused highlighting
- Position tour popups relative to highlighted elements
- Add element-specific animations and effects

### Advanced Features

- Interactive tour steps with user actions
- Progress tracking and analytics
- Customizable tour paths based on user role
- Multi-language tour support

### Accessibility

- Keyboard navigation support
- Screen reader compatibility
- High contrast mode support
- Reduced motion preferences

## Technical Notes

- Uses React hooks for state management
- Implements smooth CSS transitions
- Responsive design for mobile and desktop
- Z-index management for proper layering
- Event handling for user interactions

## Troubleshooting

### Common Issues

1. **Tour not starting**: Check localStorage and workflow step
2. **Styling issues**: Verify Tailwind CSS classes are available
3. **State management**: Ensure tour hooks are properly integrated

### Debug Mode

- Check browser console for tour-related logs
- Verify localStorage values
- Test tour reset functionality

## Dependencies

- React 18+
- Tailwind CSS
- Lucide React icons
- Custom UI components (Button, etc.)
