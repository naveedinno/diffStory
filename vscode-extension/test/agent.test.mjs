import assert from 'node:assert/strict';
import test from 'node:test';

const { addressPrompt, repairPrompt, storyPrompt } = await import('../dist/agent.js');

test('story prompt pins the exact review scope and full story contract', () => {
  const prompt = storyPrompt({ base: 'main', head: 'feature/review', mode: 'detailed', note: 'Check comment recovery.', files: ['src/review.ts', 'test/review.test.ts'] });
  assert.match(prompt, /diffstory-storyteller/);
  assert.match(prompt, /main\.\.feature\/review/);
  assert.match(prompt, /mode to "detailed"/);
  assert.match(prompt, /Check comment recovery/);
  assert.match(prompt, /"includedFiles":\["src\/review\.ts","test\/review\.test\.ts"\]/);
  assert.match(prompt, /"reviewerNote":"Check comment recovery\."/);
  assert.match(prompt, /beats, calls, and returnsTo\.\n\nRead the actual code/);
});

test('address and repair prompts keep their work narrow', () => {
  assert.match(addressPrompt({ base: 'HEAD', commentIds: ['comment-a', 'comment-b'] }), /comment-a, comment-b/);
  const repair = repairPrompt({ base: 'main', action: 'split', stepId: 'core-flow', storyId: 'stories/review.json' });
  assert.match(repair, /only story step "core-flow"/);
  assert.match(repair, /\.diffstory\/stories\/review\.json/);
  assert.doesNotMatch(addressPrompt({ base: 'HEAD', commentIds: ['comment-a'] }), /\\n\\n/);
});
