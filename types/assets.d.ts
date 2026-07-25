// Metro resolves image imports to an asset reference (a number from the asset
// registry), but neither `expo/types` nor `react-native`'s types declare the
// image file extensions, so ES-importing an asset is a type error. Declare them
// here so `import icon from "@/assets/.../icon.svg"` type-checks. This does not
// change runtime behavior — Metro's asset plugin already handles these.
declare module "*.svg" {
  const asset: number;
  export default asset;
}

declare module "*.png" {
  const asset: number;
  export default asset;
}

declare module "*.jpg" {
  const asset: number;
  export default asset;
}

declare module "*.jpeg" {
  const asset: number;
  export default asset;
}

declare module "*.gif" {
  const asset: number;
  export default asset;
}

declare module "*.webp" {
  const asset: number;
  export default asset;
}
