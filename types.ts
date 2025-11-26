export interface Vector2 {
  x: number;
  y: number;
}

export interface HandData {
  isDetected: boolean;
  position: Vector2; // Normalized 0-1 (x, y) of the index finger tip
  directionVector: Vector2; // Vector from center (0,0) indicating movement direction
}

export enum GameState {
  NORMAL = 'NORMAL',
  STORM = 'STORM',
}