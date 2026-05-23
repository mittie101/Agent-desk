import { describe, expect, test } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createServer } = require('../../backend/server');
const { createPhase5Runtime } = require('../../backend/phase5/runtime');

function createPhase5Server() {
  return createServer({ runtime: createPhase5Runtime() });
}

describe('Phase 5 stubbed end-to-end backend flow', () => {
  test('send chat starts fake AI flow, creates approval, and approval closes the run', async () => {
    const app = createPhase5Server();

    const send = await request(app)
      .post('/send_chat')
      .send({ message: 'Please update the workspace file.' })
      .expect(202);

    expect(send.body).toMatchObject({
      ok: true,
      chatMessage: { role: 'user' },
      approval: { status: 'pending', actionType: 'write_file' }
    });

    const agentsAfterSend = await request(app).get('/agents').expect(200);
    expect(agentsAfterSend.body.agents[0]).toMatchObject({ name: 'alice', status: 'running' });

    const eventsAfterSend = await request(app).get('/events').expect(200);
    expect(eventsAfterSend.body.events.map((event) => event.message)).toEqual(
      expect.arrayContaining([
        'Mock orchestrator streamed a response.',
        'Mock write_file approval requested.'
      ])
    );

    const approvalId = send.body.approval.id;
    const approve = await request(app)
      .post(`/approve/${approvalId}`)
      .send({ typedConfirmation: 'I understand this critical action' })
      .expect(200);

    expect(approve.body).toMatchObject({
      ok: true,
      approval: { id: approvalId, status: 'approved' },
      agent: { name: 'alice', status: 'idle' }
    });

    const finalEvents = await request(app).get('/events').expect(200);
    expect(finalEvents.body.events.map((event) => event.message)).toEqual(
      expect.arrayContaining([
        'Mock tool result emitted.',
        'Mock agent run closed.'
      ])
    );
  });

  test('required read routes expose agents, events, chat history, and snapshots', async () => {
    const app = createPhase5Server();

    await request(app).get('/agents').expect(200).expect((response) => {
      expect(response.body.agents[0].name).toBe('alice');
    });
    await request(app).get('/events').expect(200).expect((response) => {
      expect(Array.isArray(response.body.events)).toBe(true);
    });
    await request(app).get('/chat_history').expect(200).expect((response) => {
      expect(response.body.chat.some((message) => message.content.includes('Created alice'))).toBe(true);
    });
    await request(app).get('/snapshots').expect(200).expect((response) => {
      expect(response.body.snapshots).toEqual([]);
    });
  });

  test('deny and interrupt routes resolve pending work deterministically', async () => {
    const app = createPhase5Server();
    const send = await request(app).post('/send_chat').send({ message: 'Trigger approval.' }).expect(202);

    await request(app).post(`/deny/${send.body.approval.id}`).send({ reason: 'operator denied' }).expect(200);
    const deniedEvents = await request(app).get('/events').expect(200);
    expect(deniedEvents.body.events.map((event) => event.message)).toContain('Approval denied by operator.');

    await request(app).post('/send_chat').send({ message: 'Start another run.' }).expect(202);
    const interrupt = await request(app).post('/interrupt/alice').send({ reason: 'operator interrupt' }).expect(200);
    expect(interrupt.body.agent).toMatchObject({ name: 'alice', status: 'interrupted' });
  });

  test('critical confirmation is required for approval and settings save/reload works', async () => {
    const app = createPhase5Server();
    const send = await request(app).post('/send_chat').send({ message: 'Need protected write.' }).expect(202);

    await request(app)
      .post(`/approve/${send.body.approval.id}`)
      .send({ typedConfirmation: 'wrong phrase' })
      .expect(400)
      .expect((response) => {
        expect(response.body).toMatchObject({ ok: false, code: 'CONFIRMATION_MISMATCH' });
      });

    await request(app)
      .post('/settings')
      .send({ model: 'stub-model', maxBudget: 1.25, requireTypedConfirmation: true })
      .expect(200);

    await request(app).get('/settings').expect(200).expect((response) => {
      expect(response.body.settings).toEqual({
        model: 'stub-model',
        maxBudget: 1.25,
        requireTypedConfirmation: true
      });
    });
  });
});
