import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createModelRoster, OPENROUTER_MODELS } from './models.js';

describe('ModelRoster', () => {
  it('uses the OpenRouter roster when that key is set', () => {
    const roster = createModelRoster({
      openRouterKey: 'sk-or-test',
      deepseekKey: 'sk-deepseek',
      referer: 'http://localhost:3000',
    });
    assert.equal(roster.name, 'openrouter');
    assert.equal(roster.modelFor('easy'), OPENROUTER_MODELS.easy);
    assert.equal(roster.modelFor('nightmare'), OPENROUTER_MODELS.nightmare);
    const call = roster.callFor('hard');
    assert.equal(call.baseUrl, 'https://openrouter.ai/api/v1');
    assert.equal(call.headers['X-Title'], "Don't Make Me Say");
    assert.deepEqual(call.bodyExtras, { reasoning: { enabled: false } });
  });

  it('lets one difficulty override the default slug', () => {
    const roster = createModelRoster({
      openRouterKey: 'sk-or-test',
      referer: 'http://localhost:3000',
      overrides: { normal: 'google/gemini-2.5-flash' },
    });
    assert.equal(roster.modelFor('normal'), 'google/gemini-2.5-flash');
    assert.equal(roster.modelFor('easy'), OPENROUTER_MODELS.easy);
  });

  it('falls back to DeepSeek chat when only that key is set', () => {
    const roster = createModelRoster({
      deepseekKey: 'sk-deepseek',
      referer: 'http://localhost:3000',
    });
    assert.equal(roster.name, 'deepseek');
    assert.equal(roster.callFor('nightmare').model, 'deepseek-chat');
    assert.deepEqual(roster.callFor('easy').bodyExtras, {});
  });
});
