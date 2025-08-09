import { useRef, useCallback } from "react";

// Command interface - EVERY action must implement this
export interface Command {
  execute(): void;
  undo(): void;
  description?: string;
}

// Group command for batch operations (multi-select, etc)
export class GroupCommand implements Command {
  private commands: Command[] = [];
  public description?: string;

  constructor(commands: Command[] = [], description?: string) {
    this.commands = commands;
    this.description =
      description || `Group operation (${commands.length} actions)`;
  }

  addCommand(command: Command) {
    this.commands.push(command);
  }

  execute() {
    console.log(
      `[GroupCommand] Executing ${this.commands.length} commands atomically`
    );
    // Execute all commands at once (appears atomic to user)
    this.commands.forEach((cmd) => cmd.execute());
  }

  undo() {
    console.log(
      `[GroupCommand] Undoing ${this.commands.length} commands atomically`
    );
    // Undo all commands in reverse order (appears atomic to user)
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo();
    }
  }

  isEmpty() {
    return this.commands.length === 0;
  }

  getCommands() {
    return this.commands;
  }
}

// Simple, clean history manager
export function useHistory() {
  const undoStackRef = useRef<Command[]>([]);
  const redoStackRef = useRef<Command[]>([]);
  const currentGroupRef = useRef<GroupCommand | null>(null);

  // Start a group operation (for multi-select actions, etc)
  const startGroup = useCallback((description?: string) => {
    if (currentGroupRef.current) {
      console.warn(
        "[History] Group already in progress - ending previous group"
      );
      endGroup();
    }
    console.log("[History] Starting group:", description);
    currentGroupRef.current = new GroupCommand([], description);
  }, []);

  // End group and push to undo stack
  const endGroup = useCallback(() => {
    if (currentGroupRef.current && !currentGroupRef.current.isEmpty()) {
      const group = currentGroupRef.current;
      console.log(
        "[History] Ending group with",
        group.getCommands().length,
        "commands"
      );

      // Push the group as a single undo/redo item
      undoStackRef.current.push(group);
      redoStackRef.current = []; // Clear redo stack on new action

      currentGroupRef.current = null;

      console.log("[History] Group added to undo stack");
      console.log("[History] Undo stack size:", undoStackRef.current.length);
      console.log("[History] Redo stack cleared");
    } else if (currentGroupRef.current) {
      console.log("[History] Ending empty group - discarding");
      currentGroupRef.current = null;
    }
  }, []);

  // Check if currently in a group
  const isGrouping = useCallback(() => {
    return currentGroupRef.current !== null;
  }, []);

  // Execute and push a command to history
  const executeCommand = useCallback((command: Command) => {
    console.log("[History] Executing command:", command.description);

    // Always execute the command
    command.execute();

    // Add to current group if grouping, otherwise push directly
    if (currentGroupRef.current) {
      console.log("[History] Adding to current group:", command.description);
      currentGroupRef.current.addCommand(command);
    } else {
      console.log("[History] Adding as individual command to undo stack");
      undoStackRef.current.push(command);
      redoStackRef.current = []; // Clear redo stack on new action

      console.log("[History] Undo stack size:", undoStackRef.current.length);
      console.log("[History] Redo stack cleared");
    }
  }, []);

  // Push a command without executing (for pre-executed commands)
  const push = useCallback((command: Command) => {
    console.log("[History] Pushing pre-executed command:", command.description);

    // Add to current group if grouping, otherwise push directly
    if (currentGroupRef.current) {
      console.log("[History] Adding to current group:", command.description);
      currentGroupRef.current.addCommand(command);
    } else {
      console.log("[History] Adding as individual command to undo stack");
      undoStackRef.current.push(command);
      redoStackRef.current = []; // Clear redo stack on new action

      console.log("[History] Undo stack size:", undoStackRef.current.length);
      console.log("[History] Redo stack cleared");
    }
  }, []);

  // Undo last action (individual or group)
  const undo = useCallback(() => {
    console.log("[History] Undo called");

    // End any ongoing group first
    if (currentGroupRef.current) {
      console.log("[History] Ending group before undo");
      endGroup();
    }

    const command = undoStackRef.current.pop();
    if (command) {
      console.log("[History] Undoing:", command.description);

      if (command instanceof GroupCommand) {
        console.log(
          "[History] Undoing group with",
          command.getCommands().length,
          "commands"
        );
      }

      // Undo the command
      command.undo();

      // Move to redo stack
      redoStackRef.current.push(command);

      console.log(
        "[History] After undo - undo stack:",
        undoStackRef.current.length
      );
      console.log(
        "[History] After undo - redo stack:",
        redoStackRef.current.length
      );
      return true;
    }

    console.log("[History] Nothing to undo");
    return false;
  }, [endGroup]);

  // Redo last undone action (individual or group)
  const redo = useCallback(() => {
    console.log("[History] Redo called");

    // End any ongoing group first
    if (currentGroupRef.current) {
      console.log("[History] Ending group before redo");
      endGroup();
    }

    const command = redoStackRef.current.pop();
    if (command) {
      console.log("[History] Redoing:", command.description);

      if (command instanceof GroupCommand) {
        console.log(
          "[History] Redoing group with",
          command.getCommands().length,
          "commands"
        );
      }

      // Execute the command
      command.execute();

      // Move back to undo stack
      undoStackRef.current.push(command);

      console.log(
        "[History] After redo - undo stack:",
        undoStackRef.current.length
      );
      console.log(
        "[History] After redo - redo stack:",
        redoStackRef.current.length
      );
      return true;
    }

    console.log("[History] Nothing to redo");
    return false;
  }, [endGroup]);

  // Check if can undo
  const canUndo = useCallback((): boolean => {
    return (
      undoStackRef.current.length > 0 ||
      (currentGroupRef.current && !currentGroupRef.current.isEmpty())
    );
  }, []);

  // Check if can redo
  const canRedo = useCallback(() => {
    return redoStackRef.current.length > 0;
  }, []);

  // Clear all history
  const clear = useCallback(() => {
    console.log("[History] Clearing all history");
    undoStackRef.current = [];
    redoStackRef.current = [];
    currentGroupRef.current = null;
  }, []);

  // Get history info for debugging
  const getHistoryInfo = useCallback(() => {
    return {
      undoCount: undoStackRef.current.length,
      redoCount: redoStackRef.current.length,
      isGrouping: currentGroupRef.current !== null,
      groupSize: currentGroupRef.current?.getCommands().length || 0,
      undoStack: undoStackRef.current.map((cmd) => cmd.description),
      redoStack: redoStackRef.current.map((cmd) => cmd.description),
    };
  }, []);

  return {
    executeCommand,
    push,
    undo,
    redo,
    canUndo,
    canRedo,
    clear,
    startGroup,
    endGroup,
    isGrouping,
    getHistoryInfo,
    // Legacy compatibility
    startBatch: startGroup,
    endBatch: endGroup,
    isBatching: isGrouping,
  };
}
