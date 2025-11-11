from PIL import Image, ImageDraw, ImageFilter
print("start")
# Load images
aero = Image.open("aero.png").convert("RGBA")
anvil = Image.open("anvil.png").convert("RGBA")
burrito = Image.open("burrito.png").convert("RGBA")
draft = Image.open("draft.png").convert("RGBA")
feather = Image.open("feather.png").convert("RGBA")

# Resize to match
size = min(aero.width, aero.height)
aero = aero.resize((size, size))
anvil = anvil.resize((size, size))
burrito = burrito.resize((size, size))
draft = draft.resize((size, size))
feather = feather.resize((size, size))

# Create blank base
combined = Image.new("RGBA", (size, size), (255, 255, 255, 0))

# Function to create a smooth, feathered sector mask
def feathered_sector_mask(size, start_angle, end_angle, feather=2):
    """Return a feathered (blurred) mask for a pie-slice sector."""
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.pieslice([(0, 0), (size, size)], start=start_angle, end=end_angle, fill=255)
    return mask.filter(ImageFilter.GaussianBlur(feather))

# Define four sectors (you can adjust these angles)
sectors = [
    (aero, 0, 90),
    (draft, 90, 180),
    (feather, 180, 270),
    (anvil, 270,360)
]

# Apply each image with smooth transitions
for img, start, end in sectors:
    mask = feathered_sector_mask(size, start, end, feather=5)
    combined = Image.composite(img, combined, mask)

# Save the smooth blended result
combined.save("combined_icon_circle_smooth.png")
print("Saved combined_icon_circle_smooth.png")