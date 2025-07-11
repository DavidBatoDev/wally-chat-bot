import matplotlib.pyplot as plt
import matplotlib.patches as patches
import json
import os
import random
from matplotlib.path import Path

def get_entity_color(entity_type):
    """Generate a consistent color for each entity type."""
    # Hash the entity type to get a consistent color
    random.seed(entity_type)
    return (random.random(), random.random(), random.random())

def visualize_layout(layout_json_path, output_path=None):
    """Visualize the Document AI entities using matplotlib."""
    # Load the layout data
    with open(layout_json_path, 'r', encoding='utf-8') as f:
        layout_data = json.load(f)
    
    # Create figure and axis
    fig, ax = plt.subplots(figsize=(12, 16))  # Larger figure for better visibility
    
    # Find the document boundaries from entities with bounding boxes
    entities_with_bounds = [e for e in layout_data['entities'] if e['bounding_poly'] is not None]
    if entities_with_bounds:
        max_x = max(max(v['x'] for v in e['bounding_poly']['vertices']) for e in entities_with_bounds)
        max_y = max(max(v['y'] for v in e['bounding_poly']['vertices']) for e in entities_with_bounds)
    else:
        max_x = 1.0
        max_y = 1.0
    
    # Set the axis limits with some padding
    padding = 0.1  # 10% padding
    ax.set_xlim(-max_x * padding, max_x * (1 + padding))
    ax.set_ylim(max_y * (1 + padding), -max_y * padding)  # Flip Y-axis to match document coordinates
    
    # Track entity types for legend
    entity_colors = {}
    
    # Draw each entity
    for entity in layout_data['entities']:
        # Skip entities without bounding boxes
        if not entity['bounding_poly']:
            continue
            
        # Get or create color for this entity type
        if entity['type'] not in entity_colors:
            entity_colors[entity['type']] = get_entity_color(entity['type'])
        color = entity_colors[entity['type']]
        
        # Create polygon from vertices
        vertices = [(v['x'], v['y']) for v in entity['bounding_poly']['vertices']]
        polygon = patches.Polygon(
            vertices,
            linewidth=1,
            edgecolor=color,
            facecolor=color,
            alpha=0.2
        )
        ax.add_patch(polygon)
        
        # Position text above the box (use first vertex as anchor point)
        first_vertex = entity['bounding_poly']['vertices'][0]
        ax.text(
            first_vertex['x'],
            first_vertex['y'] - 0.02,  # Slightly above the box
            entity['text'],
            fontsize=8,
            color='black',
            rotation=0,
            bbox=dict(facecolor='white', alpha=0.8, edgecolor=color, pad=2),
            verticalalignment='bottom'
        )
    
    ax.set_title("Document AI Entity Visualization")
    ax.grid(True, linestyle='--', alpha=0.3)
    
    # Add legend for entity types
    legend_elements = [
        patches.Patch(facecolor=color, alpha=0.2, label=f"{entity_type}")
        for entity_type, color in entity_colors.items()
    ]
    ax.legend(handles=legend_elements, loc='upper right', fontsize=8)
    
    # Save or show the plot
    if output_path:
        plt.savefig(output_path, bbox_inches='tight', dpi=300)
        plt.close()
        print(f"✅ Visualization saved to {output_path}")
    else:
        plt.show()

def main():
    # File paths
    layout_json_path = "layout.json"  # The JSON file from Document AI
    output_dir = "layout_output"
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Create visualization
    viz_path = os.path.join(output_dir, "docai_entity_visualization.png")
    visualize_layout(layout_json_path, viz_path)

if __name__ == "__main__":
    main() 