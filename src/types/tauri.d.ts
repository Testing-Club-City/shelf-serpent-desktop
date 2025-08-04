// Type declarations for @tauri-apps/api/core
declare module '@tauri-apps/api/core' {
  export function invoke<T = any>(cmd: string, args?: Record<string, any>): Promise<T>;
  export function convertFileSrc(filePath: string, protocol?: string): string;
  export function transformCallback(callback: (response: any) => void, once?: boolean): number;
}
