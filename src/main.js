import * as engine from '../src/engine.js';
import { initUI } from '../src/ui.js';

// 1. Initialize the UI and pass it the engine to bind to
initUI(engine);

// 2. Hydrate the engine with initial data
engine.initEngine({});