import React, {useState, useMemo} from 'react';
import {Box, Text, useInput, useStdin} from 'ink';
import {saveTasks} from './persist.js';

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
    if (key.backspace) {
      if (cursor === 0) return;
      setValue(v => {
        const before = v.slice(0, cursor - 1);
        const after = v.slice(cursor);
        setCursor(cursor - 1);
        return before + after;
      });
      return;
    }
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
    if (input) {
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

const Instructions = () => (
  React.createElement(Box, {marginTop: 1, flexDirection: 'column'},
    React.createElement(Text, {dimColor: true}, '↑/↓: Navigate   Space: Toggle   a: Add   e: Edit   d: Delete'),
    React.createElement(Text, {dimColor: true}, 's: Save   q: Quit   Esc: Cancel input   Enter: Confirm')
  )
);

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
  const [tasks, setTasks] = useState(initialTasks);
  const [selected, setSelected] = useState(0);
  const [mode, setMode] = useState('list'); // 'list' | 'add' | 'edit'
  const [editingIndex, setEditingIndex] = useState(null);
  const [notice, setNotice] = useState(null); // {text, color}

  const selectedSafe = useMemo(() => clamp(selected, 0, Math.max(tasks.length - 1, 0)), [selected, tasks.length]);

  const confirmSave = React.useCallback(() => {
    const ok = saveTasks(tasks);
    setNotice({text: ok ? 'Saved to .notex.json' : 'Save failed', color: ok ? 'green' : 'red'});
    const t = setTimeout(() => setNotice(null), 1200);
    return () => clearTimeout(t);
  }, [tasks]);

  // List mode key handling
  useInputCompat((input, key) => {
    if (mode !== 'list') return;
    if (key.upArrow) setSelected(i => clamp(i - 1, 0, Math.max(tasks.length - 1, 0)));
    else if (key.downArrow) setSelected(i => clamp(i + 1, 0, Math.max(tasks.length - 1, 0)));
    else if (input === ' ') {
      // Toggle done on Space
      if (tasks.length > 0) {
        setTasks(prev => {
          const next = prev.map((t, i) => i === selectedSafe ? {...t, done: !t.done} : t);
          saveTasks(next);
          return next;
        });
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
        setTasks(prev => {
          const next = prev.filter((_, i) => i !== selectedSafe);
          saveTasks(next);
          return next;
        });
        setSelected(i => clamp(i, 0, Math.max(tasks.length - 2, 0)));
      }
    } else if (input === 's') {
      confirmSave();
    } else if (input === 'q') {
      confirmSave();
      // Let Ink exit naturally
      process.nextTick(() => process.exit(0));
    }
  }, {isActive: isRawModeSupported && mode === 'list'});

  // Input modes
  const [addValue, setAddValue, addCursor, setAddCursor] = useTextInput({
    initial: '',
    active: isRawModeSupported && mode === 'add',
    onSubmit: text => {
      if (mode !== 'add') return;
      if (text) {
        setTasks(prev => {
          const next = prev.concat([{id: Date.now(), text, done: false}]);
          saveTasks(next);
          return next;
        });
        setSelected(tasks.length);
      }
      setMode('list');
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
      setTasks(prev => {
        const next = prev.map((t, i) => i === editingIndex ? {...t, text: text || t.text} : t);
        saveTasks(next);
        return next;
      });
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

  const renderList = () => (
    React.createElement(Box, {flexDirection: 'column'},
      React.createElement(Text, {bold: true}, 'TODOs (' + tasks.length + ')'),
      React.createElement(Box, {flexDirection: 'column', marginTop: 1},
        tasks.length === 0
          ? React.createElement(Text, {dimColor: true}, 'No tasks. Press "a" to add one.')
          : tasks.map((t, i) => React.createElement(TaskLine, {key: t.id, task: t, selected: i === selectedSafe}))
      ),
      React.createElement(Instructions, null),
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

  return React.createElement(Box, {flexDirection: 'column'},
    React.createElement(Text, {color: 'magentaBright', bold: true}, 'ink-notex'),
    mode === 'list' ? renderList() : mode === 'add' ? renderAdd() : renderEdit()
  );
}
