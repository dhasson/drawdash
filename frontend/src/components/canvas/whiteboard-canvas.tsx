'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { generateImage } from '@/actions/image';
import { DEFAULT_USER_ID, updateProject } from '@/actions/projects';
import { transcribeAudio } from '@/actions/transcribe';
import { useProject } from '@/hooks/useProject';
import { useQueryClient } from '@tanstack/react-query';
import { Tldraw, createShapeId, getSnapshot, loadSnapshot } from 'tldraw';
import 'tldraw/tldraw.css';

import { BeforeAfterSlider } from '@/components/canvas/before-after-slider';
import { ImageSidebar } from '@/components/canvas/image-sidebar';

export interface WhiteboardCanvasProps {
  projectId: string;
  /** When true, skip Supabase project fetch/save (local free demo). */
  localMode?: boolean;
  title?: string;
}

export function WhiteboardCanvas({
  projectId,
  localMode = false,
  title = 'Demo',
}: WhiteboardCanvasProps) {
  const queryClient = useQueryClient();

  // Fetch project data only when persistence is enabled
  const { data: project } = useProject(
    localMode ? '' : projectId,
    DEFAULT_USER_ID,
  );

  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [mode, setMode] = useState<'agent' | 'ask'>('agent'); // Explicit mode tracking
  const [agentTranscript, setAgentTranscript] = useState(''); // Voice transcript for Agent Mode
  const [askPrompt, setAskPrompt] = useState(''); // Text input for Ask Mode
  const [error, setError] = useState<string | null>(null);
  const [frameId, setFrameId] = useState<string | null>(null);
  const [imageUsed, setImageUsed] = useState(false);
  const [showSlider, setShowSlider] = useState(false);
  const [beforeImage, setBeforeImage] = useState<string | null>(null);
  const [afterImage, setAfterImage] = useState<string | null>(null);
  const [frameBounds, setFrameBounds] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);
  const autoGenerateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const agentTranscriptRef = useRef<string>('');
  const handleGenerateRef = useRef<(() => Promise<void>) | null>(null);
  const isListeningRef = useRef<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const saveDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoadedSnapshotRef = useRef(false);

  // Keep agent transcript ref in sync with agent transcript state
  useEffect(() => {
    console.log('[TRANSCRIPT-REF] Updating agentTranscriptRef to:', agentTranscript);
    agentTranscriptRef.current = agentTranscript;
  }, [agentTranscript]);

  // Keep isListening ref in sync with isListening state
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    return () => {
      stopMediaTracks();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopMediaTracks = () => {
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
  };

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.includes(',') ? result.split(',')[1] : result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const startLocalRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.start(1000);
      setIsListening(true);
      isListeningRef.current = true;
      setError(null);
      console.log('[RECORDER] Started local recording → faster-whisper');
    } catch (err) {
      console.error('[RECORDER] Failed to start:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Microphone recording failed. Use Ask Mode and type your prompt.',
      );
      setIsListening(false);
      isListeningRef.current = false;
      stopMediaTracks();
    }
  };

  const stopRecorderAndTranscribe = async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) {
      stopMediaTracks();
      return;
    }

    const mimeType = recorder.mimeType || 'audio/webm';

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      if (recorder.state !== 'inactive') {
        recorder.stop();
      } else {
        resolve();
      }
    });

    const chunks = [...audioChunksRef.current];
    stopMediaTracks();

    if (chunks.length === 0) {
      setError('No audio captured. Try again or use Ask Mode.');
      return;
    }

    setError('Transcribing with local Whisper…');
    try {
      const blob = new Blob(chunks, { type: mimeType });
      const audio_data = await blobToBase64(blob);
      const { transcript } = await transcribeAudio({
        audio_data,
        mime_type: mimeType.split(';')[0] || 'audio/webm',
      });

      if (!transcript.trim()) {
        setError('No speech detected. Try again or use Ask Mode.');
        return;
      }

      setAgentTranscript((prev) => {
        const next = `${prev}${transcript} `.trim() + ' ';
        agentTranscriptRef.current = next;
        return next;
      });
      setError(null);

      if (handleGenerateRef.current) {
        await handleGenerateRef.current();
      }
    } catch (err) {
      console.error('[RECORDER] Transcribe failed:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Transcription failed. Is the backend running with faster-whisper?',
      );
    }
  };

  // Auto-stop + transcribe in Agent Mode after ~25s of recording
  useEffect(() => {
    if (mode === 'agent' && isListening && editorRef.current && frameId) {
      console.log('[AUTO-GEN] Recording started: Setting 25-second timer');
      autoGenerateTimerRef.current = setTimeout(() => {
        console.log('[AUTO-GEN] Timer fired — stopping to transcribe with Whisper');
        setIsListening(false);
        isListeningRef.current = false;
        void stopRecorderAndTranscribe();
      }, 25000);
    }

    return () => {
      if (autoGenerateTimerRef.current) {
        clearTimeout(autoGenerateTimerRef.current);
        autoGenerateTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, isListening, frameId]);

  const toggleListening = () => {
    if (isListening) {
      console.log('[TOGGLE] Stopping recording');
      isListeningRef.current = false;
      setIsListening(false);
      void stopRecorderAndTranscribe();
      return;
    }

    console.log('[TOGGLE] Starting local mic recording');
    setAgentTranscript('');
    agentTranscriptRef.current = '';
    setError(null);
    void startLocalRecording();
  };

  // Helper to capture current canvas state as data URL
  const captureCanvasSnapshot = useCallback(async (): Promise<string | null> => {
    if (!editorRef.current || !frameId) return null;

    const editor = editorRef.current;
    const frame = editor.getShape(frameId);
    if (!frame) return null;

    const childShapeIds = editor.getSortedChildIdsForParent(frameId).filter((id: string) => {
      const shape = editor.getShape(id);
      return shape && !shape.isLocked;
    });

    const shapeIdsToExport = [frameId, ...childShapeIds];

    const { blob } = await editor.toImage(shapeIdsToExport, {
      format: 'png',
      background: true,
      padding: 0,
    });

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  }, [frameId]);

  // Helper to create a preview with the new image
  const createAfterPreview = useCallback(
    async (imageBase64: string): Promise<string | null> => {
      if (!editorRef.current || !frameId) return null;

      const editor = editorRef.current;
      const frame = editor.getShape(frameId);
      if (!frame) return null;

      // Store current state to restore later
      const dataUrl = `data:image/png;base64,${imageBase64}`;

      // Get image dimensions
      const img = document.createElement('img');
      const imageLoadPromise = new Promise<{ width: number; height: number }>((resolve, reject) => {
        img.onload = () => resolve({ width: img.width, height: img.height });
        img.onerror = reject;
      });
      img.src = dataUrl;
      const { width: imageWidth, height: imageHeight } = await imageLoadPromise;

      // Create temporary asset and shape
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tempAssetId = `asset:${createShapeId()}` as any;
      const tempShapeId = createShapeId();

      editor.createAssets([
        {
          id: tempAssetId,
          type: 'image',
          typeName: 'asset',
          props: {
            name: 'preview.png',
            src: dataUrl,
            w: imageWidth,
            h: imageHeight,
            mimeType: 'image/png',
            isAnimated: false,
          },
          meta: {},
        },
      ]);

      const frameProps = frame.props as { w: number; h: number };
      const maxWidth = frameProps.w * 0.8;
      const maxHeight = frameProps.h * 0.8;
      const scale = Math.min(maxWidth / imageWidth, maxHeight / imageHeight, 1);
      const scaledWidth = imageWidth * scale;
      const scaledHeight = imageHeight * scale;
      const imageX = (frameProps.w - scaledWidth) / 2;
      const imageY = (frameProps.h - scaledHeight) / 2;

      editor.createShapes([
        {
          id: tempShapeId,
          type: 'image',
          x: imageX,
          y: imageY,
          parentId: frameId,
          props: {
            w: scaledWidth,
            h: scaledHeight,
            assetId: tempAssetId,
          },
        },
      ]);

      // Wait a tick for the shape to render
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Capture the preview
      const preview = await captureCanvasSnapshot();

      // Clean up temporary shape and asset
      editor.deleteShapes([tempShapeId]);
      editor.deleteAssets([tempAssetId]);

      return preview;
    },
    [frameId, captureCanvasSnapshot],
  );

  // Load test image as base64
  const loadTestImage = useCallback(async (): Promise<string> => {
    const response = await fetch('/test.png');
    const blob = await response.blob();
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.readAsDataURL(blob);
    });
  }, []);

  // Get frame bounds in screen coordinates
  const getFrameBounds = useCallback(() => {
    if (!editorRef.current || !frameId) return null;

    const editor = editorRef.current;
    const frame = editor.getShape(frameId);
    if (!frame) return null;

    // Get the frame's page bounds (in canvas coordinates)
    const bounds = editor.getShapePageBounds(frameId);

    if (!bounds) return null;

    // Convert canvas coordinates to screen coordinates
    const { x, y } = editor.pageToScreen({ x: bounds.x, y: bounds.y });
    const bottomRight = editor.pageToScreen({ x: bounds.maxX, y: bounds.maxY });

    return {
      x,
      y,
      width: bottomRight.x - x,
      height: bottomRight.y - y,
    };
  }, [frameId]);

  // Show the before/after slider animation
  const handleAcceptImage = useCallback(async () => {
    if (!editorRef.current || !frameId) {
      setError('Canvas not ready');
      return;
    }

    try {
      // If no generated image, use test.png for testing
      let imageToUse = generatedImage;
      if (!imageToUse) {
        const testImageBase64 = await loadTestImage();
        setGeneratedImage(testImageBase64);
        imageToUse = testImageBase64;
      }

      // Capture before state first
      const before = await captureCanvasSnapshot();
      if (!before) {
        setError('Failed to capture canvas state');
        return;
      }

      // Get frame bounds for positioning the slider
      const bounds = getFrameBounds();
      setFrameBounds(bounds);

      // Show the before image immediately to hide canvas operations
      setBeforeImage(before);
      setAfterImage(null); // Will be set shortly
      setShowSlider(true);

      // Small delay to ensure overlay is shown
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Create after preview using the image we have (happens behind overlay now)
      const after = await createAfterPreview(imageToUse);
      if (!after) {
        setError('Failed to create preview');
        setShowSlider(false);
        return;
      }

      // Update with the after image
      setAfterImage(after);
    } catch (err) {
      console.error('Error preparing slider:', err);
      setError(err instanceof Error ? err.message : 'Failed to prepare preview');
      setShowSlider(false);
    }
  }, [
    frameId,
    generatedImage,
    loadTestImage,
    captureCanvasSnapshot,
    createAfterPreview,
    getFrameBounds,
  ]);

  // Actually place the image on the canvas (called after slider completes)
  const placeImageOnCanvas = useCallback(async () => {
    if (!editorRef.current || !frameId || !generatedImage) return;

    try {
      const editor = editorRef.current;
      const frame = editor.getShape(frameId);
      if (!frame) return;

      // CLEAR ALL EXISTING SHAPES IN THE FRAME FIRST
      const childShapeIds = editor.getSortedChildIdsForParent(frameId);
      if (childShapeIds.length > 0) {
        editor.deleteShapes(childShapeIds);
      }

      const dataUrl = `data:image/png;base64,${generatedImage}`;

      const img = document.createElement('img');
      const imageLoadPromise = new Promise<{ width: number; height: number }>((resolve, reject) => {
        img.onload = () => resolve({ width: img.width, height: img.height });
        img.onerror = reject;
      });
      img.src = dataUrl;
      const { width: imageWidth, height: imageHeight } = await imageLoadPromise;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const assetId = `asset:${createShapeId()}` as any;

      editor.createAssets([
        {
          id: assetId,
          type: 'image',
          typeName: 'asset',
          props: {
            name: 'generated.png',
            src: dataUrl,
            w: imageWidth,
            h: imageHeight,
            mimeType: 'image/png',
            isAnimated: false,
          },
          meta: {},
        },
      ]);

      const frameProps = frame.props as { w: number; h: number };
      const maxWidth = frameProps.w * 0.8;
      const maxHeight = frameProps.h * 0.8;
      const scale = Math.min(maxWidth / imageWidth, maxHeight / imageHeight, 1);
      const scaledWidth = imageWidth * scale;
      const scaledHeight = imageHeight * scale;
      const imageX = (frameProps.w - scaledWidth) / 2;
      const imageY = (frameProps.h - scaledHeight) / 2;

      const imageShapeId = createShapeId();
      editor.createShapes([
        {
          id: imageShapeId,
          type: 'image',
          x: imageX,
          y: imageY,
          parentId: frameId,
          props: {
            w: scaledWidth,
            h: scaledHeight,
            assetId: assetId,
          },
        },
      ]);

      setImageUsed(true);
      setShowSlider(false);
      console.log('Image placed in frame');
    } catch (err) {
      console.error('Error placing image:', err);
      setError(err instanceof Error ? err.message : 'Failed to place image');
    }
  }, [frameId, generatedImage]);

  const handleRejectImage = useCallback(() => {
    setImageUsed(true);
    console.log('Image rejected');
  }, []);

  // Keyboard shortcuts for Accept/Reject
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If slider is showing, ESC cancels it
      if (showSlider && e.key === 'Escape') {
        e.preventDefault();
        setShowSlider(false);
        return;
      }

      // Only trigger if buttons are visible
      if (imageUsed || !generatedImage) return;

      if (e.key === 'Tab') {
        e.preventDefault();
        handleAcceptImage();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleRejectImage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [imageUsed, generatedImage, showSlider, handleAcceptImage, handleRejectImage]);

  const exportCanvasImage = useCallback(async (): Promise<string | null> => {
    console.log('exportCanvasImage: Starting export...');
    console.log('exportCanvasImage: editorRef.current:', !!editorRef.current);
    console.log('exportCanvasImage: frameId:', frameId);

    if (!editorRef.current || !frameId) {
      console.log('exportCanvasImage: No editor or frameId, returning null');
      return null;
    }

    const editor = editorRef.current;

    // Debug: Check all shapes on the current page
    const allShapeIds = Array.from(editor.getCurrentPageShapeIds());
    console.log('exportCanvasImage: All shape IDs on page:', allShapeIds);
    console.log('exportCanvasImage: Looking for frameId:', frameId);

    const frame = editor.getShape(frameId);
    console.log('exportCanvasImage: frame object:', frame);

    if (!frame) {
      console.log('exportCanvasImage: No frame found, returning null');
      console.log('exportCanvasImage: This might be a timing issue or frameId mismatch');
      return null;
    }

    console.log('exportCanvasImage: Frame found successfully, type:', frame.type);

    // Get all shapes that are children of the frame
    const childShapeIds = editor.getSortedChildIdsForParent(frameId).filter((id: string) => {
      const shape = editor.getShape(id);
      return shape && !shape.isLocked;
    });

    console.log('exportCanvasImage: childShapeIds count:', childShapeIds.length);

    // Include the frame itself and all its children for export
    const shapeIdsToExport = [frameId, ...childShapeIds];

    console.log('exportCanvasImage: shapeIdsToExport count:', shapeIdsToExport.length);

    // Export only the frame and its contents to PNG
    // Note: shapeIdsToExport will always have at least the frame itself
    const { blob } = await editor.toImage(shapeIdsToExport, {
      format: 'png',
      background: true,
      padding: 0,
    });

    console.log('exportCanvasImage: Blob created, size:', blob.size);

    // Convert blob to base64
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        // Remove the data:image/png;base64, prefix
        const base64 = base64data.split(',')[1];
        console.log('exportCanvasImage: Base64 created, length:', base64?.length || 0);
        resolve(base64);
      };
      reader.onerror = (error) => {
        console.error('exportCanvasImage: FileReader error:', error);
        reject(error);
      };
      reader.readAsDataURL(blob);
    });
  }, [frameId]);

  const handleGenerate = useCallback(async () => {
    // Get the appropriate prompt based on mode
    const prompt = mode === 'agent' ? agentTranscript : askPrompt;

    if (!prompt.trim()) {
      setError(mode === 'agent' ? 'Please provide a voice prompt first' : 'Please enter a prompt');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Always export canvas image - needed for both generate and edit modes
      console.log('Exporting canvas image...');
      const canvasImageData = await exportCanvasImage();
      console.log(
        'Canvas image data:',
        canvasImageData ? `${canvasImageData.length} chars` : 'null',
      );

      // Check if canvas has content to determine request type
      const editor = editorRef.current;
      const hasContent = frameId && editor?.getSortedChildIdsForParent(frameId).length > 0;
      const requestType = hasContent ? 'edit' : 'generate';
      console.log('Request type:', requestType, '(mode:', mode, ', hasContent:', hasContent, ')');

      const data = await generateImage({
        prompt: prompt,
        image_data: canvasImageData,
        project_id: projectId,
        type: requestType,
      });

      setGeneratedImage(data.image_data);
      setImageUsed(false); // Reset when new image is generated

      if (data.text_response) {
        console.log('Model response:', data.text_response);
      }
    } catch (err) {
      console.error('Error generating image:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate image');
    } finally {
      setIsGenerating(false);
    }
  }, [mode, agentTranscript, askPrompt, exportCanvasImage, projectId, frameId]);

  // Keep handleGenerate ref in sync
  useEffect(() => {
    handleGenerateRef.current = handleGenerate;
  }, [handleGenerate]);

  // Start editing project name
  const startEditingName = useCallback(() => {
    if (localMode) return;
    if (project?.name) {
      setEditedName(project.name);
      setIsEditingName(true);
    }
  }, [localMode, project?.name]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  // Save edited project name
  const saveProjectName = useCallback(async () => {
    if (!editedName.trim() || !project) {
      setIsEditingName(false);
      return;
    }

    if (editedName.trim() === project.name) {
      setIsEditingName(false);
      return;
    }

    try {
      await updateProject(projectId, DEFAULT_USER_ID, {
        name: editedName.trim(),
      });
      // Invalidate and refetch the project data
      await queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setIsEditingName(false);
    } catch (err) {
      console.error('Error updating project name:', err);
      setError(err instanceof Error ? err.message : 'Failed to update project name');
      setIsEditingName(false);
    }
  }, [editedName, project, projectId, queryClient]);

  // Cancel editing project name
  const cancelEditingName = useCallback(() => {
    setIsEditingName(false);
    setEditedName('');
  }, []);

  // Handle keyboard events for name editing
  const handleNameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveProjectName();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelEditingName();
      }
    },
    [saveProjectName, cancelEditingName],
  );

  // Save canvas state to database
  const saveCanvas = useCallback(async () => {
    if (localMode || !editorRef.current) {
      return;
    }

    setIsSaving(true);

    try {
      const editor = editorRef.current;
      const snapshot = getSnapshot(editor.store);

      await updateProject(projectId, DEFAULT_USER_ID, {
        snapshot: snapshot.document as unknown as Record<string, unknown>,
      });

      console.log('Canvas saved successfully');
    } catch (err) {
      console.error('Error saving canvas:', err);
      setError(err instanceof Error ? err.message : 'Failed to save canvas');
    } finally {
      setIsSaving(false);
    }
  }, [localMode, projectId]);

  // Load canvas state from database when project loads
  useEffect(() => {
    if (localMode) {
      hasLoadedSnapshotRef.current = true;
      return;
    }
    if (!editorRef.current || !project || hasLoadedSnapshotRef.current) return;

    try {
      const editor = editorRef.current;

      // If project has a snapshot, load it
      if (project.snapshot) {
        console.log('Loading canvas snapshot from database...');
        // Load the snapshot into the store as a remote change to avoid triggering auto-save
        editor.store.mergeRemoteChanges(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          loadSnapshot(editor.store, { document: project.snapshot as any });
        });

        // After loading snapshot, find the frame and update frameId state
        const existingShapes = Array.from(editor.getCurrentPageShapeIds());
        const existingFrame = existingShapes.find((id) => {
          const shape = editor.getShape(id);
          return (
            shape?.type === 'frame' && (shape.props as { name?: string })?.name === 'Drawing Area'
          );
        });

        if (existingFrame) {
          console.log('Found frame in snapshot:', existingFrame);
          setFrameId(existingFrame as string);
          // Zoom to fit the loaded frame
          editor.zoomToFit();
        }

        console.log('Canvas loaded from database');
      } else {
        console.log('No snapshot found, using initial frame');
      }

      // Mark as loaded regardless of whether we had a snapshot or not
      // This enables auto-save for both new and existing projects
      hasLoadedSnapshotRef.current = true;
    } catch (err) {
      console.error('Error loading canvas:', err);
      setError(err instanceof Error ? err.message : 'Failed to load canvas');
    }
  }, [localMode, project]);

  // Auto-save with debounce - listen for canvas changes
  useEffect(() => {
    if (localMode || !editorRef.current || !frameId) return;

    const editor = editorRef.current;

    // Listen for changes to the document
    const unlisten = editor.store.listen(
      () => {
        // Clear any existing timer
        if (saveDebounceTimerRef.current) {
          clearTimeout(saveDebounceTimerRef.current);
        }

        // Set new timer to save after 2.5 seconds of inactivity
        saveDebounceTimerRef.current = setTimeout(() => {
          // Only save if we've loaded the initial snapshot
          if (hasLoadedSnapshotRef.current) {
            saveCanvas();
          }
        }, 2500);
      },
      { scope: 'document', source: 'user' },
    );

    // Cleanup
    return () => {
      unlisten();
      if (saveDebounceTimerRef.current) {
        clearTimeout(saveDebounceTimerRef.current);
      }
    };
  }, [localMode, frameId, saveCanvas]);

  const displayName = localMode ? title : project?.name || 'Loading...';

  return (
    <div className="flex h-full w-full bg-white">
      {/* Left Side - Drawing Canvas */}
      <div className="flex flex-1 flex-col bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 bg-white p-3 pl-4 text-left text-sm font-medium text-gray-900">
          <div>
            <span className="text-gray-500">{localMode ? 'Local/' : 'Projects/'}</span>
            {isEditingName && !localMode ? (
              <input
                ref={nameInputRef}
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onBlur={saveProjectName}
                onKeyDown={handleNameKeyDown}
                className="mx-1 border-none bg-transparent px-1 text-gray-900 underline outline-none"
              />
            ) : (
              <span
                className={
                  localMode
                    ? 'px-1 text-gray-900'
                    : 'cursor-pointer px-1 underline decoration-gray-400 decoration-dotted underline-offset-2 hover:decoration-gray-600'
                }
                onClick={startEditingName}
                title={localMode ? undefined : 'Click to edit project name'}
              >
                {displayName}
              </span>
            )}
          </div>
          {isSaving && <span className="text-xs text-gray-400">Saving...</span>}
        </div>
        <div className="flex-1">
          <Tldraw
            components={{
              StylePanel: null,
            }}
            onMount={(editor) => {
              editorRef.current = editor;

              // Check if a frame already exists (to prevent duplicates in React Strict Mode)
              const existingShapes = Array.from(editor.getCurrentPageShapeIds());
              const existingFrame = existingShapes.find((id) => {
                const shape = editor.getShape(id);
                return (
                  shape?.type === 'frame' &&
                  (shape.props as { name?: string })?.name === 'Drawing Area'
                );
              });

              if (existingFrame) {
                console.log('Found existing frame:', existingFrame);
                setFrameId(existingFrame);
                editor.zoomToFit();
                return;
              }

              // If project has a snapshot, wait for it to load (don't create a frame)
              // The snapshot loading effect will handle setting the frameId
              if (!localMode && project?.snapshot) {
                console.log('Project has snapshot, waiting for load...');
                return;
              }

              // Create a centered frame for drawing (only for new projects)
              console.log('Creating new frame for new project');
              const { width, height } = editor.getViewportPageBounds();
              const frameWidth = Math.min(800, width * 0.6);
              const frameHeight = Math.min(600, height * 0.6);
              const x = (width - frameWidth) / 2;
              const y = (height - frameHeight) / 2;

              const frameShapeId = createShapeId();
              editor.createShapes([
                {
                  id: frameShapeId,
                  type: 'frame',
                  x,
                  y,
                  props: {
                    w: frameWidth,
                    h: frameHeight,
                    name: 'Drawing Area',
                  },
                },
              ]);

              setFrameId(frameShapeId);

              // Zoom to fit the frame
              editor.zoomToFit();
            }}
          />
        </div>
      </div>

      {/* Right Sidebar - Generated Image & Controls */}
      <ImageSidebar
        projectId={projectId}
        localMode={localMode}
        generatedImage={generatedImage}
        imageUsed={imageUsed}
        transcript={mode === 'agent' ? agentTranscript : askPrompt}
        isListening={isListening}
        isGenerating={isGenerating}
        error={error}
        mode={mode}
        onModeChange={(newMode) => {
          setMode(newMode);
          // Stop recording when switching modes
          if (isListening) {
            isListeningRef.current = false;
            setIsListening(false);
            stopMediaTracks();
          }
        }}
        onTranscriptChange={(value) => {
          // Update the appropriate state based on current mode
          if (mode === 'agent') {
            setAgentTranscript(value);
          } else {
            setAskPrompt(value);
          }
        }}
        onToggleListening={toggleListening}
        onGenerate={handleGenerate}
        onAcceptImage={handleAcceptImage}
        onRejectImage={handleRejectImage}
        canvasReady={!!(frameId && editorRef.current)}
      />

      {/* Before/After Slider Overlay */}
      {showSlider && beforeImage && (
        <BeforeAfterSlider
          beforeImageUrl={beforeImage}
          afterImageUrl={afterImage || ''}
          onComplete={placeImageOnCanvas}
          onCancel={() => setShowSlider(false)}
          frameBounds={frameBounds || undefined}
        />
      )}
    </div>
  );
}
