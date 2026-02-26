/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';
import { messageService } from '../../../js/services/message.js';

describe('messageService', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="messageModal" style="display: none;">
        <div id="messageText"></div>
        <button id="closeMessageModalBtn"></button>
        <button id="okMessageBtn"></button>
      </div>
      <div id="confirmModal" style="display: none;">
        <div id="confirmText"></div>
        <button id="confirmYesBtn"></button>
        <button id="confirmNoBtn"></button>
        <button id="closeConfirmModalBtn"></button>
      </div>
    `;
    jest.clearAllMocks();
  });

  test('showMessage displays modal and sets text', () => {
    messageService.showMessage('Test message');
    const modal = document.getElementById('messageModal');
    const text = document.getElementById('messageText');
    expect(modal.style.display).toBe('flex');
    expect(text.textContent).toBe('Test message');
  });

  test('showHTML displays HTML content', () => {
    const html = '<strong>Test</strong>';
    messageService.showHTML(html);
    const modal = document.getElementById('messageModal');
    const text = document.getElementById('messageText');
    expect(modal.style.display).toBe('flex');
    expect(text.innerHTML).toBe(html);
  });

  test('showConfirm shows modal and triggers callback on yes', (done) => {
    messageService.showConfirm('Confirm?', () => {
      done();
    });
    const modal = document.getElementById('confirmModal');
    expect(modal.style.display).toBe('flex');
    document.getElementById('confirmYesBtn').click();
  });

  test('showConfirm hides modal on no', () => {
    messageService.showConfirm('Confirm?', () => {});
    document.getElementById('confirmNoBtn').click();
    const modal = document.getElementById('confirmModal');
    expect(modal.style.display).toBe('none');
  });

  test('close buttons work', () => {
    messageService.showMessage('Test');
    document.getElementById('closeMessageModalBtn').click();
    expect(document.getElementById('messageModal').style.display).toBe('none');

    messageService.showMessage('Test');
    document.getElementById('okMessageBtn').click();
    expect(document.getElementById('messageModal').style.display).toBe('none');
  });
});












