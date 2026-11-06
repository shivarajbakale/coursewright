/**
 * The slice of `react-native` this app uses, as react-native-web renders it.
 *
 * react-native-web ships Flow types only, and `@types/react-native-web` pulls in all of
 * `react-native` (the native toolchain) to type it. This app only ever renders on the web, so it
 * declares the components and props it actually calls. Add to it when a screen needs more.
 */
declare module 'react-native' {
  import type { ComponentType, ReactNode, Ref } from 'react';

  type StyleValue = string | number | undefined;
  export type Style = { [key: string]: StyleValue | Style | Style[] };
  export type StyleProp = Style | false | null | undefined | StyleProp[];

  export type LayoutEvent = { nativeEvent: { layout: { x: number; y: number; width: number; height: number } } };
  export type ScrollEvent = {
    nativeEvent: {
      contentOffset: { x: number; y: number };
      contentSize: { width: number; height: number };
      layoutMeasurement: { width: number; height: number };
    };
  };

  interface Common {
    style?: StyleProp;
    testID?: string;
    children?: ReactNode;
    accessibilityLabel?: string;
    'aria-label'?: string;
    'aria-live'?: 'polite' | 'assertive' | 'off';
    'aria-pressed'?: boolean;
    'aria-expanded'?: boolean;
    'aria-current'?: boolean | 'page' | 'step';
    'aria-hidden'?: boolean;
    'aria-level'?: number;
    'aria-valuenow'?: number;
    'aria-valuemin'?: number;
    'aria-valuemax'?: number;
    role?: string;
    nativeID?: string;
    onLayout?: (e: LayoutEvent) => void;
  }
  export interface ViewProps extends Common {
    ref?: Ref<HTMLElement>;
  }
  export interface TextProps extends Common {
    numberOfLines?: number;
    selectable?: boolean;
    href?: string;
    hrefAttrs?: { target?: string; rel?: string };
    onPress?: () => void;
  }
  export interface PressableProps extends Common {
    onPress?: () => void;
    disabled?: boolean;
    style?: StyleProp | ((state: { pressed: boolean; hovered: boolean; focused: boolean }) => StyleProp);
  }
  export interface TextInputProps extends Common {
    value?: string;
    placeholder?: string;
    placeholderTextColor?: string;
    onChangeText?: (text: string) => void;
    onSubmitEditing?: () => void;
    editable?: boolean;
    multiline?: boolean;
  }
  export interface ScrollViewHandle {
    scrollTo(options: { x?: number; y?: number; animated?: boolean }): void;
  }
  export interface ScrollViewProps extends Common {
    ref?: Ref<ScrollViewHandle>;
    contentContainerStyle?: StyleProp;
    horizontal?: boolean;
    showsHorizontalScrollIndicator?: boolean;
    scrollEventThrottle?: number;
    onScroll?: (e: ScrollEvent) => void;
    onContentSizeChange?: (width: number, height: number) => void;
  }
  export interface ActivityIndicatorProps extends Common {
    color?: string;
    size?: 'small' | 'large' | number;
  }

  export const View: ComponentType<ViewProps>;
  export const Text: ComponentType<TextProps>;
  export const Pressable: ComponentType<PressableProps>;
  export const TextInput: ComponentType<TextInputProps>;
  export const ScrollView: ComponentType<ScrollViewProps>;
  export const ActivityIndicator: ComponentType<ActivityIndicatorProps>;
  export const StyleSheet: {
    create<T extends Record<string, Style>>(styles: T): T;
    hairlineWidth: number;
    absoluteFill: Style;
  };
  export function useWindowDimensions(): { width: number; height: number; scale: number; fontScale: number };
}
