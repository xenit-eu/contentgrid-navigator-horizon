/**
 * useNavigate() is typed against the app's registered router, which this
 * feature package doesn't see at compile time. This cast bridges that boundary.
 */
export type AnyNavigateFn = (opts: {
  to?: string;
  params?: Record<string, string>;
  search?: ((prev: Record<string, unknown>) => Record<string, unknown>) | Record<string, unknown>;
}) => void;
