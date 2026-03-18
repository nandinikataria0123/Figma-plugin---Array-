# Contributing to Array

Thank you for your interest in improving Array! Whether you're a designer with a UI suggestion or a developer with a math optimization, your help is welcome.

## Getting Started

1. **Clone the repository**:
   ```bash
   git clone https://github.com/nischalsubedi/figma-array-plugin.git
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Start the build watcher**:
   ```bash
   npm run watch
   ```
4. **Load in Figma**:
   - Open Figma Desktop.
   - Go to **Plugins > Development > Import plugin from manifest...**
   - Select the `manifest.json` in this folder.

## Project Structure

- `code.ts`: The "brain" of the plugin. Handles the Figma API and the mathematical Bezier Engine.
- `ui.html`: The interface. Contains the HTML, CSS (Figma-native styling), and the UI logic.
- `tsconfig.json`: TypeScript configuration.

## How You Can Help

### For Designers
- **UX Refinements**: Suggest improvements to the input flow or visual feedback.
- **Feature Requests**: Have an idea for a new distribution mode (e.g., "Step" or "Randomize")? Open an issue!

### For Developers
- **Math Optimizations**: The `BezierEngine` in `code.ts` uses Look-Up Tables for precision. Improvements to binary search or LUT generation are always welcome.
- **Bug Fixes**: Help us squash edge cases with unusual vector paths.

## Submission Guidelines

1. Fork the repo and create your branch from `main`.
2. Ensure your code follows the existing style (TypeScript with minimal dependencies).
3. Provide a clear description of your changes in the Pull Request.

---

Made with ❤️ for the Figma community.
