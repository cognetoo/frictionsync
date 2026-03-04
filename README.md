# FrictionSync

FrictionSync is an AI-powered browser extension that detects user learning friction while reading online content and provides personalized explanations using a multi-agent architecture.

## Architecture

FrictionSync follows a nervous-system inspired architecture:

Sensor (Content Script)
- Detects interaction signals like dwell time, backscroll, hover

Brain (Background Service Worker)
- Agent A: Signal Interpreter
- Agent B: Analogy Architect
- Agent C: Mastery Auditor

Identity (Popup + Options)
- Stores user interests
- Tracks mastery scores

## Features

- Friction detection from behavior signals
- Personalized analogies based on user interests
- Mastery tracking
- Privacy-first local architecture
- Shadow DOM overlays

## Tech Stack

- TypeScript
- Chrome Extension MV3
- Vite
- CRXJS plugin

## Future Enhancements

- Gemini Nano integration
- Session heatmaps
- Ghost Overlay rewriting
- Knowledge graph mastery tracking