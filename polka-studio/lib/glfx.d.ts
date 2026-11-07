declare module "glfx" {
  export interface Texture {
    loadContentsOf(source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement): void;
    destroy(): void;
  }

  export interface Canvas extends HTMLCanvasElement {
    texture(source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement): Texture;
    draw(texture: Texture, width?: number, height?: number): Canvas;
    update(): Canvas;
    brightnessContrast(brightness: number, contrast: number): Canvas;
    hueSaturation(hue: number, saturation: number): Canvas;
    sepia(amount: number): Canvas;
    vibrance(amount: number): Canvas;
    vignette(size: number, amount: number): Canvas;
    curves(red: number[][], green?: number[][], blue?: number[][]): Canvas;
    bulgePinch(centerX: number, centerY: number, radius: number, strength: number): Canvas;
    swirl(centerX: number, centerY: number, radius: number, angle: number): Canvas;
  }

  const fx: { canvas(): Canvas };
  export default fx;
}
