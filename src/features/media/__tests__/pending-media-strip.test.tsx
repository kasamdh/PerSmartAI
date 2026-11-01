import { fireEvent, render, screen } from '@testing-library/react-native';

import { PendingMediaStrip } from '../pending-media-strip';
import type { MediaQueueItem } from '../upload-queue';

const item = (id: string, status: MediaQueueItem['status'], extra: Partial<MediaQueueItem> = {}) =>
  ({
    kind: 'media',
    id,
    visitId: 'v1',
    organizationId: 'org',
    mediaType: 'photo',
    fileUri: `file:///${id}.jpg`,
    thumbUri: `file:///${id}-thumb.jpg`,
    width: 1080,
    height: 810,
    durationSeconds: null,
    petIds: [],
    caption: null,
    createdAt: '2026-11-10T16:00:00Z',
    status,
    attempts: 0,
    nextAttemptAt: null,
    lastError: null,
    ...extra,
  }) as MediaQueueItem;

describe('PendingMediaStrip', () => {
  it('shows each item’s status', async () => {
    await render(
      <PendingMediaStrip
        items={[
          item('a', 'uploading'),
          item('b', 'sent'),
          item('c', 'waiting', { mediaType: 'video' }),
        ]}
        onRetry={jest.fn()}
      />,
    );
    expect(screen.getByLabelText('Photo: Uploading…')).toBeTruthy();
    expect(screen.getByLabelText('Photo: Sent')).toBeTruthy();
    expect(screen.getByLabelText('Video: Waiting for signal')).toBeTruthy();
  });

  it('offers a retry for failed uploads, with the reason', async () => {
    const onRetry = jest.fn();
    await render(
      <PendingMediaStrip
        items={[item('d', 'failed', { lastError: 'Payload too large' })]}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByText('Payload too large')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry sending this photo' }));
    expect(onRetry).toHaveBeenCalledWith('d');
  });

  it('renders nothing when the queue is empty', async () => {
    await render(<PendingMediaStrip items={[]} onRetry={jest.fn()} />);
    expect(screen.toJSON()).toBeNull();
  });
});
