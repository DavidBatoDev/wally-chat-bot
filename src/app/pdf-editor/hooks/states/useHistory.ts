import { useRef } from "react";
import { ViewMode } from "../../types/pdf-editor.types";

// Command interface
export interface Command {
  execute(): void;
  undo(): void;
  description?: string;
}

// History stack per page/view
export type HistoryStack = {
  undoStack: Command[];
  redoStack: Command[];
};

export type PageViewKey = string; // `${pageNumber}-${viewMode}`

export function useHistory() {
  // Map: page-view key -> history stack
  const historyRef = useRef<Map<PageViewKey, HistoryStack>>(new Map());

  // Helper to get stack for a page/view
  function getStack(page: number, view: ViewMode) {
    const key = `${page}-${view}`;
    if (!historyRef.current.has(key)) {
      historyRef.current.set(key, { undoStack: [], redoStack: [] });
    }
    return historyRef.current.get(key)!;
  }

  function push(page: number, view: ViewMode, command: Command) {
    const stack = getStack(page, view);
    stack.undoStack.push(command);
    stack.redoStack = []; // Clear redo on new action
  }

  function undo(page: number, view: ViewMode) {
    const stack = getStack(page, view);
    const cmd = stack.undoStack.pop();
    if (cmd) {
      cmd.undo();
      stack.redoStack.push(cmd);
    }
  }

  function redo(page: number, view: ViewMode) {
    const stack = getStack(page, view);
    const cmd = stack.redoStack.pop();
    if (cmd) {
      cmd.execute();
      stack.undoStack.push(cmd);
    }
  }

  function canUndo(page: number, view: ViewMode) {
    return getStack(page, view).undoStack.length > 0;
  }
  function canRedo(page: number, view: ViewMode) {
    return getStack(page, view).redoStack.length > 0;
  }

  return { push, undo, redo, canUndo, canRedo };
}
