"""
Prompt templates for image generation and editing.
"""

GENERATE_PROMPT = """Generate a clean, high-quality diagram based on the provided reference image and the user's voice explanation.

The output should:
- Preserve the reference image’s background style (usually a white background), but remove all pencil sketch borders, smudges, or uneven outlines.
- Focus on clarity and minimalism — use consistent line thickness, smooth shapes, and evenly spaced elements.
- Treat the drawing as a **diagram**, not an artwork: use clean arrows, boxes, and labeled components.
- Incorporate all entities, objects, or relationships mentioned in the user's explanation as labeled elements.
- If the explanation includes key terms, processes, or flow steps, visualize them using directional arrows or block structures.
- If paragraphs or captions appear in the original, retain them exactly, formatted cleanly.

User voice explanation: {user_prompt}"""

EDIT_PROMPT = """Edit the provided diagram based on the user's instructions.

The edited image should:
- Maintain the original background style and layout but **remove rough pencil lines or border artifacts**.
- Use smooth, even lines and geometric consistency for all arrows, boxes, and text.
- Apply edits as clearly and cleanly as possible, emphasizing readability and diagrammatic balance.
- Add, modify, or delete elements according to the user’s description.
- Keep all existing text and component labels unless the user explicitly requests changes.

User edit instructions: {user_prompt}"""

SVG_GENERATE_PROMPT = """You are a diagram assistant. Based on any reference sketch image (if provided) and the user's spoken explanation, output ONE complete standalone SVG diagram.

Rules:
- Reply with ONLY an <svg>...</svg> document (no markdown fences, no commentary).
- Use a white background, viewBox="0 0 1024 768", width="1024" height="768".
- Clean educational style: boxes, circles, arrows, and <text> labels.
- Incorporate entities and relationships mentioned in the explanation.
- Prefer high contrast (#111 stroke/text on white).

User voice explanation: {user_prompt}"""

SVG_EDIT_PROMPT = """You are a diagram assistant. Edit/complete the diagram described by the user's instructions and any reference sketch image.

Rules:
- Reply with ONLY an <svg>...</svg> document (no markdown fences, no commentary).
- Use a white background, viewBox="0 0 1024 768", width="1024" height="768".
- Clean educational style: boxes, circles, arrows, and <text> labels.
- Apply the requested edits clearly; keep existing labels unless asked to change them.

User edit instructions: {user_prompt}"""