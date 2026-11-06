import type { Doc } from '../types';
import type { Item, StepInfo } from './pieces';
/** Orders the drawn items into steps and gives each a start time. */
export declare function schedule(items: Item[], doc: Doc): {
    steps: StepInfo[];
    duration: number;
};
