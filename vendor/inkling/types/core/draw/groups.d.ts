import type { DrawContext } from './context';
/** Dashed hand-drawn frames around groups, with the group's name in the corner. */
export declare function drawGroups(ctx: DrawContext): void;
/** Every node in a group, including those in its inner groups. */
export declare function memberIds(ctx: DrawContext, groupId: string): string[];
