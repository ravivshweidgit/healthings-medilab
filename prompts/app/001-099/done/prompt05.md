# PROMPT 05: UI/UX Refactoring - The "Wellness & Clarity" Standard

## 1. Design Vision
Transform the "Metabolic Command Center" from a developer-centric IDE look to a high-end health and wellness experience. The goal is to mimic the aesthetic of **Withings** and **CareSens Air**: Minimalist, Airy, Clean, and Sophisticated.

## 2. Color Palette (The "Soft-Health" Palette)
- **Background:** `#F8F9FB` (Off-white/Light Gray) - Never pure white for the background.
- **Surface/Cards:** `#FFFFFF` (Pure White).
- **Primary Text:** `#1A1A1A` (Deep Charcoal, not pure black).
- **Secondary Text:** `#7C7C7C` (Soft Gray).
- **Accent Green (Success/Safe):** `#4CAF50` (Emerald Green - soft, not neon).
- **Accent Blue (Information):** `#2196F3` (Sky Blue).
- **Accent Red (Warning):** `#FF5252` (Soft Coral).

## 3. Typography Rules
- **Main Font:** Use clean Sans-Serif (e.g., System font, Inter, or Roboto).
- **Weights:** - Use **Light (200-300)** for large hero numbers (e.g., Efficiency Score).
    - Use **Regular (400)** for body text.
    - Use **Semi-Bold (600)** for labels and titles.
- **Formatting:** - No Monospace fonts. 
    - Use wide letter-spacing for uppercase labels (+1px).

## 4. Component Styling
- **Cards:**
    - `borderRadius: 24` (Deeply rounded corners).
    - `padding: 24`.
    - **Shadow:** Very subtle. `shadowOpacity: 0.05`, `shadowRadius: 10`, `elevation: 2`. No borders.
- **Progress Bars:**
    - Height: 8px.
    - Rounded ends.
    - Background: `#F0F0F0`.
- **Icons:**
    - Use "Feather" or "Ionicons" (Outline versions).
    - Place icons inside a circular tinted background (e.g., Blue icon on Light-Blue circle).

## 5. Information Hierarchy (The "Withings" Layout)
1. **Header:** Minimalist. "Good Morning, [Name]" in soft gray.
2. **Hero Section:** The "Metabolic Efficiency" score. Huge, thin number. Large progress ring or bar.
3. **The Grid:** Secondary metrics (Glucose, Steps) in two-column cards.
4. **The Graph:** Full-width card.
    - **Graph Style:** Smooth Bezier curves only. No jagged lines.
    - **Grid:** Very faint horizontal lines for reference ranges (70, 100, 140).
    - **Interactive:** Small dots on the line only when touched.

## 6. Tone of Voice (Microcopy)
- Avoid technical jargon (e.g., "Dev Build", "Syncing...").
- Use human-centric language:
    - Instead of "Glucose: 120 mg/dL", use "Your glucose is stable."
    - Instead of "Algorithm Result: 56", use "Your metabolic score is building."

## 7. Implementation Commands (React Native)
- Replace all `View` containers that have black backgrounds with the new `#F8F9FB` background.
- Update all `Card` components to include the new borderRadius and soft shadows.
- Change the `Metabolic Efficiency` display to use a `fontWeight: '200'` for the main number.