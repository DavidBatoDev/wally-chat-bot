export interface Entity {
  type: string;
  text: string;
  confidence: number;
  bounding_poly: {
    vertices: Array<{
      x: number;
      y: number;
    }>;
  };
  id: string;
  style: {
    background_color: [number, number, number] | null;
    text_color: [number, number, number];
    border_color: [number, number, number];
    has_border: boolean;
    border_radius: number;
    padding: number;
    font_weight: string;
    alignment: string;
    font_size: number;
    font_name: string;
    actual_width: number;
    actual_height: number;
    leading: number;
    expanded_width: number | null;
    expanded_height: number | null;
  };
}
