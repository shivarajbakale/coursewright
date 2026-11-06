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
  export type Style = { [key: string]: StyleValue | Style | Style[] } ;
  export type StyleProp = Style | false | null | undefined | StyleProp[];

  interface Common {
    style?: StyleProp;
    testID?: string;
    children?: ReactNode;
    accessibilityLabel?: string;
    'aria-label'?: string;
    'aria-live'?: 'polite' | 'assertive' | 'off';
    role?: string;
    nativeID?: string;
  }
  export interface ViewProps extends Common {
    ref?: Ref<HTMLElement>;
  }
  export interface TextProps extends Common {
    numberOfLines?: number;
    selectable?: boolean;
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
  export interface ScrollViewProps extends Common {
    contentContainerStyle?: StyleProp;
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
  };
  export function useWindowDimensions(): { width: number; height: number; scale: number; fontScale: number };
  export const AppRegistry: {
    registerComponent(key: string, getComponent: () => ComponentType): void;
    runApplication(key: string, params: { rootTag: HTMLElement | null }): void;
  };
}
