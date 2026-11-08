import type { LayoutFn } from '../scene';
/**
 * State machines. States are round boxes placed by the flow engine, ranked
 * from the start dots (`start x`) so the happy path reads in one direction.
 * `final x` adds a bullseye. Groups are composite states. Self-loops and
 * arrows both ways between two states are handled by the router.
 */
export declare const state: LayoutFn;
