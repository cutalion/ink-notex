import React, {useState, useMemo} from 'react';
import {Box, Text, useInput, useStdin, useStdout, useApp} from 'ink';
import path from 'path';
import os from 'os';
import {saveTasks, loadTasks, DEFAULT_FILE, GLOBAL_FILE, fileExists} from './persist.js';

const RAW_SUPPORTED = Boolean(process.stdin && typeof process.stdin.setRawMode === 'function');

function useInputCompat(handler, options) {
  if (RAW_SUPPORTED) {
    // Only register Ink's useInput when raw mode is supported
    useInput(handler, options);
  }
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function deleteLastWord(text) {
  if (!text) return text;
  // Trim trailing spaces, remove last word, then trailing spaces again
  let s = text.replace(/\s+$/, '');
  s = s.replace(/\S+$/, '');
  s = s.replace(/\s+$/, '');
  return s;
}

function useTextInput({initial = '', onSubmit, onCancel, active = true}) {
  const [value, setValue] = useState(initial);
  const [cursor, setCursor] = useState(initial.length);
  useInputCompat((input, key) => {
    if (key.escape) {
      onCancel?.();
      return;
    }
    // Word navigation
    if (key.ctrl && key.leftArrow) {
      setCursor(pos => {
        let i = Math.max(0, pos - 1);
        const s = value;
        while (i > 0 && /\s/.test(s[i])) i--;
        while (i > 0 && /\S/.test(s[i - 1])) i--;
        return i;
      });
      return;
    }
    if (key.ctrl && key.rightArrow) {
      setCursor(pos => {
        let i = Math.min(value.length, pos + 1);
        const s = value;
        while (i < s.length && /\s/.test(s[i])) i++;
        while (i < s.length && /\S/.test(s[i])) i++;
        return i;
      });
      return;
    }
    // Single-char navigation
    if (key.leftArrow) {
      setCursor(pos => Math.max(0, pos - 1));
      return;
    }
    if (key.rightArrow) {
      setCursor(pos => Math.min(value.length, pos + 1));
      return;
    }
    if (key.ctrl && (input === 'w' || input === 'W')) {
      setValue(v => {
        const before = v.slice(0, cursor);
        const after = v.slice(cursor);
        const trimmed = deleteLastWord(before);
        setCursor(trimmed.length);
        return trimmed + after;
      });
      return;
    }
    if (key.return) {
      onSubmit?.(value.trim());
      return;
    }
    // Backspace (handle both BS and DEL codes)
    if (key.backspace || input === '\\u0008' || input === '\\u007f') {
      if (cursor === 0) return;
      setValue(v => {
        const before = v.slice(0, cursor - 1);
        const after = v.slice(cursor);
        setCursor(cursor - 1);
        return before + after;
      });
      return;
    }
    // Delete
    if (key.delete) {
      setValue(v => {
        if (cursor >= v.length) return v;
        const before = v.slice(0, cursor);
        const after = v.slice(cursor + 1);
        return before + after;
      });
      return;
    }
    if (key.ctrl && input === 'c') {
      // Allow Ctrl+C to bubble to Ink to exit
      return;
    }
    // Only insert printable characters
    if (input && !key.ctrl && input >= ' ' && input !== '\\u007f') {
      setValue(v => {
        const before = v.slice(0, cursor);
        const after = v.slice(cursor);
        setCursor(cursor + input.length);
        return before + input + after;
      });
    }
  }, {isActive: active});
  return [value, setValue, cursor, setCursor];
}

const Instructions = ({displayPath}) => (
  React.createElement(Box, {marginTop: 1, flexDirection: 'column'},
    React.createElement(Text, {dimColor: true}, 'h/? Help   o Settings   q Quit'),
    React.createElement(Text, {dimColor: true}, '> ' + displayPath)
  )
);

function formatDisplayPath(filePath) {
  try {
    const cwd = process.cwd();
    const rel = path.relative(cwd, filePath);
    if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) {
      return rel;
    }
  } catch {}
  try {
    const home = os.homedir ? os.homedir() : process.env.HOME || '';
    if (home && (filePath === home || filePath.startsWith(home + path.sep))) {
      return '~' + filePath.slice(home.length);
    }
  } catch {}
  return filePath;
}

function TaskLine({task, selected}) {
  const prefix = selected ? '>' : ' ';
  const checkbox = task.done ? '[x]' : '[ ]';
  const color = task.done ? 'green' : 'white';
  const textProps = task.done ? {strikethrough: true, dimColor: true} : {};
  return React.createElement(Box, {},
    React.createElement(Text, {color: 'cyan'}, prefix + ' '),
    React.createElement(Text, {color}, checkbox + ' '),
    React.createElement(Text, textProps, task.text)
  );
}

export function App({initialTasks = []}) {
  const {isRawModeSupported} = useStdin();
  const {stdout} = useStdout();
  const {exit} = useApp();

  const [storage, setStorage] = useState(() => {
    if (fileExists(DEFAULT_FILE)) return 'project';
    if (fileExists(GLOBAL_FILE)) return 'global';
    return 'project';
  });

  const [tasks, setTasks] = useState(() => {
    const path = (fileExists(DEFAULT_FILE) || !fileExists(GLOBAL_FILE)) ? DEFAULT_FILE : GLOBAL_FILE;
    const loaded = loadTasks(path);
    return loaded && loaded.length ? loaded : (initialTasks || []);
  });

  const [history, setHistory] = useState([]); // stack of past states
  const [future, setFuture] = useState([]);   // stack of redo states
  const [selected, setSelected] = useState(0);
  const [mode, setMode] = useState('list'); // 'list' | 'add' | 'edit' | 'help' | 'settings'
  const [editingIndex, setEditingIndex] = useState(null);
  const [notice, setNotice] = useState(null); // {text, color}
  const [exitArmedAt, setExitArmedAt] = useState(null); // timestamp for double Ctrl+C
  const [settingsIndex, setSettingsIndex] = useState(0); // selection in settings
  const [scrollOffset, setScrollOffset] = useState(0);

  const selectedSafe = useMemo(() => clamp(selected, 0, Math.max(tasks.length - 1, 0)), [selected, tasks.length]);

  const currentFile = storage === 'global' ? GLOBAL_FILE : DEFAULT_FILE;

  function applyChange(nextTasks) {
    setHistory(h => (h.length > 300 ? h.slice(-300) : h).concat([tasks]));
    setFuture([]);
    setTasks(nextTasks);
    saveTasks(nextTasks, currentFile);
  }

  function undo() {
    setHistory(h => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      setFuture(f => f.concat([tasks]));
      setTasks(prev);
      saveTasks(prev, currentFile);
      return h.slice(0, -1);
    });
  }

  function redo() {
    setFuture(f => {
      if (!f.length) return f;
      const next = f[f.length - 1];
      setHistory(h => h.concat([tasks]));
      setTasks(next);
      saveTasks(next, currentFile);
      return f.slice(0, -1);
    });
  }

  const confirmSave = React.useCallback(() => {
    const ok = saveTasks(tasks, currentFile);
    const where = storage === 'global' ? 'Global' : 'Project';
    setNotice({text: ok ? 'Saved (' + where + ')' : 'Save failed', color: ok ? 'green' : 'red'});
    const t = setTimeout(() => setNotice(null), 1200);
    return () => clearTimeout(t);
  }, [tasks, currentFile, storage]);

  // Clear notices on mode change
  React.useEffect(() => {
    setNotice(null);
  }, [mode]);

  // Global key handling (help, settings, undo/redo, safe exit)
  useInputCompat((input, key) => {
    // Any keypress clears existing transient notice
    if (notice) setNotice(null);
    // Double Ctrl+C to exit
    if (key.ctrl && input === 'c') {
      const now = Date.now();
      if (exitArmedAt && now - exitArmedAt < 1500) {
        confirmSave();
        exit();
        return;
      }
      setExitArmedAt(now);
      setNotice({text: 'Press Ctrl+C again to exit…', color: 'yellow'});
      setTimeout(() => setExitArmedAt(null), 1500);
      setTimeout(() => setNotice(null), 1500);
      return;
    }
    // Close help with Esc
    if (key.escape && mode === 'help') {
      setMode('list');
      return;
    }
    // Avoid capturing character keys while typing
    if (mode === 'add' || mode === 'edit') return;
    if (key.ctrl && input === 'z') {
      undo();
      return;
    }
    if ((key.ctrl && input === 'y') || (key.ctrl && key.shift && (input === 'Z' || input === 'z'))) {
      redo();
      return;
    }
    if (input === 'u') { undo(); return; }
    if (input === 'r') { redo(); return; }
    if (input === 'h' || input === '?') {
      setMode(m => (m === 'help' ? 'list' : 'help'));
      return;
    }
    if (input === 'o') {
      setSettingsIndex(storage === 'project' ? 0 : 1);
      setMode('settings');
      return;
    }
  }, {isActive: isRawModeSupported});

  // List mode key handling
  useInputCompat((input, key) => {
    if (mode !== 'list') return;
    if (key.upArrow) setSelected(i => clamp(i - 1, 0, Math.max(tasks.length - 1, 0)));
    else if (key.downArrow) setSelected(i => clamp(i + 1, 0, Math.max(tasks.length - 1, 0)));
    else if (input === ' ') {
      // Toggle done on Space
      if (tasks.length > 0) {
        const next = tasks.map((t, i) => i === selectedSafe ? {
          ...t,
          done: !t.done,
          completedAt: !t.done ? Date.now() : null
        } : t);
        applyChange(next);
      }
    } else if (key.return) {
      // Enter -> Edit selected item
      if (tasks.length > 0) {
        setEditingIndex(selectedSafe);
        setMode('edit');
      }
    } else if (input === 'a') {
      setMode('add');
    } else if (input === 'e') {
      if (tasks.length > 0) {
        setEditingIndex(selectedSafe);
        setMode('edit');
      }
    } else if (input === 'd') {
      if (tasks.length > 0) {
        const next = tasks.filter((_, i) => i !== selectedSafe);
        applyChange(next);
        setSelected(i => clamp(i, 0, Math.max(next.length - 1, 0)));
      }
    } else if (input === 's') {
      confirmSave();
    } else if (input === 'q') {
      confirmSave();
      exit();
    }
  }, {isActive: isRawModeSupported && mode === 'list'});

  // Input modes
  const [addValue, setAddValue, addCursor, setAddCursor] = useTextInput({
    initial: '',
    active: isRawModeSupported && mode === 'add',
    onSubmit: text => {
      if (mode !== 'add') return;
      if (text) {
        const next = tasks.concat([{id: Date.now(), text, done: false, createdAt: Date.now(), completedAt: null}]);
        applyChange(next);
        setSelected(tasks.length);
      }
      setAddValue('');
      setAddCursor(0);
    },
    onCancel: () => {
      if (mode === 'add') setMode('list');
    }
  });

  const [editValue, setEditValue, editCursor, setEditCursor] = useTextInput({
    initial: editingIndex != null && tasks[editingIndex] ? tasks[editingIndex].text : '',
    active: isRawModeSupported && mode === 'edit',
    onSubmit: text => {
      if (mode !== 'edit') return;
      const next = tasks.map((t, i) => i === editingIndex ? {...t, text: text || t.text} : t);
      applyChange(next);
      setMode('list');
      setEditingIndex(null);
    },
    onCancel: () => {
      if (mode === 'edit') {
        setMode('list');
        setEditingIndex(null);
      }
    }
  });

  // When entering edit mode, seed the input with current text
  React.useEffect(() => {
    if (mode === 'edit' && editingIndex != null && tasks[editingIndex]) {
      const t = tasks[editingIndex].text;
      setEditValue(t);
      setEditCursor(t.length);
    }
  }, [mode, editingIndex, tasks, setEditValue]);

  // Keep selected visible with a simple scroll window sized to terminal rows
  React.useEffect(() => {
    const rows = stdout && stdout.rows ? stdout.rows : 24;
    const header = 5; // title + stats + padding
    const footer = 6; // instructions + notices
    const visible = Math.max(3, rows - header - footer);
    const maxIndex = tasks.length - 1;
    const sel = selectedSafe;
    let off = scrollOffset;
    if (sel < off) off = sel;
    if (sel > off + visible - 1) off = sel - (visible - 1);
    off = clamp(off, 0, Math.max(0, maxIndex - visible + 1));
    if (off !== scrollOffset) setScrollOffset(off);
  }, [stdout, tasks.length, selectedSafe, scrollOffset]);

  const rows = stdout && stdout.rows ? stdout.rows : 24;
  const header = 5;
  const footer = 6;
  const visibleCount = Math.max(3, rows - header - footer);
  const start = scrollOffset;
  const end = Math.min(tasks.length, start + visibleCount);
  const visibleTasks = tasks.slice(start, end);

  const completedCount = useMemo(() => tasks.filter(t => t.done).length, [tasks]);

  const renderList = () => (
    React.createElement(Box, {flexDirection: 'column'},
      React.createElement(Text, {bold: true}, 'TODOs (' + tasks.length + ')  Completed: ' + completedCount + '  [' + (storage === 'global' ? 'Global' : 'Project') + ']'),
      tasks.length > 0 && start > 0 && React.createElement(Text, {dimColor: true}, '… ' + start + ' more above'),
      React.createElement(Box, {flexDirection: 'column', marginTop: 1},
        tasks.length === 0
          ? React.createElement(Text, {dimColor: true}, 'No tasks. Press "a" to add one.')
          : visibleTasks.map((t, i) => React.createElement(TaskLine, {key: t.id, task: t, selected: (start + i) === selectedSafe}))
      ),
      tasks.length > end && React.createElement(Text, {dimColor: true}, '… ' + (tasks.length - end) + ' more below'),
      // Hide global hints while adding to reduce clutter
      mode !== 'add' && React.createElement(Instructions, {displayPath: formatDisplayPath(currentFile)}),
      // Inline Add input when in Add mode
      mode === 'add' && React.createElement(Box, {flexDirection: 'column', marginTop: 0},
        React.createElement(Text, {bold: true}, 'Add task'),
        React.createElement(Box, null,
          React.createElement(Text, null, '> '),
          React.createElement(Text, null, addValue.slice(0, addCursor)),
          React.createElement(Text, {inverse: true}, addCursor === addValue.length ? ' ' : addValue[addCursor]),
          addCursor < addValue.length && React.createElement(Text, null, addValue.slice(addCursor + 1))
        ),
        React.createElement(Text, {dimColor: true}, 'Enter: Add   Esc: Cancel   Ctrl+←/→: Word jump   Ctrl+W: Delete word')
      ),
      notice && React.createElement(Text, {color: notice.color}, notice.text),
      !RAW_SUPPORTED && React.createElement(Text, {dimColor: true}, 'Note: Read-only here (no raw input). Run in a real TTY to interact.')
    )
  );

  const renderAdd = () => (
    React.createElement(Box, {flexDirection: 'column'},
      React.createElement(Text, {bold: true}, 'Add task'),
      React.createElement(Box, {marginY: 1, paddingY: 1},
        React.createElement(Text, null, '> '),
        React.createElement(Text, null, addValue.slice(0, addCursor)),
        React.createElement(Text, {inverse: true}, addCursor === addValue.length ? ' ' : addValue[addCursor]),
        addCursor < addValue.length && React.createElement(Text, null, addValue.slice(addCursor + 1))
      ),
      React.createElement(Text, {dimColor: true}, 'Enter: Add   Esc: Cancel   Ctrl+←/→: Word jump   Ctrl+W: Delete word')
    )
  );

  const renderEdit = () => (
    React.createElement(Box, {flexDirection: 'column'},
      React.createElement(Text, {bold: true}, 'Edit task'),
      React.createElement(Box, {marginY: 1, paddingY: 1},
        React.createElement(Text, null, '> '),
        React.createElement(Text, null, editValue.slice(0, editCursor)),
        React.createElement(Text, {inverse: true}, editCursor === editValue.length ? ' ' : editValue[editCursor]),
        editCursor < editValue.length && React.createElement(Text, null, editValue.slice(editCursor + 1))
      ),
      React.createElement(Text, {dimColor: true}, 'Enter: Save   Esc: Cancel   Ctrl+←/→: Word jump   Ctrl+W: Delete word')
    )
  );

  const renderHelp = () => {
    const cols = stdout && stdout.columns ? stdout.columns : 80;

    const sections = [
      {title: 'Navigation', items: [
        ['↑/↓', 'Move selection'],
        ['Space', 'Toggle done']
      ]},
      {title: 'Editing', items: [
        ['a', 'Add task'],
        ['e / Enter', 'Edit task'],
        ['d', 'Delete task'],
        ['Esc', 'Cancel input']
      ]},
      {title: 'History', items: [
        ['u / Ctrl+Z', 'Undo'],
        ['r / Ctrl+Y', 'Redo']
      ]},
      {title: 'Settings', items: [
        ['o', 'Open settings'],
        ['s', 'Save now (autosave on)']
      ]},
      {title: 'App', items: [
        ['h / ?', 'Toggle help'],
        ['q', 'Save & quit'],
        ['Ctrl+C ×2', 'Exit (confirm)']
      ]}
    ];

    const keyWidth = sections.reduce((m, sec) => Math.max(m, ...sec.items.map(([k]) => k.length)), 0) + 2;

    const Section = ({sec}) => (
      React.createElement(Box, {flexDirection: 'column', marginBottom: 1},
        React.createElement(Text, {bold: true}, sec.title),
        ...sec.items.map(([k, d], idx) => (
          React.createElement(Box, {key: sec.title + idx},
            React.createElement(Text, {color: 'cyan'}, (k + ' ').padEnd(keyWidth, ' ')),
            React.createElement(Text, null, d)
          )
        ))
      )
    );

    const twoCols = cols >= 72;
    const left = twoCols ? sections.slice(0, Math.ceil(sections.length / 2)) : sections;
    const right = twoCols ? sections.slice(Math.ceil(sections.length / 2)) : [];

    return React.createElement(Box, {flexDirection: 'column'},
      React.createElement(Text, {bold: true}, 'Help & Shortcuts'),
      twoCols
        ? React.createElement(Box, {flexDirection: 'row', marginTop: 1},
            React.createElement(Box, {flexDirection: 'column', marginRight: 4},
              ...left.map((sec) => React.createElement(Section, {key: sec.title, sec}))
            ),
            React.createElement(Box, {flexDirection: 'column'},
              ...right.map((sec) => React.createElement(Section, {key: sec.title, sec}))
            )
          )
        : React.createElement(Box, {flexDirection: 'column', marginTop: 1},
            ...left.map((sec) => React.createElement(Section, {key: sec.title, sec}))
          ),
      React.createElement(Text, {dimColor: true}, 'Current storage: ' + (storage === 'global' ? 'Global' : 'Project') + ' (' + currentFile + ')')
    );
  };

  // Settings mode: choose storage location
  useInputCompat((input, key) => {
    if (mode !== 'settings') return;
    if (key.escape) {
      setMode('list');
      return;
    }
    if (key.upArrow || input === 'k') {
      setSettingsIndex(i => clamp(i - 1, 0, 1));
      return;
    }
    if (key.downArrow || input === 'j') {
      setSettingsIndex(i => clamp(i + 1, 0, 1));
      return;
    }
    if (key.return) {
      const nextStorage = settingsIndex === 0 ? 'project' : 'global';
      if (nextStorage !== storage) {
        setHistory(h => h.concat([tasks])); // keep history across switches
        setFuture([]);
        setStorage(nextStorage);
        const fp = nextStorage === 'global' ? GLOBAL_FILE : DEFAULT_FILE;
        const loaded = loadTasks(fp);
        setTasks(loaded);
      }
      setMode('list');
      return;
    }
  }, {isActive: isRawModeSupported && mode === 'settings'});

  const renderSettings = () => (
    React.createElement(Box, {flexDirection: 'column'},
      React.createElement(Text, {bold: true}, 'Settings'),
      React.createElement(Text, null, 'Storage location'),
      React.createElement(Box, {flexDirection: 'column', marginTop: 1},
        React.createElement(Text, {color: settingsIndex === 0 ? 'cyan' : undefined}, (settingsIndex === 0 ? '> ' : '  ') + 'Project (./.notex.json)'),
        React.createElement(Text, {color: settingsIndex === 1 ? 'cyan' : undefined}, (settingsIndex === 1 ? '> ' : '  ') + 'Global (~/.notex-global.json)')
      ),
      React.createElement(Text, {dimColor: true}, 'Use ↑/↓ then Enter to select. Esc to cancel.')
    )
  );

  return React.createElement(Box, {flexDirection: 'column'},
    React.createElement(Text, {color: 'magentaBright', bold: true}, 'ink-notex'),
    (mode === 'list' || mode === 'add') ? renderList() :
    mode === 'edit' ? renderEdit() :
    mode === 'help' ? renderHelp() :
    renderSettings()
  );
}
