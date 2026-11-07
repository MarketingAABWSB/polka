type StripOptions = {
  color: string;
  dots: boolean;
  caption: string;
  layout: "strip" | "grid";
  date?: string;
};

type PhotoBounds = { x: number; y: number; width: number; height: number };

function loadPhoto(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (!source) {
      reject(new Error("A photo is missing. Please take your photos again."));
      return;
    }

    const photo = new Image();
    const timeout = window.setTimeout(() => {
      photo.onload = null;
      photo.onerror = null;
      reject(new Error("A photo took too long to load. Please try again."));
    }, 15_000);

    photo.onload = () => {
      window.clearTimeout(timeout);
      if (photo.naturalWidth && photo.naturalHeight) resolve(photo);
      else reject(new Error("A photo could not be read. Please take it again."));
    };
    photo.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error("A photo could not be loaded. Please take it again."));
    };
    // Captures are data URLs. This also permits export of CORS-enabled images.
    if (!source.startsWith("data:") && !source.startsWith("blob:")) {
      photo.crossOrigin = "anonymous";
    }
    photo.src = source;
  });
}

function drawCroppedPhoto(
  context: CanvasRenderingContext2D,
  photo: HTMLImageElement,
  bounds: PhotoBounds,
) {
  const scale = Math.max(
    bounds.width / photo.naturalWidth,
    bounds.height / photo.naturalHeight,
  );
  const sourceWidth = bounds.width / scale;
  const sourceHeight = bounds.height / scale;

  context.drawImage(
    photo,
    (photo.naturalWidth - sourceWidth) / 2,
    (photo.naturalHeight - sourceHeight) / 2,
    sourceWidth,
    sourceHeight,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
  );
}

function luminance(red: number, green: number, blue: number): number {
  const channels = [red, green, blue].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function drawFittedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  weight = "400",
) {
  let fontSize = size;
  context.font = `${weight} ${fontSize}px Arial, Helvetica, sans-serif`;
  while (context.measureText(text).width > maxWidth && fontSize > 20) {
    fontSize -= 1;
    context.font = `${weight} ${fontSize}px Arial, Helvetica, sans-serif`;
  }
  context.fillText(text, x, y, maxWidth);
}

/** Render the captured photos into a full-resolution, locally downloaded PNG. */
export async function downloadStrip(
  photos: string[],
  options: StripOptions,
): Promise<void> {
  if (!photos.length || photos.length > 4) {
    throw new Error("Take between one and four photos before downloading.");
  }
  if (typeof document === "undefined") {
    throw new Error("Photo downloads are only available in your browser.");
  }

  const images = await Promise.all(photos.map(loadPhoto));
  const photoWidth = 1080;
  const photoHeight = 810;
  const margin = 72;
  const gap = 36;
  const footerHeight = options.date ? 294 : 256;
  const columns = options.layout === "grid" ? 2 : 1;
  const rows = Math.ceil(images.length / columns);
  const canvas = document.createElement("canvas");
  canvas.width = margin * 2 + columns * photoWidth + (columns - 1) * gap;
  canvas.height = margin * 2 + rows * photoHeight + (rows - 1) * gap + footerHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not create the photo strip.");

  // An opaque white undercoat keeps transparent CSS colors printable.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = options.color || "#fffdf7";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
  const paperLuminance = luminance(red, green, blue);
  const darkLuminance = luminance(41, 38, 35);
  const whiteLuminance = luminance(255, 253, 247);
  const darkContrast = (paperLuminance + 0.05) / (darkLuminance + 0.05);
  const lightContrast = (whiteLuminance + 0.05) / (paperLuminance + 0.05);
  const ink = lightContrast > darkContrast ? "#fffdf7" : "#292623";

  const bounds: PhotoBounds[] = images.map((_, index) => ({
    x: margin + (index % columns) * (photoWidth + gap),
    y: margin + Math.floor(index / columns) * (photoHeight + gap),
    width: photoWidth,
    height: photoHeight,
  }));
  const footerTop = margin + rows * photoHeight + (rows - 1) * gap;

  if (options.dots) {
    context.fillStyle = ink;
    context.globalAlpha = 0.24;
    const radius = 5;
    for (let y = 24; y < canvas.height; y += 36) {
      for (let x = 24; x < canvas.width; x += 36) {
        const overPhoto = bounds.some(
          (photo) =>
            x + radius >= photo.x &&
            x - radius <= photo.x + photo.width &&
            y + radius >= photo.y &&
            y - radius <= photo.y + photo.height,
        );
        // Keep the entire footer clear so every caption stays easy to read.
        const overFooter =
          x > margin && x < canvas.width - margin && y > footerTop + 20;
        if (overPhoto || overFooter) continue;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }
    }
    context.globalAlpha = 1;
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  images.forEach((photo, index) => drawCroppedPhoto(context, photo, bounds[index]));

  context.fillStyle = ink;
  context.textAlign = "center";
  context.textBaseline = "middle";
  const center = canvas.width / 2;
  context.font = "italic 700 88px Georgia, 'Times New Roman', serif";
  context.fillText("polka.", center, footerTop + 82);
  const caption = Array.from(options.caption.trim()).slice(0, 40).join("");
  if (caption) {
    drawFittedText(context, caption, center, footerTop + 158, canvas.width - margin * 3, 34);
  }
  if (options.date) {
    drawFittedText(
      context,
      options.date,
      center,
      footerTop + (caption ? 215 : 170),
      canvas.width - margin * 3,
      26,
    );
  }

  let blob: Blob;
  try {
    blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result);
        else reject(new Error("The photo strip could not be exported. Please try again."));
      }, "image/png");
    });
  } catch (error) {
    throw new Error("The photo strip could not be exported. Please try again.", { cause: error });
  }

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `polka-${options.layout}-${Date.now()}.png`;
  link.style.display = "none";
  try {
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    // Give the browser time to start reading the URL before releasing it.
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
    canvas.width = 0;
    canvas.height = 0;
  }
}
