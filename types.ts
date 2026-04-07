
export enum FractalType {
  MANDELBROT = 0,
  JULIA = 1,
  BURNING_SHIP = 2,
  TRICORN = 3,
  CELTIC = 4,
  SIERPINSKI_CARPET = 5,
  SIERPINSKI_TRIANGLE = 6,
  KOCH_SNOWFLAKE = 7,
}

export enum ColorScheme {
  CLASSIC = 0,
  ELECTRIC = 1,
  MAGMA = 2,
  RAINBOW = 3,
}

export interface FractalConfig {
  type: FractalType;
  zoom: number;
  centerX: number;
  centerY: number;
  juliaC: { re: number; im: number };
  iterations: number;
  escapeRadius: number;
  colorScheme: ColorScheme;
  smoothColoring: boolean;
  quality: number; // 1 = standard, 2 = high (supersampling if implemented, or just finer detail)
  panSensitivity: number;
}

export interface Viewport {
  width: number;
  height: number;
}
