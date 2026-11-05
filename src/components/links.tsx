import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import {
  Anchor,
  Button,
  Card,
  NavLink,
  type AnchorProps,
  type ButtonProps,
  type CardProps,
  type NavLinkProps,
} from '@mantine/core';
import { createLink } from '@tanstack/react-router';

/**
 * Mantine components as typed router links.
 *
 * `component={Link}` on a Mantine component loses TanStack Router's typing
 * (`params` becomes `any`-ish and fails strict checks). `createLink` keeps
 * `to` and `params` checked against the route tree. This is TanStack Router's
 * documented pattern for design-system links.
 */
const AnchorBase = forwardRef<HTMLAnchorElement, AnchorProps & ComponentPropsWithoutRef<'a'>>((props, ref) => (
  <Anchor ref={ref} {...props} />
));
AnchorBase.displayName = 'AnchorBase';

const ButtonBase = forwardRef<HTMLAnchorElement, ButtonProps & ComponentPropsWithoutRef<'a'>>((props, ref) => (
  <Button component="a" ref={ref} {...props} />
));
ButtonBase.displayName = 'ButtonBase';

const CardBase = forwardRef<HTMLAnchorElement, CardProps & ComponentPropsWithoutRef<'a'>>((props, ref) => (
  <Card component="a" ref={ref} {...props} />
));
CardBase.displayName = 'CardBase';

const NavLinkBase = forwardRef<HTMLAnchorElement, NavLinkProps & Omit<ComponentPropsWithoutRef<'a'>, keyof NavLinkProps>>(
  (props, ref) => <NavLink component="a" ref={ref} {...props} />
);
NavLinkBase.displayName = 'NavLinkBase';

export const AnchorLink = createLink(AnchorBase);
export const ButtonLink = createLink(ButtonBase);
export const CardLink = createLink(CardBase);
export const NavLinkLink = createLink(NavLinkBase);
