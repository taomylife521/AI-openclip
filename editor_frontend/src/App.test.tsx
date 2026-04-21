import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { t } from './i18n'

const manifestProject = {
  project_id: 'proj-real',
  source_video_title: 'Manifest Project',
  source_video_path: 'source.mp4',
  source_video_url: '/api/projects/proj-real/media/source',
  source_video_duration: 180,
  updated_at: '2026-04-20T00:00:00Z',
  clips: [
    {
      clip_id: 'clip-real-1',
      title: 'Loaded Clip',
      video_part: 'part01',
      start_time: '00:00:05',
      end_time: '00:00:20',
      absolute_start_time: '00:00:05',
      absolute_end_time: '00:00:20',
      absolute_time_range: '00:00:05 - 00:00:20',
      asset_registry: { current_composed_clip: 'clips_post_processed/clip-real-1.mp4' },
      subtitle_recipe: { override_text: 'Loaded subtitle' },
      effective_subtitle_text: 'Loaded subtitle',
      has_manual_subtitle_override: true,
      cover_recipe: { text: 'Loaded cover' },
      current_composed_clip_url: '/api/projects/proj-real/media/clips_post_processed/clip-real-1.mp4',
      horizontal_cover_url: '/api/projects/proj-real/media/covers/cover-clip-real-1-horizontal.jpg',
      vertical_cover_url: '/api/projects/proj-real/media/covers/cover-clip-real-1-vertical.jpg',
      recovery: {},
      metadata: {},
    },
    {
      clip_id: 'clip-real-2',
      title: 'Second Clip',
      video_part: 'part01',
      start_time: '00:00:25',
      end_time: '00:00:40',
      absolute_start_time: '00:00:25',
      absolute_end_time: '00:00:40',
      absolute_time_range: '00:00:25 - 00:00:40',
      asset_registry: { current_composed_clip: 'clips_post_processed/clip-real-2.mp4' },
      subtitle_recipe: { override_text: 'Second subtitle' },
      effective_subtitle_text: 'Second subtitle',
      has_manual_subtitle_override: false,
      cover_recipe: { text: 'Second cover' },
      current_composed_clip_url: '/api/projects/proj-real/media/clips_post_processed/clip-real-2.mp4',
      horizontal_cover_url: '/api/projects/proj-real/media/covers/cover-clip-real-2-horizontal.jpg',
      vertical_cover_url: '/api/projects/proj-real/media/covers/cover-clip-real-2-vertical.jpg',
      recovery: {},
      metadata: {},
    },
  ],
}

describe('OpenClip editor shell', () => {
  const playSpy = vi.fn().mockResolvedValue(undefined)
  const pauseSpy = vi.fn()
  const localStorageState = new Map<string, string>()
  const localStorageMock = {
    getItem: vi.fn((key: string) => localStorageState.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      localStorageState.set(key, value)
    }),
    removeItem: vi.fn((key: string) => {
      localStorageState.delete(key)
    }),
    clear: vi.fn(() => {
      localStorageState.clear()
    }),
  }

  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    writable: true,
    value: playSpy,
  })
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    writable: true,
    value: pauseSpy,
  })
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    writable: true,
    value: localStorageMock,
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    playSpy.mockClear()
    pauseSpy.mockClear()
    localStorageMock.clear()
    localStorageMock.getItem.mockClear()
    localStorageMock.setItem.mockClear()
    localStorageMock.removeItem.mockClear()
    localStorageMock.clear.mockClear()
    document.documentElement.style.colorScheme = ''
  })

  const zh = (key: Parameters<typeof t>[1], values?: Parameters<typeof t>[2]) => t('zh', key, values)
  const en = (key: Parameters<typeof t>[1], values?: Parameters<typeof t>[2]) => t('en', key, values)

  it('shows a safe fallback when the editor service cannot load', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Project demo-openclip-project not found yet; showing demo shell fallback.')))

    render(<App />)

    await screen.findAllByText(/showing demo shell fallback/i)
    expect(screen.getByRole('heading', { name: zh('editorUnavailable') })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: zh('retryLoad') })).toBeInTheDocument()
  })

  it('loads a manifest-backed project when the editor service responds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => manifestProject }))

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Loaded Clip' })).toBeInTheDocument()
    expect(screen.getByText(zh('loadedManifestProjectStatus', { projectName: 'Manifest Project' }))).toBeInTheDocument()
    expect(screen.getByDisplayValue('Loaded subtitle')).toBeInTheDocument()
    expect(screen.getByRole('article', { name: zh('postProcessedPreview') })).toBeInTheDocument()
    expect(screen.getByRole('article', { name: zh('horizontalCoverPreview') })).toBeInTheDocument()
    expect(screen.getByRole('article', { name: zh('verticalCoverPreview') })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: zh('openDiagnosticsDrawer') })).toBeInTheDocument()
    expect(document.querySelector('.shell[data-theme="dark"]')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: zh('switchToLightTheme') })).toBeInTheDocument()
  })

  it('opens and closes diagnostics in a right-side drawer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => manifestProject }))
    const user = userEvent.setup()

    render(<App />)

    await screen.findByRole('heading', { name: 'Loaded Clip' })
    const diagnosticsButton = screen.getByRole('button', { name: zh('openDiagnosticsDrawer') })
    const drawer = screen.getByRole('complementary', { name: zh('diagnosticsDrawer') })

    expect(drawer.className).not.toContain('diagnostics-drawer--open')

    await user.click(diagnosticsButton)
    expect(drawer.className).toContain('diagnostics-drawer--open')
    expect(screen.getByRole('heading', { name: zh('editorDiagnostics') })).toBeInTheDocument()
    expect(screen.getByText(zh('recentActivity'))).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: zh('closeDiagnosticsDrawer') }))
    expect(drawer.className).not.toContain('diagnostics-drawer--open')
  })

  it('defaults to Chinese and can switch language while persisting the preference', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => manifestProject }))
    const user = userEvent.setup()

    render(<App />)

    await screen.findByRole('heading', { name: 'Loaded Clip' })
    expect(screen.getByRole('heading', { name: zh('subtitleEditor') })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: zh('switchToLightTheme') })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'EN' }))

    expect(screen.getByRole('heading', { name: en('subtitleEditor') })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: en('switchToLightTheme') })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: en('openDiagnosticsDrawer') })).toBeInTheDocument()
    expect(localStorageMock.getItem('openclip-editor-language')).toBe('en')

    await user.click(screen.getByRole('button', { name: '中文' }))

    expect(screen.getByRole('heading', { name: zh('subtitleEditor') })).toBeInTheDocument()
    expect(localStorageMock.getItem('openclip-editor-language')).toBe('zh')
  })

  it('keeps unsaved subtitle edits when switching language', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => manifestProject })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    await screen.findByRole('heading', { name: 'Loaded Clip' })
    const subtitleField = screen.getByLabelText(zh('subtitleOverride'))

    await user.clear(subtitleField)
    await user.type(subtitleField, 'Unsaved bilingual draft')
    expect(screen.getByDisplayValue('Unsaved bilingual draft')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'EN' }))

    expect(screen.getByRole('heading', { name: en('subtitleEditor') })).toBeInTheDocument()
    expect(screen.getByDisplayValue('Unsaved bilingual draft')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('toggles to light theme and persists the preference', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => manifestProject }))
    const user = userEvent.setup()

    render(<App />)

    await screen.findByRole('heading', { name: 'Loaded Clip' })
    await user.click(screen.getByRole('button', { name: zh('switchToLightTheme') }))

    expect(document.querySelector('.shell[data-theme="light"]')).toBeInTheDocument()
    expect(localStorageMock.getItem('openclip-editor-theme')).toBe('light')
    expect(document.documentElement.style.colorScheme).toBe('light')
    expect(screen.getByRole('button', { name: zh('switchToDarkTheme') })).toBeInTheDocument()
  })

  it('uses the saved light theme preference on first render', async () => {
    localStorageMock.setItem('openclip-editor-theme', 'light')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => manifestProject }))

    render(<App />)

    await screen.findByRole('heading', { name: 'Loaded Clip' })
    expect(document.querySelector('.shell[data-theme="light"]')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: zh('switchToDarkTheme') })).toBeInTheDocument()
  })

  it('keeps timeline above subtitle and cover sections and shows the rendered subtitle preview', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => manifestProject }))

    render(<App />)

    await screen.findByRole('heading', { name: 'Loaded Clip' })
    const timelineHeading = screen.getByRole('heading', { name: zh('timelinePreview') })
    const subtitleHeading = screen.getByRole('heading', { name: zh('subtitleEditor') })
    const coverHeading = screen.getByRole('heading', { name: zh('coverTitleEditor') })
    const previewPanel = screen.getByRole('article', { name: zh('postProcessedPreview') })
    const previewVideo = previewPanel.querySelector('video')

    expect(timelineHeading.compareDocumentPosition(subtitleHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(subtitleHeading.compareDocumentPosition(coverHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(previewPanel).toHaveTextContent(zh('postProcessedPreviewDescription'))
    expect(previewVideo?.getAttribute('src')).toBe('/api/projects/proj-real/media/clips_post_processed/clip-real-1.mp4?v=2026-04-20T00%3A00%3A00Z')
  })

  it('selecting another clip auto-seeks preview without autoplay even when the source URL is unchanged', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => manifestProject }))
    const user = userEvent.setup()

    render(<App />)

    await screen.findByRole('heading', { name: 'Loaded Clip' })
    const video = document.querySelector('video') as HTMLVideoElement
    expect(video).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Second Clip/i }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Second Clip' })).toBeInTheDocument())
    expect(video.currentTime).toBe(25)
    expect(pauseSpy).toHaveBeenCalled()
    expect(playSpy).not.toHaveBeenCalled()
  })

  it('shows dirty state and clears it after a successful manifest-backed save', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => manifestProject })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...manifestProject, clips: [{ ...manifestProject.clips[0], subtitle_recipe: { override_text: 'New subtitle draft from the shell.' }, effective_subtitle_text: 'New subtitle draft from the shell.' }] }) })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)
    await screen.findByRole('heading', { name: 'Loaded Clip' })

    const subtitleField = screen.getByLabelText(zh('subtitleOverride'))
    await user.clear(subtitleField)
    await user.type(subtitleField, 'New subtitle draft from the shell.')

    expect(screen.getByText(zh('dirtyStateDetected'))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: zh('queueRerender', { operation: zh('operationSubtitle') }) })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: zh('saveDraftToManifest') }))

    await waitFor(() => expect(screen.getByText(zh('draftMatchesSavedManifest'))).toBeInTheDocument())
    expect(screen.getByRole('button', { name: zh('queueRerender', { operation: zh('operationSubtitle') }) })).toBeDisabled()
  })

  it('shows inline boundary rerender feedback while a boundary rerender is in progress', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...manifestProject,
        clips: [{
          ...manifestProject.clips[0],
          recovery: { pending_job_id: 'job-boundary-1', pending_operation: 'boundary' },
        }],
      }),
    }))

    render(<App />)

    await screen.findByRole('heading', { name: 'Loaded Clip' })
    expect(screen.getByRole('button', { name: zh('rerenderInProgress', { operation: zh('operationBoundary') }) })).toBeDisabled()
    expect(screen.getByText(zh('boundaryRerenderStarted'))).toBeInTheDocument()
  })

  it('renders rerender status copy in English after switching locale', async () => {
    localStorageMock.setItem('openclip-editor-language', 'en')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...manifestProject,
        clips: [{
          ...manifestProject.clips[0],
          recovery: { pending_job_id: 'job-boundary-en', pending_operation: 'boundary' },
        }],
      }),
    }))

    render(<App />)

    await screen.findByRole('heading', { name: 'Loaded Clip' })
    expect(screen.getByRole('button', { name: en('rerenderInProgress', { operation: en('operationBoundary') }) })).toBeDisabled()
    expect(screen.getByText(en('boundaryRerenderStarted'))).toBeInTheDocument()
  })

  it('shows rerender feedback only in the matching section', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => manifestProject })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ job_id: 'job-subtitle-1' }) })
      .mockResolvedValue({ ok: true, json: async () => ({ status: 'running' }) })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    await screen.findByRole('heading', { name: 'Loaded Clip' })
    const subtitleField = screen.getByLabelText(zh('subtitleOverride'))
    await user.clear(subtitleField)
    await user.type(subtitleField, 'Queued subtitle change.')
    await user.click(screen.getByRole('button', { name: zh('queueRerender', { operation: zh('operationSubtitle') }) }))

    expect(screen.getByRole('button', { name: zh('rerenderInProgress', { operation: zh('operationSubtitle') }) })).toBeDisabled()
    expect(screen.getByText(zh('subtitleRerenderStarted'))).toBeInTheDocument()
    expect(screen.getByText(zh('queuedRerenderStatus', { operation: zh('operationSubtitle'), title: 'Loaded Clip' }))).toBeInTheDocument()
    expect(screen.queryByText(zh('boundaryRerenderStarted'))).toBeNull()
    expect(screen.queryByText(zh('coverRerenderStarted'))).toBeNull()
  })

  it('waits for project reconciliation after a completed boundary job before clearing the in-progress UI', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => manifestProject })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ job_id: 'job-boundary-2' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'completed' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...manifestProject,
          clips: [{
            ...manifestProject.clips[0],
            recovery: { pending_job_id: 'job-boundary-2', pending_operation: 'boundary' },
          }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...manifestProject,
          clips: [{
            ...manifestProject.clips[0],
            updated_at: '2026-04-20T00:02:00Z',
            effective_subtitle_text: 'Reconciled subtitle text',
            subtitle_recipe: {},
            has_manual_subtitle_override: false,
            recovery: {},
          }],
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    await screen.findByRole('heading', { name: 'Loaded Clip' })
    const startSlider = screen.getByLabelText(zh('clipStart'))
    fireEvent.change(startSlider, { target: { value: '6' } })
    await user.click(screen.getByRole('button', { name: zh('queueRerender', { operation: zh('operationBoundary') }) }))

    await screen.findByRole('button', { name: zh('rerenderInProgress', { operation: zh('operationBoundary') }) })
    await waitFor(() => expect(screen.getByDisplayValue('Reconciled subtitle text')).toBeInTheDocument())
    const previewPanel = screen.getByRole('article', { name: zh('postProcessedPreview') })
    const previewVideo = previewPanel.querySelector('video')
    expect(previewVideo).toHaveAttribute('src', '/api/projects/proj-real/media/clips_post_processed/clip-real-1.mp4?v=2026-04-20T00%3A02%3A00Z')
    expect(screen.getByRole('button', { name: zh('queueRerender', { operation: zh('operationBoundary') }) })).toBeDisabled()
    expect(screen.queryByText(zh('boundaryRerenderStarted'))).toBeNull()
  })

  it('shows a stale subtitle warning and regenerate action when the manifest marks subtitles stale', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...manifestProject,
        clips: [{
          ...manifestProject.clips[0],
          metadata: { subtitle_stale: true },
          has_manual_subtitle_override: true,
        }],
      }),
    }))

    render(<App />)

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByText(zh('subtitleOverrideIsStale'))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: zh('replaceWithRegeneratedSubtitleText') })).toBeInTheDocument()
  })

  it('shows a clear empty state when no post-processed clip is available', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...manifestProject,
        clips: [{
          ...manifestProject.clips[0],
          asset_registry: {},
          current_composed_clip_url: undefined,
        }],
      }),
    }))

    render(<App />)

    await screen.findByRole('heading', { name: 'Loaded Clip' })
    const previewPanel = screen.getByRole('article', { name: zh('postProcessedPreview') })
    expect(previewPanel).toHaveTextContent(zh('postProcessedPreviewUnavailable'))
    expect(previewPanel.querySelector('video')).toBeNull()
  })

  it('shows the actual cover assets when available', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => manifestProject }))

    render(<App />)

    await screen.findByRole('heading', { name: 'Loaded Clip' })
    expect(screen.getByAltText(zh('horizontalCoverAlt', { title: 'Loaded cover' }))).toHaveAttribute('src', '/api/projects/proj-real/media/covers/cover-clip-real-1-horizontal.jpg')
    expect(screen.getByAltText(zh('verticalCoverAlt', { title: 'Loaded cover' }))).toHaveAttribute('src', '/api/projects/proj-real/media/covers/cover-clip-real-1-vertical.jpg')
  })

  it('shows clear empty states when cover assets are unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...manifestProject,
        clips: [{
          ...manifestProject.clips[0],
          horizontal_cover_url: undefined,
          vertical_cover_url: undefined,
        }],
      }),
    }))

    render(<App />)

    await screen.findByRole('heading', { name: 'Loaded Clip' })
    expect(screen.getByText(zh('horizontalCoverUnavailable'))).toBeInTheDocument()
    expect(screen.getByText(zh('verticalCoverUnavailable'))).toBeInTheDocument()
  })
})
