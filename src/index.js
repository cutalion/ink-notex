import React from 'react';
import {render} from 'ink';
import {App} from './ui.js';
import {loadTasks} from './persist.js';

const initial = loadTasks();

const canUseRawMode = Boolean(process.stdin && typeof process.stdin.setRawMode === 'function');
render(
  React.createElement(App, {initialTasks: initial}),
  {
    isRawModeSupported: canUseRawMode,
    exitOnCtrlC: false // handle Ctrl+C ourselves (double-press to exit)
  }
);
