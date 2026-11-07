"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Canvas as FxCanvas, Texture as FxTexture } from "glfx";

export const FILTERS = [
  { id: "original", name: "Original", css: "none" },
  { id: "noir", name: "Noir", css: "grayscale(1) contrast(1.18)" },
  { id: "vintage", name: "Vintage", css: "sepia(.5) saturate(.75) contrast(.94) brightness(1.04)" },
  { id: "rosy", name: "Rosy", css: "sepia(.18) saturate(1.13) hue-rotate(323deg) brightness(1.05)" },
  { id: "golden", name: "Golden", css: "sepia(.38) saturate(1.3) brightness(1.07)" },
  { id: "vivid", name: "Vivid", css: "saturate(1.7) contrast(1.13)" },
  { id: "fisheye", name: "Fisheye", css: "saturate(1.12) contrast(1.03)" },
  { id: "swirl", name: "Swirl", css: "saturate(1.2) hue-rotate(8deg)" },
  { id: "left-mirror", name: "Left Mirror", css: "none" },
  { id: "right-mirror", name: "Right Mirror", css: "none" },
  { id: "top-mirror", name: "Top Mirror", css: "none" },
  { id: "bottom-mirror", name: "Bottom Mirror", css: "none" },
  { id: "quad-mirror", name: "Quad Mirror", css: "none" },
  { id: "upside-down", name: "Upside Down", css: "none" },
  { id: "switch", name: "Switch", css: "none" },
  { id: "kaleidoscope", name: "Kaleidoscope", css: "none" },
] as const;

export type FilterId = (typeof FILTERS)[number]["id"];
export type CameraStatus = "idle" | "loading" | "ready" | "demo" | "error";

const WIDTH = 960;
const HEIGHT = 600;
type FrameSettings = { filterId: FilterId; mirror: boolean };
type Source = HTMLVideoElement | HTMLImageElement;
type PendingWait = { timer: ReturnType<typeof setTimeout>; finish: (active: boolean) => void };
type FxSurface = { canvas: FxCanvas | null; texture: FxTexture | null; width: number; height: number };

function applyFilter(canvas: FxCanvas, filterId: FilterId, width: number, height: number) {
  switch (filterId) {
    case "noir":
      canvas.hueSaturation(0, -1).brightnessContrast(0, 0.16).vignette(0.65, 0.22);
      break;
    case "vintage":
      canvas.sepia(0.5).hueSaturation(0, -0.13).brightnessContrast(0.035, -0.07).vignette(0.58, 0.2);
      break;
    case "rosy":
      canvas.curves([[0, 0.045], [0.5, 0.57], [1, 1]], [[0, 0], [0.5, 0.48], [1, 0.98]], [[0, 0.035], [0.5, 0.55], [1, 1]])
        .brightnessContrast(0.02, -0.025);
      break;
    case "golden":
      canvas.sepia(0.3).vibrance(0.22).curves([[0, 0.025], [0.5, 0.57], [1, 1]], [[0, 0.01], [0.5, 0.52], [1, 1]], [[0, 0], [0.5, 0.44], [1, 0.95]])
        .brightnessContrast(0.02, 0.015);
      break;
    case "vivid":
      canvas.vibrance(0.5).hueSaturation(0, 0.18).brightnessContrast(0, 0.1);
      break;
    case "fisheye":
      canvas.bulgePinch(width / 2, height / 2, height * 0.78, 0.65).vibrance(0.14);
      break;
    case "swirl":
      canvas.swirl(width / 2, height / 2, height * 0.7, 1.35).vibrance(0.12);
      break;
  }
}

function disposeFxSurface(surface: FxSurface) {
  try { surface.texture?.destroy(); } catch { /* The context may already be lost. */ }
  surface.texture = null;
  surface.width = 0;
  surface.height = 0;
  const canvas = surface.canvas;
  surface.canvas = null;
  if (canvas) {
    try {
      const context = (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
      context?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch { /* A lost WebGL context needs no further cleanup. */ }
  }
}

function drawSourceFrame(source: Source, raw: HTMLCanvasElement, mirror: boolean, width: number, height: number) {
  const isVideo = source instanceof HTMLVideoElement;
  const sourceWidth = isVideo ? source.videoWidth : source.naturalWidth;
  const sourceHeight = isVideo ? source.videoHeight : source.naturalHeight;
  if (!sourceWidth || !sourceHeight || (isVideo && source.readyState < 2)) return false;
  if (raw.width !== width || raw.height !== height) { raw.width = width; raw.height = height; }
  const context = raw.getContext("2d");
  if (!context) return false;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  context.save();
  context.clearRect(0, 0, width, height);
  if (mirror) { context.translate(width, 0); context.scale(-1, 1); }
  context.drawImage(source, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
  context.restore();
  return true;
}

function drawGeometry(context: CanvasRenderingContext2D, raw: HTMLCanvasElement, filterId: FilterId) {
  const { width, height } = raw;
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const part = (sx: number, sy: number, sw: number, sh: number, x: number, y: number, w: number, h: number, flipX = false, flipY = false) => {
    context.save();
    context.translate(x + (flipX ? w : 0), y + (flipY ? h : 0));
    context.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    context.drawImage(raw, sx, sy, sw, sh, 0, 0, w, h);
    context.restore();
  };
  switch (filterId) {
    case "left-mirror":
      part(0, 0, halfWidth, height, 0, 0, halfWidth, height);
      part(0, 0, halfWidth, height, halfWidth, 0, halfWidth, height, true);
      return true;
    case "right-mirror":
      part(halfWidth, 0, halfWidth, height, 0, 0, halfWidth, height, true);
      part(halfWidth, 0, halfWidth, height, halfWidth, 0, halfWidth, height);
      return true;
    case "top-mirror":
      part(0, 0, width, halfHeight, 0, 0, width, halfHeight);
      part(0, 0, width, halfHeight, 0, halfHeight, width, halfHeight, false, true);
      return true;
    case "bottom-mirror":
      part(0, halfHeight, width, halfHeight, 0, 0, width, halfHeight, false, true);
      part(0, halfHeight, width, halfHeight, 0, halfHeight, width, halfHeight);
      return true;
    case "quad-mirror":
      for (let row = 0; row < 2; row += 1) {
        for (let column = 0; column < 2; column += 1) {
          part(0, 0, width, height, column * halfWidth, row * halfHeight, halfWidth, halfHeight, column === 0, row === 0);
        }
      }
      return true;
    case "upside-down":
      part(0, 0, width, height, 0, 0, width, height, true, true);
      return true;
    case "switch":
      part(halfWidth, 0, halfWidth, height, 0, 0, halfWidth, height);
      part(0, 0, halfWidth, height, halfWidth, 0, halfWidth, height);
      return true;
    case "kaleidoscope": {
      const angle = Math.PI / 4;
      const radius = Math.hypot(width, height);
      const scale = radius / Math.min(width, height);
      context.save();
      context.translate(halfWidth, halfHeight);
      for (let segment = 0; segment < 8; segment += 1) {
        context.save();
        context.rotate(segment * angle);
        context.beginPath();
        context.moveTo(0, 0);
        context.lineTo(radius, 0);
        context.lineTo(radius * Math.cos(angle), radius * Math.sin(angle));
        context.closePath();
        context.clip();
        if (segment % 2 === 1) { context.rotate(angle); context.scale(1, -1); }
        context.drawImage(raw, -halfWidth * scale, -halfHeight * scale, width * scale, height * scale);
        context.restore();
      }
      context.restore();
      return true;
    }
    default:
      return false;
  }
}

function drawEffectFrame(raw: HTMLCanvasElement, output: HTMLCanvasElement, filterId: FilterId, surface: FxSurface) {
  const context = output.getContext("2d");
  if (!context) return false;
  const { width, height } = raw;
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.filter = "none";
  context.clearRect(0, 0, width, height);
  if (drawGeometry(context, raw, filterId)) {
    context.restore();
    return true;
  }
  let frame: HTMLCanvasElement = raw;
  const fx = surface.canvas;
  if (fx) {
    try {
      // Main preview and effect tiles own separate textures and dimensions.
      if (surface.texture && (surface.width !== width || surface.height !== height)) {
        surface.texture.destroy();
        surface.texture = null;
      }
      if (!surface.texture) surface.texture = fx.texture(raw);
      else surface.texture.loadContentsOf(raw);
      surface.width = width;
      surface.height = height;
      fx.draw(surface.texture, width, height);
      applyFilter(fx, filterId, width, height);
      fx.update();
      frame = fx;
    } catch {
      // Geometric effects and CSS color filters remain usable without WebGL.
      disposeFxSurface(surface);
    }
  }
  context.filter = frame === raw ? (FILTERS.find((filter) => filter.id === filterId)?.css ?? "none") : "none";
  context.drawImage(frame, 0, 0, width, height);
  context.restore();
  return true;
}

function cameraError(reason: unknown) {
  const name = reason instanceof Error ? reason.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Camera access was declined. Allow camera access in your browser, or try the demo.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No camera was found. Connect a camera, or try the demo.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Your camera is busy. Close any other app using it and try again.";
  }
  return "We couldn’t start your camera. Check your browser’s camera settings, or try the demo.";
}

export function usePhotobooth() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const renderCanvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [filterId, setFilterIdState] = useState<FilterId>("original");
  const [mirror, setMirrorState] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [flash, setFlash] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [captureProgress, setCaptureProgress] = useState(0);

  const mountedRef = useRef(false);
  const lifecycleRef = useRef(0);
  const statusRef = useRef<CameraStatus>("idle");
  const sourceRef = useRef<Source | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestRef = useRef(0);
  const rawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fxRef = useRef<FxSurface>({ canvas: null, texture: null, width: 0, height: 0 });
  const previewRawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewFxRef = useRef<FxSurface>({ canvas: null, texture: null, width: 0, height: 0 });
  const fxFactoryRef = useRef<(() => FxCanvas) | null>(null);
  const previewFxAttemptedRef = useRef(false);
  const frameSettingsRef = useRef<FrameSettings>({ filterId: "original", mirror: true });
  const frozenSettingsRef = useRef<FrameSettings | null>(null);
  const captureRequestRef = useRef(0);
  const captureBusyRef = useRef(false);
  const waitsRef = useRef(new Set<PendingWait>());

  const setFilterId: Dispatch<SetStateAction<FilterId>> = useCallback((value) => {
    const next = typeof value === "function" ? value(frameSettingsRef.current.filterId) : value;
    frameSettingsRef.current.filterId = next;
    setFilterIdState(next);
  }, []);

  const setMirror: Dispatch<SetStateAction<boolean>> = useCallback((value) => {
    const next = typeof value === "function" ? value(frameSettingsRef.current.mirror) : value;
    frameSettingsRef.current.mirror = next;
    setMirrorState(next);
  }, []);

  const updateStatus = useCallback((status: CameraStatus) => {
    statusRef.current = status;
    if (mountedRef.current) setCameraStatus(status);
  }, []);

  const disposeFx = useCallback(() => {
    disposeFxSurface(fxRef.current);
  }, []);

  const releaseSource = useCallback(() => {
    requestRef.current += 1;
    sourceRef.current = null;
    const stream = streamRef.current;
    streamRef.current = null;
    stream?.getTracks().forEach((track) => { track.onended = null; track.stop(); });
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
  }, []);

  const cancelCapture = useCallback(() => {
    captureRequestRef.current += 1;
    captureBusyRef.current = false;
    frozenSettingsRef.current = null;
    for (const wait of waitsRef.current) {
      clearTimeout(wait.timer);
      wait.finish(false);
    }
    waitsRef.current.clear();
    if (mountedRef.current) {
      setCountdown(null);
      setIsCapturing(false);
      setFlash(false);
    }
  }, []);

  const renderFrame = useCallback(() => {
    const source = sourceRef.current;
    const output = renderCanvasRef.current;
    if (!source || !output) return false;
    const raw = rawCanvasRef.current ?? document.createElement("canvas");
    rawCanvasRef.current = raw;
    if (output.width !== WIDTH || output.height !== HEIGHT) { output.width = WIDTH; output.height = HEIGHT; }
    const settings = frozenSettingsRef.current ?? frameSettingsRef.current;
    if (!drawSourceFrame(source, raw, settings.mirror, WIDTH, HEIGHT)) return false;
    return drawEffectFrame(raw, output, settings.filterId, fxRef.current);
  }, []);

  const renderEffectPreview = useCallback((target: HTMLCanvasElement, effectId: FilterId) => {
    if (!mountedRef.current || typeof document === "undefined") return false;
    const source = sourceRef.current;
    if (!source || target.width < 1 || target.height < 1) return false;
    const raw = previewRawCanvasRef.current ?? document.createElement("canvas");
    previewRawCanvasRef.current = raw;
    const settings = frozenSettingsRef.current ?? frameSettingsRef.current;
    if (!drawSourceFrame(source, raw, settings.mirror, target.width, target.height)) return false;
    if (!previewFxAttemptedRef.current && fxFactoryRef.current) {
      previewFxAttemptedRef.current = true;
      try { previewFxRef.current.canvas = fxFactoryRef.current(); } catch { /* Use the same 2D fallback as the main preview. */ }
    }
    // Copy each finished tile immediately; one reusable context serves the whole grid.
    return drawEffectFrame(raw, target, effectId, previewFxRef.current);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const lifecycle = ++lifecycleRef.current;
    let animationFrame = 0;
    let previousFrame = 0;
    const animate = (time: number) => {
      if (time - previousFrame >= 1000 / 30) {
        renderFrame();
        previousFrame = time;
      }
      animationFrame = requestAnimationFrame(animate);
    };
    animationFrame = requestAnimationFrame(animate);

    void import("glfx").then((module) => {
      if (!mountedRef.current || lifecycleRef.current !== lifecycle) return;
      fxFactoryRef.current = () => module.default.canvas();
      try { fxRef.current.canvas = fxFactoryRef.current(); } catch { /* Use the 2D filter fallback. */ }
    }).catch(() => { /* Loading the effects library must not block the camera. */ });

    return () => {
      mountedRef.current = false;
      lifecycleRef.current += 1;
      cancelAnimationFrame(animationFrame);
      cancelCapture();
      releaseSource();
      disposeFx();
      disposeFxSurface(previewFxRef.current);
      rawCanvasRef.current = null;
      previewRawCanvasRef.current = null;
      fxFactoryRef.current = null;
      previewFxAttemptedRef.current = false;
    };
  }, [cancelCapture, disposeFx, releaseSource, renderFrame]);

  const stopCamera = useCallback(() => {
    cancelCapture();
    releaseSource();
    updateStatus("idle");
    if (mountedRef.current) setError(null);
  }, [cancelCapture, releaseSource, updateStatus]);

  const startCamera = useCallback(async () => {
    cancelCapture();
    releaseSource();
    const request = requestRef.current;
    updateStatus("loading");
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera access needs a secure connection. Open this page over HTTPS, or try the demo.");
      updateStatus("error");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 800 } },
        audio: false,
      });
      if (!mountedRef.current || request !== requestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error("Camera preview is unavailable");
      }
      streamRef.current = stream;
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();
      if (!mountedRef.current || request !== requestRef.current) return;
      sourceRef.current = video;
      stream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          if (!mountedRef.current || streamRef.current !== stream) return;
          cancelCapture();
          releaseSource();
          setError("Your camera was disconnected. Reconnect it and try again, or use the demo.");
          updateStatus("error");
        };
      });
      updateStatus("ready");
      renderFrame();
    } catch (reason) {
      if (!mountedRef.current || request !== requestRef.current) return;
      releaseSource();
      setError(cameraError(reason));
      updateStatus("error");
    }
  }, [cancelCapture, releaseSource, renderFrame, updateStatus]);

  const useDemo = useCallback(async () => {
    cancelCapture();
    releaseSource();
    const request = requestRef.current;
    updateStatus("loading");
    setError(null);
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => { image.onload = null; image.onerror = null; resolve(); };
        image.onerror = () => { image.onload = null; image.onerror = null; reject(new Error("Demo image unavailable")); };
        image.src = "/images/demo-portrait.jpg";
      });
      if (!mountedRef.current || request !== requestRef.current) return;
      sourceRef.current = image;
      updateStatus("demo");
      renderFrame();
    } catch {
      if (!mountedRef.current || request !== requestRef.current) return;
      setError("The demo photo couldn’t load. Please try again, or start your camera.");
      updateStatus("error");
    }
  }, [cancelCapture, releaseSource, renderFrame, updateStatus]);

  const waitForCapture = useCallback((duration: number, request: number) => new Promise<boolean>((resolve) => {
    if (!mountedRef.current || captureRequestRef.current !== request) { resolve(false); return; }
    const wait: PendingWait = {
      timer: setTimeout(() => {
        waitsRef.current.delete(wait);
        resolve(mountedRef.current && captureRequestRef.current === request);
      }, duration),
      finish: resolve,
    };
    waitsRef.current.add(wait);
  }), []);

  const capture = useCallback(async (count: number, delaySeconds: number) => {
    if (captureBusyRef.current || !mountedRef.current || !["ready", "demo"].includes(statusRef.current)) return;
    const shots = Number.isFinite(count) ? Math.max(1, Math.min(8, Math.floor(count))) : 1;
    const delay = Number.isFinite(delaySeconds) ? Math.max(0, Math.min(10, Math.floor(delaySeconds))) : 3;
    const request = ++captureRequestRef.current;
    captureBusyRef.current = true;
    frozenSettingsRef.current = { ...frameSettingsRef.current };
    setIsCapturing(true);
    setCaptureProgress(0);
    setError(null);
    try {
      for (let shot = 0; shot < shots; shot += 1) {
        for (let second = delay; second > 0; second -= 1) {
          setCountdown(second);
          if (!await waitForCapture(1000, request)) return;
        }
        setCountdown(null);
        if (!renderFrame() || !renderCanvasRef.current) throw new Error("The camera frame is not ready yet. Please try again.");
        const photo = renderCanvasRef.current.toDataURL("image/jpeg", 0.94);
        setPhotos((previous) => [...previous, photo]);
        setCaptureProgress(shot + 1);
        setFlash(true);
        if (!await waitForCapture(150, request)) return;
        setFlash(false);
        if (shot < shots - 1 && !await waitForCapture(350, request)) return;
      }
    } catch (reason) {
      if (mountedRef.current && captureRequestRef.current === request) {
        setError(reason instanceof Error ? reason.message : "We couldn’t take that photo. Please try again.");
      }
    } finally {
      if (mountedRef.current && captureRequestRef.current === request) {
        captureBusyRef.current = false;
        frozenSettingsRef.current = null;
        setIsCapturing(false);
        setCountdown(null);
        setFlash(false);
      }
    }
  }, [renderFrame, waitForCapture]);

  const clearPhotos = useCallback(() => {
    cancelCapture();
    setPhotos([]);
    setCaptureProgress(0);
  }, [cancelCapture]);

  const removePhoto = useCallback((index: number) => {
    setPhotos((previous) => previous.filter((_, photoIndex) => photoIndex !== index));
  }, []);

  return {
    cameraStatus, error, filterId, setFilterId, mirror, setMirror,
    countdown, isCapturing, flash, photos, captureProgress,
    videoRef, renderCanvasRef, renderEffectPreview, startCamera, useDemo, stopCamera,
    capture, clearPhotos, removePhoto,
  };
}
