import { Command } from "./../states/useHistory";
import {
  TextField,
  Shape,
  Image,
  DeletionRectangle,
  ViewMode,
} from "../../types/pdf-editor.types";

// Add TextBox
export class AddTextBoxCommand implements Command {
  constructor(
    private add: () => string,
    private remove: (id: string) => void,
    private idRef: { current: string | null }
  ) {}
  execute() {
    this.idRef.current = this.add();
  }
  undo() {
    if (this.idRef.current) this.remove(this.idRef.current);
  }
}

// Update TextBox
export class UpdateTextBoxCommand implements Command {
  constructor(
    private update: (id: string, updates: Partial<TextField>) => void,
    private id: string,
    private before: Partial<TextField>,
    private after: Partial<TextField>
  ) {}
  execute() {
    this.update(this.id, this.after);
  }
  undo() {
    this.update(this.id, this.before);
  }
}

// Delete TextBox
export class DeleteTextBoxCommand implements Command {
  constructor(
    private remove: (id: string) => void,
    private add: (box: TextField) => void,
    private box: TextField
  ) {}
  execute() {
    this.remove(this.box.id);
  }
  undo() {
    this.add(this.box);
  }
}

// Add Shape
export class AddShapeCommand implements Command {
  constructor(
    private add: () => string,
    private remove: (id: string) => void,
    private idRef: { current: string | null }
  ) {}
  execute() {
    this.idRef.current = this.add();
  }
  undo() {
    if (this.idRef.current) this.remove(this.idRef.current);
  }
}

// Update Shape
export class UpdateShapeCommand implements Command {
  private before: Partial<Shape>;
  private after: Partial<Shape>;
  constructor(
    private update: (id: string, updates: Partial<Shape>) => void,
    private id: string,
    before: Partial<Shape>,
    after: Partial<Shape>
  ) {
    this.before = before;
    this.after = after;
  }
  execute() {
    this.update(this.id, this.after);
  }
  undo() {
    this.update(this.id, this.before);
  }
}

// Delete Shape
export class DeleteShapeCommand implements Command {
  constructor(
    private remove: (id: string) => void,
    private add: (shape: Shape) => void,
    private shape: Shape
  ) {}
  execute() {
    this.remove(this.shape.id);
  }
  undo() {
    this.add(this.shape);
  }
}

// Add Image
export class AddImageCommand implements Command {
  constructor(
    private add: () => string,
    private remove: (id: string) => void,
    private idRef: { current: string | null }
  ) {}
  execute() {
    this.idRef.current = this.add();
  }
  undo() {
    if (this.idRef.current) this.remove(this.idRef.current);
  }
}

// Update Image
export class UpdateImageCommand implements Command {
  constructor(
    private update: (id: string, updates: Partial<Image>) => void,
    private id: string,
    private before: Partial<Image>,
    private after: Partial<Image>
  ) {}
  execute() {
    this.update(this.id, this.after);
  }
  undo() {
    this.update(this.id, this.before);
  }
}

// Delete Image
export class DeleteImageCommand implements Command {
  constructor(
    private remove: (id: string) => void,
    private add: (image: Image) => void,
    private image: Image
  ) {}
  execute() {
    this.remove(this.image.id);
  }
  undo() {
    this.add(this.image);
  }
}

// Add Deletion Rectangle
export class AddDeletionRectangleCommand implements Command {
  constructor(
    private add: () => string,
    private remove: (id: string) => void,
    private idRef: { current: string | null }
  ) {}
  execute() {
    this.idRef.current = this.add();
  }
  undo() {
    if (this.idRef.current) this.remove(this.idRef.current);
  }
}

// Delete Deletion Rectangle
export class DeleteDeletionRectangleCommand implements Command {
  constructor(
    private remove: (id: string) => void,
    private add: (rect: DeletionRectangle) => void,
    private rect: DeletionRectangle
  ) {}
  execute() {
    this.remove(this.rect.id);
  }
  undo() {
    this.add(this.rect);
  }
}
