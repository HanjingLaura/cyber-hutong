import test from 'node:test';
import assert from 'node:assert/strict';
import { isTypingTarget, shouldEnableGameKeyboard } from '../src/keyboard-gate.mjs';

const world = { tagName: 'DIV' };
const canvas = { tagName: 'CANVAS' };
const input = { tagName: 'INPUT', isContentEditable: false, closest: () => null };
const textarea = { tagName: 'TEXTAREA', isContentEditable: false, closest: () => null };
const editable = { tagName: 'DIV', isContentEditable: true, closest: () => null };
const button = { tagName: 'BUTTON', isContentEditable: false, closest: () => null };

test('isTypingTarget recognizes inputs, textareas and contenteditable', () => {
  assert.equal(isTypingTarget(null), false);
  assert.equal(isTypingTarget(button), false);
  assert.equal(isTypingTarget(world), false);
  assert.equal(isTypingTarget(input), true);
  assert.equal(isTypingTarget(textarea), true);
  assert.equal(isTypingTarget(editable), true);
  assert.equal(isTypingTarget({ tagName: 'SPAN', isContentEditable: false, closest: (s) => s.includes('contenteditable') ? editable : null }), true);
});

test('game keyboard stays off during login dialog or form focus', () => {
  const base = { world, canvas, controller: true, userHasRole: false, connected: false };
  assert.equal(shouldEnableGameKeyboard({ ...base, activeElement: input, dialogOpen: true }), false);
  assert.equal(shouldEnableGameKeyboard({ ...base, activeElement: input, dialogOpen: false }), false);
  assert.equal(shouldEnableGameKeyboard({ ...base, activeElement: world, dialogOpen: true }), false);
  assert.equal(shouldEnableGameKeyboard({ ...base, activeElement: button, dialogOpen: false }), false);
});

test('game keyboard is on only when world is focused and control is live', () => {
  assert.equal(shouldEnableGameKeyboard({
    activeElement: world, world, canvas, dialogOpen: false, controller: true, userHasRole: true, connected: true,
  }), true);
  assert.equal(shouldEnableGameKeyboard({
    activeElement: canvas, world, canvas, dialogOpen: false, controller: true, userHasRole: true, connected: true,
  }), true);
  assert.equal(shouldEnableGameKeyboard({
    activeElement: world, world, canvas, dialogOpen: false, controller: true, userHasRole: false, connected: false,
  }), true);
  assert.equal(shouldEnableGameKeyboard({
    activeElement: world, world, canvas, dialogOpen: false, controller: false, userHasRole: true, connected: true,
  }), false);
  assert.equal(shouldEnableGameKeyboard({
    activeElement: world, world, canvas, dialogOpen: false, controller: true, userHasRole: true, connected: false,
  }), false);
});
