# Project Context: Array for Figma

## 1. Overview
**Array** is a precision-engineered Figma plugin designed to solve the common problem of distributing objects along vector paths. While many tools exist for this purpose, most suffer from "parametric bunching"—where objects cluster in tight curves and spread out on straight lines. Array uses a custom-built Bezier Engine with arc-length parameterization to ensure mathematically perfect, equidistant spacing regardless of curve complexity.

## 2. Developer Focus
- **Mathematical Integrity**: Prioritizing physical arc-length over simple parametric evaluation.
- **Performance**: Using binary search and Look-Up Tables (LUTs) to keep complex distributions fast within the Figma sandbox.
- **Native UX**: Maintaining a "Figma-first" aesthetic and workflow to reduce cognitive load for designers.
- **Clean Architecture**: Separating mathematical concerns (BezierEngine) from platform concerns (Figma API).

## 3. High-Level Design (HLD)

### Architecture
The plugin follows the standard Figma sandbox model:
1.  **UI Layer (`src/ui.html`)**: A vanilla HTML/JS/CSS environment. It handles user inputs, state management, and triggers the generation process. It uses a Figma-native dark theme to blend in with the editor.
2.  **Sandbox Layer (`src/code.ts`)**: The "brain" of the plugin. It has access to the Figma Document Object Model (DOM). It performs the heavy lifting: vector network analysis, coordinate transformations, and node cloning.

### Communication
- **UI → Sandbox**: Sends a `generate` message with user preferences (mode, count/gap, rotation toggle).
- **Sandbox → UI**: Sends status updates (`generating`, `done`) and confirmation of selected nodes.

## 4. Low-Level Design (LLD)

### The Bezier Engine
The core innovation is the `BezierEngine` class, which implements:
- **Numerical Integration**: Calculates the "true" length of a curve by subdividing it into small linear steps.
- **Arc-Length LUT (Look-Up Table)**: Maps a normalized distance (0% to 100% of length) to a mathematical parameter `t`. This allows the plugin to find "exactly 50px along the curve" without expensive real-time integration.
- **Binary Search & Interpolation**: Quickly finds the nearest entries in the LUT for any target distance and interpolates between them for sub-pixel precision.

### Distribution Logic
- **Even Count Mode**: Calculates `totalLength / (count - 1)` to find the step distance.
- **Fixed Gap Mode**: Uses the user-provided pixel gap and handles the remainder at the end of the path.
- **Tangent Alignment**: Uses the first derivative of the Bezier equation at the specific point to calculate the rotation angle.

### Placement Strategy (`placeClone`)
To avoid the common "top-left" rotation bug, Array uses `relativeTransform` matrices. This ensures that objects are rotated around their **geometric center**, maintaining the intended visual path even for large or asymmetrical components.

## 5. Design Decisions

### Why Vanilla TS/HTML instead of React?
- **Zero Overhead**: For a utility plugin, React adds unnecessary bundle size and complexity. Vanilla JS keeps the plugin lightweight and instant-loading.
- **Stability**: Fewer dependencies mean less maintenance as Figma's API evolves.

### Why the `dist/` Reorganization?
- **Build Safety**: Separates source code (`src/`) from compiled artifacts (`dist/`).
- **Clean Manifest**: The `manifest.json` now points only to production-ready files, preventing dev-only files (like `code.ts`) from being accidentally bundled or referenced.

## 6. Improvements & Enhancements
- **Refactoring**: Moved from a flat structure to a structured `src/` layout.
- **Documentation**: Added comprehensive JSDoc to the engine to lower the barrier for contributors.
- **Precision**: Increased LUT steps to 200 by default, striking a balance between accuracy and memory usage.

## 7. Future Roadmap
- **Real Time Spacing and Count Updates** : Allow users to see changes in real-time as they adjust the count or gap numbers.
- **Adaptive Spacing**: Option to adjust spacing based on the size of the object being cloned.
- **Multi-Path Support**: Distributing across multiple disconnected vector paths in one click.
- **Randomization**: Adding "jitter" to position and rotation for more organic patterns.
- **Live Preview**: Real-time updates as the user slides the count/gap values.
