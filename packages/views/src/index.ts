// Root barrel: navigation infrastructure ONLY, never a view. The barrel carries no `x-stability`
// tag, and `view-stability-order` treats untagged code as stable; re-exporting a view here would
// hand every importer that view regardless of its tier. Views are imported by their own subpath
// (`@contentgrid/views/<view>`). `stability.test.ts` fails if this file re-exports a view.
export { ChildNavigationProvider, NavigationProvider, useViewNavigation } from "./navigation";
export type { Navigation, NavigationOptions } from "./navigation";
