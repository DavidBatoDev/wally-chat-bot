import { Command, GroupCommand } from "./../states/useHistory";
import {
  TextField,
  Shape,
  Image,
  DeletionRectangle,
  ViewMode,
} from "../../types/pdf-editor.types";

// Base command with common functionality
abstract class BaseCommand implements Command {
  public description?: string;

  abstract execute(): void;
  abstract undo(): void;
}

// Add TextBox Command
export class AddTextBoxCommand extends BaseCommand {
  private textBoxId: string | null = null;
  private savedTextBox: TextField | null = null;

  constructor(
    private addFunc: (tb: TextField) => string,
    private deleteFunc: (id: string) => void,
    private textBoxData: TextField
  ) {
    super();
    this.description = "Add text box";
  }

  execute() {
    console.log('[AddTextBoxCommand] Executing add text box');
    this.textBoxId = this.addFunc(this.textBoxData);
    this.savedTextBox = { ...this.textBoxData, id: this.textBoxId };
    console.log('[AddTextBoxCommand] Added text box with ID:', this.textBoxId);
  }

  undo() {
    console.log('[AddTextBoxCommand] Undoing - deleting text box ID:', this.textBoxId);
    if (this.textBoxId) {
      this.deleteFunc(this.textBoxId);
    }
  }
}

// Update TextBox Command with merging support
export class UpdateTextBoxCommand extends BaseCommand {
  private mergedAfter: Partial<TextField>;

  constructor(
    private updateTextBox: (id: string, updates: Partial<TextField>) => void,
    private id: string,
    private before: Partial<TextField>,
    private after: Partial<TextField>
  ) {
    super();
    this.mergedAfter = { ...after };
    this.description = "Update text box";
  }

  execute() {
    console.log('[UpdateTextBoxCommand] Executing update for ID:', this.id, 'with:', this.mergedAfter);
    this.updateTextBox(this.id, this.mergedAfter);
  }

  undo() {
    console.log('[UpdateTextBoxCommand] Undoing update for ID:', this.id, 'restoring:', this.before);
    this.updateTextBox(this.id, this.before);
  }

}

// Delete TextBox Command
export class DeleteTextBoxCommand extends BaseCommand {
  private restoredId: string | null = null;
  private view: ViewMode;

  constructor(
    private deleteFunc: (id: string) => void,
    private restoreFunc: (textBox: TextField, view: ViewMode) => void,
    private textBox: TextField,
    view: ViewMode
  ) {
    super();
    this.view = view;
    this.description = "Delete text box";
  }

  execute() {
    console.log('[DeleteTextBoxCommand] Executing delete for ID:', this.textBox.id, 'from view:', this.view);
    this.deleteFunc(this.textBox.id);
  }

  undo() {
    console.log('[DeleteTextBoxCommand] Undoing delete - restoring text box:', this.textBox, 'to view:', this.view);
    this.restoreFunc(this.textBox, this.view);
  }
}

// Add Shape Command
export class AddShapeCommand extends BaseCommand {
  private shapeId: string | null = null;
  private savedShape: Shape | null = null;

  constructor(
    private addFunc: (shape: Shape) => string,
    private deleteFunc: (id: string) => void,
    private shapeData: Shape
  ) {
    super();
    this.description = `Add ${shapeData.type}`;
  }

  execute() {
    console.log('[AddShapeCommand] Executing add shape');
    this.shapeId = this.addFunc(this.shapeData);
    this.savedShape = { ...this.shapeData, id: this.shapeId };
    console.log('[AddShapeCommand] Added shape with ID:', this.shapeId);
  }

  undo() {
    console.log('[AddShapeCommand] Undoing - deleting shape ID:', this.shapeId);
    if (this.shapeId) {
      this.deleteFunc(this.shapeId);
    }
  }
}

// Update Shape Command with merging support
export class UpdateShapeCommand extends BaseCommand {
  private mergedAfter: Partial<Shape>;

  constructor(
    private updateShape: (id: string, updates: Partial<Shape>) => void,
    private id: string,
    private before: Partial<Shape>,
    private after: Partial<Shape>
  ) {
    super();
    this.mergedAfter = { ...after };
    this.description = "Update shape";
  }

  execute() {
    console.log('[UpdateShapeCommand] Executing update for ID:', this.id, 'with:', this.mergedAfter);
    this.updateShape(this.id, this.mergedAfter);
  }

  undo() {
    console.log('[UpdateShapeCommand] Undoing update for ID:', this.id, 'restoring:', this.before);
    this.updateShape(this.id, this.before);
  }

}

// Delete Shape Command
export class DeleteShapeCommand extends BaseCommand {
  private view: ViewMode;

  constructor(
    private deleteFunc: (id: string) => void,
    private restoreFunc: (shape: Shape, view: ViewMode) => void,
    private shape: Shape,
    view: ViewMode
  ) {
    super();
    this.view = view;
    this.description = `Delete ${shape.type}`;
  }

  execute() {
    console.log('[DeleteShapeCommand] Executing delete for ID:', this.shape.id, 'from view:', this.view);
    this.deleteFunc(this.shape.id);
  }

  undo() {
    console.log('[DeleteShapeCommand] Undoing delete - restoring shape:', this.shape, 'to view:', this.view);
    this.restoreFunc(this.shape, this.view);
  }
}

// Add Image Command
export class AddImageCommand extends BaseCommand {
  private imageId: string | null = null;
  private savedImage: Image | null = null;

  constructor(
    private addFunc: (img: Image) => string,
    private deleteFunc: (id: string) => void,
    private imageData: Image
  ) {
    super();
    this.description = "Add image";
  }

  execute() {
    console.log('[AddImageCommand] Executing add image');
    this.imageId = this.addFunc(this.imageData);
    this.savedImage = { ...this.imageData, id: this.imageId };
    console.log('[AddImageCommand] Added image with ID:', this.imageId);
  }

  undo() {
    console.log('[AddImageCommand] Undoing - deleting image ID:', this.imageId);
    if (this.imageId) {
      this.deleteFunc(this.imageId);
    }
  }
}

// Update Image Command with merging support
export class UpdateImageCommand extends BaseCommand {
  private mergedAfter: Partial<Image>;

  constructor(
    private updateImage: (id: string, updates: Partial<Image>) => void,
    private id: string,
    private before: Partial<Image>,
    private after: Partial<Image>
  ) {
    super();
    this.mergedAfter = { ...after };
    this.description = "Update image";
  }

  execute() {
    console.log('[UpdateImageCommand] Executing update for ID:', this.id, 'with:', this.mergedAfter);
    this.updateImage(this.id, this.mergedAfter);
  }

  undo() {
    console.log('[UpdateImageCommand] Undoing update for ID:', this.id, 'restoring:', this.before);
    this.updateImage(this.id, this.before);
  }

}

// Delete Image Command
export class DeleteImageCommand extends BaseCommand {
  private view: ViewMode;

  constructor(
    private deleteFunc: (id: string) => void,
    private restoreFunc: (image: Image, view: ViewMode) => void,
    private image: Image,
    view: ViewMode
  ) {
    super();
    this.view = view;
    this.description = "Delete image";
  }

  execute() {
    console.log('[DeleteImageCommand] Executing delete for ID:', this.image.id, 'from view:', this.view);
    this.deleteFunc(this.image.id);
  }

  undo() {
    console.log('[DeleteImageCommand] Undoing delete - restoring image:', this.image, 'to view:', this.view);
    this.restoreFunc(this.image, this.view);
  }
}

// Add Deletion Rectangle Command
export class AddDeletionRectangleCommand extends BaseCommand {
  private rectId: string | null = null;

  constructor(
    private addFunc: (rect: DeletionRectangle) => string,
    private deleteFunc: (id: string) => void,
    private rectData: DeletionRectangle
  ) {
    super();
    this.description = "Add deletion rectangle";
  }

  execute() {
    console.log('[AddDeletionRectangleCommand] Executing add deletion rectangle');
    this.rectId = this.addFunc(this.rectData);
    console.log('[AddDeletionRectangleCommand] Added deletion rectangle with ID:', this.rectId);
  }

  undo() {
    console.log('[AddDeletionRectangleCommand] Undoing - deleting deletion rectangle ID:', this.rectId);
    if (this.rectId) {
      this.deleteFunc(this.rectId);
    }
  }
}

// Delete Deletion Rectangle Command
export class DeleteDeletionRectangleCommand extends BaseCommand {
  private view: ViewMode;

  constructor(
    private deleteFunc: (id: string) => void,
    private restoreFunc: (rect: DeletionRectangle, view: ViewMode) => void,
    private rect: DeletionRectangle,
    view: ViewMode
  ) {
    super();
    this.view = view;
    this.description = "Delete deletion rectangle";
  }

  execute() {
    console.log('[DeleteDeletionRectangleCommand] Executing delete for ID:', this.rect.id, 'from view:', this.view);
    this.deleteFunc(this.rect.id);
  }

  undo() {
    console.log('[DeleteDeletionRectangleCommand] Undoing delete - restoring deletion rectangle:', this.rect, 'to view:', this.view);
    this.restoreFunc(this.rect, this.view);
  }
}

// Multi-element delete command
export class MultiDeleteCommand extends BaseCommand {
  private deletedElements: {
    textBoxes: TextField[];
    shapes: Shape[];
    images: Image[];
  };

  constructor(
    private deleteTextBox: (id: string) => void,
    private deleteShape: (id: string) => void,
    private deleteImage: (id: string) => void,
    private restoreTextBox: (textBox: TextField) => void,
    private restoreShape: (shape: Shape) => void,
    private restoreImage: (image: Image) => void,
    private elements: {
      textBoxes: TextField[];
      shapes: Shape[];
      images: Image[];
    }
  ) {
    super();
    this.deletedElements = {
      textBoxes: elements.textBoxes.map(tb => ({ ...tb })),
      shapes: elements.shapes.map(s => ({ ...s })),
      images: elements.images.map(img => ({ ...img })),
    };
    const totalCount = elements.textBoxes.length + elements.shapes.length + elements.images.length;
    this.description = `Delete ${totalCount} element${totalCount > 1 ? 's' : ''}`;
  }

  execute() {
    console.log('[MultiDeleteCommand] Executing delete for multiple elements');
    console.log('[MultiDeleteCommand] Deleting textboxes:', this.deletedElements.textBoxes.map(tb => tb.id));
    console.log('[MultiDeleteCommand] Deleting shapes:', this.deletedElements.shapes.map(s => s.id));
    console.log('[MultiDeleteCommand] Deleting images:', this.deletedElements.images.map(img => img.id));
    
    // Delete all elements
    this.deletedElements.textBoxes.forEach(tb => this.deleteTextBox(tb.id));
    this.deletedElements.shapes.forEach(s => this.deleteShape(s.id));
    this.deletedElements.images.forEach(img => this.deleteImage(img.id));
  }

  undo() {
    console.log('[MultiDeleteCommand] Undoing delete - restoring multiple elements');
    console.log('[MultiDeleteCommand] Restoring textboxes:', this.deletedElements.textBoxes);
    console.log('[MultiDeleteCommand] Restoring shapes:', this.deletedElements.shapes);
    console.log('[MultiDeleteCommand] Restoring images:', this.deletedElements.images);
    
    // Restore all elements with their original IDs
    this.deletedElements.textBoxes.forEach(tb => this.restoreTextBox(tb));
    this.deletedElements.shapes.forEach(s => this.restoreShape(s));
    this.deletedElements.images.forEach(img => this.restoreImage(img));
  }
}

// Multi-element move command
export class MultiMoveCommand extends BaseCommand {
  private elementMoves: {
    textBoxes: { id: string; before: { x: number; y: number }; after: { x: number; y: number } }[];
    shapes: { id: string; before: { x: number; y: number }; after: { x: number; y: number } }[];
    images: { id: string; before: { x: number; y: number }; after: { x: number; y: number } }[];
  };

  constructor(
    private updateTextBox: (id: string, updates: Partial<TextField>) => void,
    private updateShape: (id: string, updates: Partial<Shape>) => void,
    private updateImage: (id: string, updates: Partial<Image>) => void,
    moves: {
      textBoxes: { id: string; before: { x: number; y: number }; after: { x: number; y: number } }[];
      shapes: { id: string; before: { x: number; y: number }; after: { x: number; y: number } }[];
      images: { id: string; before: { x: number; y: number }; after: { x: number; y: number } }[];
    }
  ) {
    super();
    this.elementMoves = moves;
    const totalCount = moves.textBoxes.length + moves.shapes.length + moves.images.length;
    this.description = `Move ${totalCount} element${totalCount > 1 ? 's' : ''}`;
  }

  execute() {
    console.log('[MultiMoveCommand] Executing move for multiple elements');
    console.log('[MultiMoveCommand] Moving textboxes:', this.elementMoves.textBoxes);
    console.log('[MultiMoveCommand] Moving shapes:', this.elementMoves.shapes);
    console.log('[MultiMoveCommand] Moving images:', this.elementMoves.images);
    
    this.elementMoves.textBoxes.forEach(move => 
      this.updateTextBox(move.id, move.after)
    );
    this.elementMoves.shapes.forEach(move => 
      this.updateShape(move.id, move.after)
    );
    this.elementMoves.images.forEach(move => 
      this.updateImage(move.id, move.after)
    );
  }

  undo() {
    console.log('[MultiMoveCommand] Undoing move - restoring original positions');
    
    this.elementMoves.textBoxes.forEach(move => 
      this.updateTextBox(move.id, move.before)
    );
    this.elementMoves.shapes.forEach(move => 
      this.updateShape(move.id, move.before)
    );
    this.elementMoves.images.forEach(move => 
      this.updateImage(move.id, move.before)
    );
  }

}