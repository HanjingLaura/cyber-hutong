import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseGuestAppearance} from '../shared/guest-appearance.mjs';

test('Zhu has two equally divided appearance ranges including boundary',()=>{
  assert.equal(chooseGuestAppearance('zhu',()=>0),'classic');
  assert.equal(chooseGuestAppearance('zhu',()=>.499999),'classic');
  assert.equal(chooseGuestAppearance('zhu',()=>.5),'winter');
  assert.equal(chooseGuestAppearance('zhu',()=>.999999),'winter');
});
test('other guests retain their appearance without consuming random choices',()=>{
  for(const id of ['buzz','ferret','lulu','tutu'])assert.equal(chooseGuestAppearance(id,()=>{throw Error('unexpected random');}),'classic');
});
