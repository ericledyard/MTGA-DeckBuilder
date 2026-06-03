---
paths:
  - "**/*.{tsx,jsx,vue}"
  - "**/pages/**"
  - "**/components/**"
  - "**/app/**/*.{ts,tsx}"
---

# Frontend rules

When editing UI code in this project:

- Components do one thing. If a component renders three unrelated sections with three useEffects, it should be three components.
- State lives at the lowest scope that needs it. Lifting state up is fine; reaching down past one boundary is a smell.
- Side effects (fetch, subscribe, set timer) live in effects or event handlers, never in render.
- Accessibility is part of the change, not a follow-up: every interactive element gets a label, every image gets alt text, every form gets keyboard navigation.
- Loading and error states are required, not optional. Users see them in production even when they don't appear in your dev environment.
