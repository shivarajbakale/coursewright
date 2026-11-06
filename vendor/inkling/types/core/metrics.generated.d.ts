export interface FaceMetrics {
    chars: string;
    widths: number[];
    ascent: number;
    descent: number;
}
export declare const METRICS: Record<string, Record<number, FaceMetrics>>;
