import type { NativeStackNavigationOptions } from "expo-router";

/** Maps the spec's navbar contract (left/middle/right) onto the native Stack header.
 *  left = back arrow (auto when `back` is true), middle = title, right = none. */
export function headerOptions({
  title,
  back = true,
}: {
  title: string;
  back?: boolean;
}): NativeStackNavigationOptions {
  return {
    headerShown: true,
    title,
    headerBackButtonDisplayMode: "minimal",
    headerLeft: back ? undefined : () => null,
  };
}
