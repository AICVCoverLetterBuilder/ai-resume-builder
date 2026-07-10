/**
 * @vitest-environment jsdom
 */
import { describe, expect, test, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PhotoUpload } from '@/components/PhotoUpload';

vi.mock('@/lib/i18n/context', () => ({
  useI18n: () => ({
    t: {
      cv: {
        photo: {
          title: 'Profile Photo',
          optional: 'Optional',
          shown: 'Shown',
          hidden: 'Hidden',
          shownDesc: 'Shown for your region',
          hiddenDesc: 'Photo is hidden.',
          change: 'Change Photo',
          upload: 'Upload Photo',
          recrop: 'Recrop',
          remove: 'Remove',
          hint: 'JPG or PNG, max 5MB.',
          aiEnhance: 'AI Photo Enhancement',
          aiEnhancing: 'Enhancing...',
          applied: 'Applied',
          upgrade: 'Upgrade to Pro',
          features: ['Background blur', 'Brightness', 'Skin tone', 'Auto center'],
          cropTitle: 'Crop photo',
          cropHint: 'Drag to reposition',
          apply: 'Apply',
          usRegion: 'Hidden for US region',
          otherRegion: 'Shown for your region',
          errorFormat: 'Upload JPG or PNG.',
        },
      },
      common: { cancel: 'Cancel' },
      onboarding: { upgradeToPro: 'Upgrade to Pro' },
    },
  }),
}));

describe('PhotoUpload mobile layout / AI Enhancement', () => {
  test('AI Photo Enhancement is always rendered without a photo', () => {
    const { container } = render(
      <PhotoUpload region="EU" isPro={false} onChange={vi.fn()} />,
    );
    expect(screen.getByText('AI Photo Enhancement')).toBeTruthy();
    expect(screen.getByText('Upload a photo to enhance')).toBeTruthy();
    expect(screen.getByText('PRO')).toBeTruthy();
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('w-full');
    expect(root.className).toContain('max-w-full');
    expect(root.className).toContain('min-w-0');
  });

  test('AI card stays inside the profile photo card when a photo exists', () => {
    const { container } = render(
      <PhotoUpload
        region="EU"
        isPro={false}
        photo="data:image/png;base64,abc"
        onChange={vi.fn()}
      />,
    );
    const root = container.firstElementChild as HTMLElement;
    const aiLabel = screen.getByText('AI Photo Enhancement');
    expect(root.contains(aiLabel)).toBe(true);
    expect(screen.getByText('Change Photo')).toBeTruthy();
    expect(screen.getByText('Recrop')).toBeTruthy();
    expect(screen.getByText('Upgrade to Pro')).toBeTruthy();
  });

  test('Free user with photo opens upgrade modal on AI Enhancement tap', () => {
    const onUpgradeRequest = vi.fn();
    render(
      <PhotoUpload
        region="EU"
        isPro={false}
        photo="data:image/png;base64,abc"
        onChange={vi.fn()}
        onUpgradeRequest={onUpgradeRequest}
      />,
    );
    fireEvent.click(screen.getByText('AI Photo Enhancement').closest('button')!);
    expect(onUpgradeRequest).toHaveBeenCalledTimes(1);
  });

  test('AI Enhancement without photo is disabled', () => {
    render(<PhotoUpload region="EU" isPro={true} onChange={vi.fn()} />);
    const btn = screen.getByText('AI Photo Enhancement').closest('button');
    expect(btn).toBeTruthy();
    expect(btn).toHaveProperty('disabled', true);
  });
});
