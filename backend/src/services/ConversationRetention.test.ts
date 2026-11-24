import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConversationRetention, type RetentionStore } from './ConversationRetention.js';

describe('ConversationRetention', () => {
  it('deletes unrecorded rounds until the database is under the limit', async () => {
    const sizes = [2_000, 1_500, 800];
    let deletedCalls = 0;
    const store: RetentionStore = {
      async sizeBytes() {
        return sizes.shift() ?? 800;
      },
      async deleteOldestUnrecorded() {
        deletedCalls += 1;
        return 25;
      },
      async onlyRecordedRoundsRemain() {
        return false;
      },
      async stripRecordedConversations() {
        throw new Error('should not strip while unrecorded rounds remain');
      },
      async reclaim() {},
    };
    const removed = await new ConversationRetention(1_000, store).enforce();
    assert.equal(removed, 50);
    assert.equal(deletedCalls, 2);
  });

  it('does not strip while any session is not a recorded round', async () => {
    const store: RetentionStore = {
      async sizeBytes() {
        return 5_000;
      },
      async deleteOldestUnrecorded() {
        return 0;
      },
      async onlyRecordedRoundsRemain() {
        return false;
      },
      async stripRecordedConversations() {
        throw new Error('should not strip while a session is not a recorded round');
      },
      async reclaim() {
        throw new Error('should not reclaim when nothing was freed');
      },
    };
    const removed = await new ConversationRetention(1_000, store).enforce();
    assert.equal(removed, 0);
  });

  it('strips recorded conversations when every remaining session is a recorded round', async () => {
    const sizes = [2_000, 800];
    let stripped = 0;
    const store: RetentionStore = {
      async sizeBytes() {
        return sizes.shift() ?? 800;
      },
      async deleteOldestUnrecorded() {
        return 0;
      },
      async onlyRecordedRoundsRemain() {
        return true;
      },
      async stripRecordedConversations() {
        stripped += 1;
        return 10;
      },
      async reclaim() {},
    };
    const removed = await new ConversationRetention(1_000, store).enforce();
    assert.equal(removed, 10);
    assert.equal(stripped, 1);
  });

  it('stops when nothing eligible remains', async () => {
    const store: RetentionStore = {
      async sizeBytes() {
        return 5_000;
      },
      async deleteOldestUnrecorded() {
        return 0;
      },
      async onlyRecordedRoundsRemain() {
        return true;
      },
      async stripRecordedConversations() {
        return 0;
      },
      async reclaim() {
        throw new Error('should not reclaim when nothing was freed');
      },
    };
    const removed = await new ConversationRetention(1_000, store).enforce();
    assert.equal(removed, 0);
  });
});
