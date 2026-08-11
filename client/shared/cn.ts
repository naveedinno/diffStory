// `cn()` — clsx + tailwind-merge, re-exported from the vendored beUI tree.
//
// Worth routing through here rather than importing the vendored path directly:
// twMerge is what makes overriding a vendored component's baked-in Tailwind
// colours work (`<Button className="bg-accent">` beats the component's own
// `bg-primary`), so every surface ends up calling it, and every surface should
// call the same one.
export { cn } from "../vendor/beui/lib/utils";
